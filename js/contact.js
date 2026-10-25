'use strict';

// The HTML form remains a normal POST form when enhancement is unavailable.
(() => {
  const form = document.querySelector('#contact-form');
  if (!form || form.dataset.contactReady === 'true') return;
  if (typeof window.fetch !== 'function' || typeof window.AbortController !== 'function') return;

  const button = form.querySelector('[type="submit"]');
  const label = form.querySelector('[data-submit-label]');
  const status = form.querySelector('#form-status');
  if (!button || !label || !status) return;

  form.dataset.contactReady = 'true';
  const idleLabel = label.textContent;
  let sending = false;

  function showStatus(state, message) {
    status.dataset.state = state;
    status.textContent = message;
  }

  function clearFieldErrors() {
    form.querySelectorAll('[aria-invalid="true"]').forEach(field => {
      field.removeAttribute('aria-invalid');
    });
  }

  form.addEventListener('input', event => {
    if (event.target.hasAttribute('aria-invalid')) event.target.removeAttribute('aria-invalid');
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;

    clearFieldErrors();
    sending = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    label.textContent = 'Envoi en cours…';
    showStatus('pending', 'Votre message est en cours d’envoi…');

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);

    try {
      const response = await window.fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        signal: controller.signal
      });

      let result = null;
      try { result = await response.json(); } catch { /* Show a safe error for an unexpected response. */ }

      const errors = Array.isArray(result?.errors) ? result.errors : [];
      if (!response.ok || result?.ok === false || errors.length || !result) {
        let firstInvalid = null;
        for (const error of errors) {
          if (!['name', 'email', 'subject', 'message'].includes(error.field)) continue;
          const field = form.elements.namedItem(error.field);
          if (field) {
            field.setAttribute('aria-invalid', 'true');
            firstInvalid ||= field;
          }
        }

        if (response.status === 429) {
          showStatus('error', 'Le formulaire est temporairement indisponible. Réessayez plus tard ou contactez-moi directement par e-mail.');
        } else if (firstInvalid) {
          showStatus('error', 'Votre message n’a pas été envoyé. Vérifiez les champs signalés puis réessayez.');
          firstInvalid.focus();
        } else {
          showStatus('error', 'Votre message n’a pas pu être envoyé. Réessayez ou utilisez le lien e-mail à côté du formulaire.');
        }
        return;
      }

      form.reset();
      showStatus('success', 'Merci ! Votre message a bien été transmis. Je vous répondrai par e-mail.');
    } catch {
      // A lost response does not prove that the server rejected the message.
      showStatus('error', 'Impossible de confirmer l’envoi. Vérifiez votre connexion ou contactez-moi directement par e-mail. Votre texte a été conservé.');
    } finally {
      window.clearTimeout(timeout);
      sending = false;
      button.disabled = false;
      label.textContent = idleLabel;
      form.removeAttribute('aria-busy');
    }
  });
})();
