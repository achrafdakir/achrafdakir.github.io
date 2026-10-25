const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const sourcePath = existsSync(join(__dirname, '../dist/js/contact.js'))
  ? join(__dirname, '../dist/js/contact.js')
  : join(__dirname, '../js/contact.js');
const source = readFileSync(sourcePath, 'utf8');
const ok = () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });

function harness(transport = async () => ok(), options = {}) {
  const fields = Object.fromEntries(Object.entries({
    name: 'Visiteur local',
    email: 'visiteur@example.com',
    subject: 'Un projet à construire',
    message: 'Message de vérification locale, avec caractères accentués.',
    _gotcha: ''
  }).map(([name, value]) => [name, {
    name, value, attributes: {}, focused: false,
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; },
    hasAttribute(key) { return key in this.attributes; },
    focus() { this.focused = true; }
  }]));
  const events = {}, timers = new Map(), requests = [];
  const button = { disabled: false };
  const label = { textContent: 'Envoyer le message' };
  const status = { textContent: '', dataset: {} };
  const form = {
    action: 'https://formspree.io/f/xwllvrod',
    dataset: {}, fields, attributes: {}, resets: 0,
    elements: { namedItem: name => fields[name] },
    querySelector(selector) {
      return { '[type="submit"]': button, '[data-submit-label]': label, '#form-status': status }[selector];
    },
    querySelectorAll() { return Object.values(fields).filter(field => field.hasAttribute('aria-invalid')); },
    reportValidity() { return options.valid !== false; },
    addEventListener(name, listener) { events[name] = listener; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    reset() { this.resets++; Object.values(fields).forEach(field => { field.value = ''; }); }
  };
  const browser = {
    fetch: options.noFetch ? undefined : (url, request) => {
      requests.push({ url, request, data: Object.fromEntries(request.body.entries()) });
      return transport(url, request);
    },
    AbortController,
    setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  class BrowserFormData extends FormData {
    constructor(form) { super(); Object.values(form.fields).forEach(field => this.append(field.name, field.value)); }
  }
  const context = vm.createContext({
    document: { querySelector: () => form }, window: browser,
    AbortController, FormData: BrowserFormData
  });
  vm.runInContext(source, context);
  return {
    form, fields, button, label, status, requests, events, timers, context,
    submit: () => events.submit({ preventDefault() {} })
  };
}

test('posts named fields to the configured endpoint, then confirms and resets', async () => {
  const h = harness();
  await h.submit();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, 'https://formspree.io/f/xwllvrod');
  assert.equal(h.requests[0].request.method, 'POST');
  assert.equal(h.requests[0].request.headers.Accept, 'application/json');
  assert.equal(h.requests[0].data.email, 'visiteur@example.com');
  assert.match(h.requests[0].data.message, /accentués/);
  assert.equal(h.status.dataset.state, 'success');
  assert.equal(h.form.resets, 1);
  assert.equal(h.button.disabled, false);
  assert.equal(h.label.textContent, 'Envoyer le message');
  assert.equal(h.form.attributes['aria-busy'], undefined);
  assert.equal(h.timers.size, 0);
});

test('blocks a duplicate submission while the first request is pending', async () => {
  let finish;
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  const first = h.submit();
  assert.equal(h.button.disabled, true);
  assert.equal(h.form.attributes['aria-busy'], 'true');
  assert.equal(h.status.dataset.state, 'pending');
  await h.submit();
  assert.equal(h.requests.length, 1);
  finish(ok());
  await first;
  assert.equal(h.button.disabled, false);
});

test('invalid client fields never trigger a network request', async () => {
  const h = harness(undefined, { valid: false });
  await h.submit();
  assert.equal(h.requests.length, 0);
  assert.equal(h.form.resets, 0);
});

test('server field errors preserve the message and focus the invalid field', async () => {
  const h = harness(async () => ({ ok: false, status: 422, json: async () => ({ errors: [{ field: 'email', message: 'Invalid email' }] }) }));
  const message = h.fields.message.value;
  await h.submit();
  assert.equal(h.status.dataset.state, 'error');
  assert.equal(h.fields.email.attributes['aria-invalid'], 'true');
  assert.equal(h.fields.email.focused, true);
  assert.equal(h.fields.message.value, message);
  assert.equal(h.form.resets, 0);
  h.events.input({ target: h.fields.email });
  assert.equal(h.fields.email.attributes['aria-invalid'], undefined);
});

test('rate limits are reported without clearing user input', async () => {
  const h = harness(async () => ({ ok: false, status: 429, json: async () => ({ errors: [{ message: 'Limit' }] }) }));
  await h.submit();
  assert.equal(h.status.dataset.state, 'error');
  assert.match(h.status.textContent, /temporairement/);
  assert.equal(h.form.resets, 0);
  assert.equal(h.button.disabled, false);
});

test('a lost connection does not claim delivery or discard the message', async () => {
  const h = harness(async () => { throw new TypeError('Offline'); });
  const message = h.fields.message.value;
  await h.submit();
  assert.equal(h.status.dataset.state, 'error');
  assert.match(h.status.textContent, /Impossible de confirmer/);
  assert.equal(h.fields.message.value, message);
  assert.equal(h.form.resets, 0);
  assert.equal(h.button.disabled, false);
});

test('timeouts stop waiting and restore the button', async () => {
  const h = harness((url, request) => new Promise((resolve, reject) => {
    request.signal.addEventListener('abort', () => reject(new Error('Aborted')));
  }));
  const request = h.submit();
  [...h.timers.values()][0]();
  await request;
  assert.equal(h.status.dataset.state, 'error');
  assert.equal(h.button.disabled, false);
  assert.equal(h.form.resets, 0);
});

test('an unexpected HTML response is not shown as a success', async () => {
  const h = harness(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Not JSON'); } }));
  await h.submit();
  assert.equal(h.status.dataset.state, 'error');
  assert.equal(h.form.resets, 0);
});

test('a declared error in a successful HTTP response is still treated as an error', async () => {
  const h = harness(async () => ({ ok: true, status: 200, json: async () => ({ ok: false }) }));
  await h.submit();
  assert.equal(h.status.dataset.state, 'error');
  assert.equal(h.form.resets, 0);
});

test('unsupported browsers keep the HTML POST fallback', () => {
  const h = harness(undefined, { noFetch: true });
  assert.equal(h.events.submit, undefined);
  assert.equal(h.form.dataset.contactReady, undefined);
});

test('loading the enhancement twice does not attach another submit listener', async () => {
  const h = harness();
  const original = h.events.submit;
  vm.runInContext(source, h.context);
  assert.equal(h.events.submit, original);
  await h.submit();
  assert.equal(h.requests.length, 1);
});
