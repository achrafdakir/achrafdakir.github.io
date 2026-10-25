'use strict';

/* Small progressive enhancements. Content and navigation work without JavaScript. */
(() => {
  const root = document.documentElement;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* Private mode is supported. */ } }
  };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let motionPaused = reducedMotion.matches || storage.get('ad-motion-paused') === 'true';
  let redrawSculpture = () => {};
  let updateSculptureMotion = () => {};

  // Reveal only after the observer is ready; never hide content on a failed setup.
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.07, rootMargin: '0px 0px 35px 0px' });
    $$('.reveal').forEach(element => revealObserver.observe(element));
    root.classList.add('js-ready');
  }

  // A durable, reversible theme preference.
  const themeButton = $('.theme-toggle');
  function setTheme(theme) {
    root.dataset.theme = theme;
    const light = theme === 'light';
    themeButton.setAttribute('aria-label', light ? 'Activer le thème sombre' : 'Activer le thème clair');
    $('use', themeButton).setAttribute('href', light ? '#i-moon' : '#i-sun');
    $('meta[name="theme-color"]').content = light ? '#f0efe7' : '#111310';
    redrawSculpture();
  }
  setTheme(storage.get('ad-theme') === 'light' ? 'light' : 'dark');
  themeButton.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(theme);
    storage.set('ad-theme', theme);
  });

  function setMotion(paused, persist = true) {
    motionPaused = paused;
    root.classList.toggle('motion-paused', paused);
    const motionButton = $('#motion-toggle');
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', paused ? 'Activer les animations' : 'Mettre les animations en pause');
    $('.pause-icon', motionButton).textContent = paused ? '▷' : 'Ⅱ';
    const footerButton = $('.footer-motion');
    footerButton.textContent = `Animations : ${paused ? 'en pause' : 'actives'}`;
    footerButton.setAttribute('aria-pressed', String(paused));
    if (persist) storage.set('ad-motion-paused', String(paused));
    updateSculptureMotion();
  }
  setMotion(motionPaused, false);
  [$('#motion-toggle'), $('.footer-motion')].forEach(button => {
    button.addEventListener('click', () => setMotion(!motionPaused));
  });
  reducedMotion.addEventListener('change', event => setMotion(event.matches, false));

  // Navigation stays operable by touch, keyboard and hash links.
  const menuButton = $('.menu-toggle');
  const nav = $('#main-nav');
  function closeMenu(restoreFocus = false) {
    nav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Ouvrir le menu');
    if (restoreFocus) menuButton.focus();
  }
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    nav.classList.toggle('is-open', open);
  });
  $$('a', nav).forEach(link => link.addEventListener('click', () => closeMenu()));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) closeMenu(true);
  });
  document.addEventListener('click', event => {
    if (!$('.site-header').contains(event.target)) closeMenu();
  });
  matchMedia('(min-width: 651px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });

  const progress = $('.scroll-progress');
  let scrollQueued = false;
  function refreshScroll() {
    const height = root.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${height > 0 ? Math.min(1, scrollY / height) : 0})`;
    const sections = ['projets', 'apropos', 'parcours', 'contact'];
    let current = '';
    for (const id of sections) {
      if (document.getElementById(id).getBoundingClientRect().top <= window.innerHeight * .38) current = id;
    }
    $$('[data-nav]').forEach(link => {
      const active = link.dataset.nav === current;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scrollQueued = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(refreshScroll); }
  }, { passive: true });
  window.addEventListener('resize', refreshScroll, { passive: true });
  refreshScroll();

  const franceClock = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  function updateClock() {
    if (!document.hidden) {
      const now = new Date();
      $('#france-time').textContent = franceClock.format(now);
      $('#france-time').dateTime = now.toISOString();
    }
  }
  updateClock();
  setInterval(updateClock, 1000);
  $('#year').textContent = new Date().getFullYear();

  // Filters reflect the real project categories, without replacing the document.
  $$('.filter').forEach(button => button.addEventListener('click', () => {
    const category = button.dataset.filter;
    let count = 0;
    $$('.project-card').forEach(card => {
      const visible = category === 'all' || card.dataset.categories.split(' ').includes(category);
      card.hidden = !visible;
      if (visible) { count++; card.classList.add('is-visible'); }
    });
    $$('.filter').forEach(filter => {
      const active = filter === button;
      filter.classList.toggle('active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    $('#project-count').textContent = `${String(count).padStart(2, '0')} PROJET${count > 1 ? 'S' : ''}`;
    refreshScroll();
  }));

  // Source-grounded case studies. Illustrative product names are identified.
  const projects = {
    livinglab: {
      eyebrow: '01 / CSTB · EXPÉRIENCE PROFESSIONNELLE',
      title: 'Faire parler les données du bâtiment.',
      intro: 'Relier des mesures techniques à une interface compréhensible pour suivre le bâtiment et ses équipements.',
      facts: [['Contexte', 'Stage puis alternance au CSTB'], ['Période', 'Avril 2025 – septembre 2026'], ['Domaines', 'Web · IoT · données BIM']],
      sections: [
        ['Le contexte', 'Un bâtiment instrumenté produit des données de consommation, de qualité de l’air et d’état des capteurs. L’enjeu est de réunir ces informations pour faciliter leur consultation et leur exploitation.'],
        ['Ma contribution', [
          'Développement d’une application Angular de suivi énergétique avec des indicateurs par tableau divisionnaire, service et période.',
          'Intégration de dashboards Grafana dans l’application pour visualiser les données issues des capteurs.',
          'Participation à un système d’alertes IoT et à la stabilisation d’une plateforme de supervision existante.',
          'Conception d’un convertisseur Python de données BIM du format IFC vers JSON.'
        ]],
        ['L’approche', 'Faire le lien entre la collecte de données, les traitements techniques et les besoins de lecture de l’interface. Angular structure les vues ; Grafana apporte la visualisation ; Python permet de transformer les données BIM.'],
        ['Ce que j’en retiens', 'La qualité d’une interface dépend aussi de la cohérence des données qu’elle présente. Comprendre le domaine métier est une étape essentielle avant de choisir les indicateurs ou de construire un écran.']
      ],
      stack: ['Angular', 'TypeScript', 'Python', 'InfluxDB', 'Grafana', 'Node-RED', 'IfcOpenShell']
    },
    dons: {
      eyebrow: '02 / PLATEFORME DE DONS · PROJET WEB',
      title: 'Donner une seconde vie aux objets.',
      intro: 'Une application web pour publier des annonces de dons, trouver un objet et entrer en contact avec la personne qui le propose.',
      facts: [['Projet', 'Plateforme de dons d’objets'], ['Domaine', 'Application web Full Stack'], ['Cœur technique', 'Java · Spring Boot · SQL']],
      sections: [
        ['Le besoin', 'Faciliter le partage d’objets entre particuliers grâce à un parcours simple : publier, rechercher, enregistrer puis échanger.'],
        ['Les fonctionnalités', [
          'Création, modification et gestion des annonces de dons.',
          'Recherche avancée pour retrouver les annonces pertinentes.',
          'Gestion des favoris et des notifications.',
          'Messagerie interne entre utilisateurs.',
          'Conception des ressources et échanges via une API REST.'
        ]],
        ['L’architecture', 'Spring Boot porte la logique applicative et les ressources REST. JPA / Hibernate assurent la correspondance entre les objets Java et les données persistées dans une base SQL. Git accompagne le versionnement du projet.'],
        ['Le parti pris visuel', '« seconde vie. » est un nom de présentation créé pour ce portfolio. Le visuel propose une direction chaleureuse et accessible ; il ne constitue pas une capture de l’application d’origine.']
      ],
      stack: ['Java', 'Spring Boot', 'JPA / Hibernate', 'SQL', 'API REST', 'Git']
    },
    pipeline: {
      eyebrow: '03 / AUTOMATISATION · PROJET ACADÉMIQUE',
      title: 'Du commit à l’application.',
      intro: 'Déployer un microservice conteneurisé avec une infrastructure décrite, une configuration automatisée et un point d’entrée HTTPS.',
      facts: [['Contexte', 'Projet académique'], ['Environnement', 'Machine virtuelle'], ['Approche', 'Infrastructure & CI/CD']],
      sections: [
        ['L’objectif', 'Rendre les étapes de déploiement reproductibles en décrivant l’infrastructure et en automatisant la configuration et la livraison de l’application.'],
        ['Les briques', [
          'Docker pour conteneuriser le microservice.',
          'MariaDB pour la persistance des données.',
          'Traefik comme reverse proxy avec configuration HTTPS.',
          'Ansible pour automatiser la configuration.',
          'GitLab CI/CD pour organiser la chaîne d’intégration et de déploiement.',
          'OpenTofu pour gérer l’infrastructure de la machine virtuelle.'
        ]],
        ['La logique', 'Séparer la définition de l’infrastructure, la configuration du système et le déploiement de l’application permet de rendre chaque étape explicite et versionnée.'],
        ['Ce que j’en retiens', 'Livrer une application ne se limite pas à la lancer. La configuration, l’accès réseau et la reproductibilité font partie du travail de développement. Le pipeline présenté ici en est une illustration simplifiée.']
      ],
      stack: ['Docker', 'Traefik', 'MariaDB', 'GitLab CI/CD', 'Ansible', 'OpenTofu', 'HTTPS']
    }
  };
  const dialog = $('#case-dialog');
  const projectIds = Object.keys(projects);
  let currentProject = '';
  let previousHash = '#projets';
  let returnFocus = null;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function openProject(id, pushHistory = true) {
    const project = projects[id];
    if (!project) return;
    if (!dialog.open) {
      previousHash = location.hash.startsWith('#projet-') ? '#projets' : location.hash;
      returnFocus = document.activeElement;
    }
    currentProject = id;
    $('#case-eyebrow').textContent = project.eyebrow;
    $('#case-title').textContent = project.title;
    $('#case-intro').textContent = project.intro;
    $('#case-facts').replaceChildren(...project.facts.map(([label, value]) => {
      const node = element('div');
      node.append(element('span', label.toUpperCase()), element('p', value));
      return node;
    }));
    $('#case-sections').replaceChildren(...project.sections.map(([title, content]) => {
      const section = element('section', undefined, 'case-section');
      const body = element('div');
      if (Array.isArray(content)) {
        const list = element('ul');
        list.append(...content.map(text => element('li', text)));
        body.append(list);
      } else body.append(element('p', content));
      section.append(element('h3', title), body);
      return section;
    }));
    $('#case-stack').replaceChildren(...project.stack.map(label => element('span', label)));
    if (!dialog.open) {
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    }
    dialog.scrollTop = 0;
    $('.dialog-close').focus({ preventScroll: true });
    if (pushHistory) history.pushState({ project: id }, '', `#projet-${id}`);
  }
  function closeProject(restoreHash = true) {
    if (!dialog.open) return;
    dialog.close();
    document.body.style.overflow = '';
    if (restoreHash) history.replaceState(null, '', `${location.pathname}${location.search}${previousHash}`);
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  }
  $$('[data-project]').forEach(button => button.addEventListener('click', () => openProject(button.dataset.project)));
  $('.dialog-close').addEventListener('click', () => closeProject());
  $('[data-close-dialog]').addEventListener('click', event => { event.preventDefault(); closeProject(); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeProject(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeProject();
  });
  $('[data-contact-dialog]').addEventListener('click', () => closeProject(false));
  $('#next-project').addEventListener('click', () => {
    const index = projectIds.indexOf(currentProject);
    openProject(projectIds[(index + 1) % projectIds.length]);
  });
  function syncProjectHash() {
    const id = location.hash.replace('#projet-', '');
    if (location.hash.startsWith('#projet-') && projects[id]) openProject(id, false);
    else if (dialog.open) closeProject(false);
  }
  window.addEventListener('hashchange', syncProjectHash);
  window.addEventListener('popstate', syncProjectHash);
  syncProjectHash();

  // Copying the public contact address. Form submission lives in contact.js.
  let toastTimer;
  function toast(message) {
    const node = $('#toast');
    node.textContent = message;
    node.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('visible'), 3800);
  }
  $('.copy-email').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText('achrafdakir.dev@gmail.com');
      toast('Adresse e-mail copiée. À très vite !');
    } catch {
      toast('L’adresse à copier : achrafdakir.dev@gmail.com');
    }
  });
  // Parametric sculpture: a real Canvas projection, rendered locally.
  // Three topologies share a mesh so shape transitions can interpolate.
  const canvas = $('#sculpture');
  const context = canvas.getContext('2d');
  if (!context) {
    $('.hero-art').classList.add('canvas-unavailable');
    $('#shape-toggle').hidden = true;
    return;
  }
  const U = 64, V = 26, TAU = Math.PI * 2;
  const shapeNames = ['Tore', 'Sphère', 'Onde'];
  const shapes = shapeNames.map((_, shape) => {
    const points = [];
    for (let i = 0; i < U; i++) {
      for (let j = 0; j < V; j++) {
        const u = i / U * TAU, v = j / V * TAU;
        if (shape === 0) {
          const radius = .5 + .08 * Math.sin(3 * u);
          points.push([(1.18 + radius * Math.cos(v)) * Math.cos(u), (1.18 + radius * Math.cos(v)) * Math.sin(u), radius * Math.sin(v) + .15 * Math.cos(3 * u)]);
        } else if (shape === 1) {
          const phi = j / (V - 1) * Math.PI;
          const radius = 1.55 + .08 * Math.sin(5 * u) * Math.sin(3 * phi);
          points.push([radius * Math.sin(phi) * Math.cos(u), radius * Math.sin(phi) * Math.sin(u), radius * Math.cos(phi)]);
        } else {
          const x = (i / (U - 1) - .5) * 3.6, y = (j / (V - 1) - .5) * 2.8;
          points.push([x, y, .5 * Math.sin(x * 2 + y) + .2 * Math.cos(y * 3)]);
        }
      }
    }
    return points;
  });
  const edges = [];
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < V; j++) {
      const index = i * V + j;
      edges.push([index, i * V + (j + 1) % V, 'v', j]);
      edges.push([index, ((i + 1) % U) * V + j, 'u', i]);
    }
  }
  const current = shapes[0].map(point => [...point]);
  let shapeIndex = 0;
  let width = 0, height = 0;
  let rotation = .15;
  let frame = 0, lastTime = 0, lastDrawTime = 0;
  let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
  let transitioning = false, inView = true;

  function fitCanvas() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw();
  }
  function draw() {
    context.clearRect(0, 0, width, height);
    if (!width || !height) return;
    const light = root.dataset.theme === 'light';
    const rgb = light ? '64,106,25' : '195,246,107';
    const scale = Math.min(width, height) * .265;
    const ax = .96 + pointerY * .32, ay = rotation + pointerX * .4, az = -.43;
    const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
    const projected = current.map(point => {
      let [x, y, z] = point;
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      [x, y] = [x * cz - y * sz, x * sz + y * cz];
      const perspective = 5.5 / (5.5 - z);
      return [width * .54 + x * scale * perspective, height * .48 + y * scale * perspective, z];
    });
    // Bin strokes by depth to avoid thousands of style changes per frame.
    const bins = Array.from({ length: 14 }, () => []);
    for (const [a, b, direction, index] of edges) {
      if (shapeIndex === 1 && direction === 'v' && index === V - 1) continue;
      if (shapeIndex === 2 && ((direction === 'u' && index === U - 1) || (direction === 'v' && index === V - 1))) continue;
      const p = projected[a], q = projected[b];
      const depth = Math.max(0, Math.min(13, Math.floor(((p[2] + q[2]) * .5 + 2.2) / 4.4 * 14)));
      bins[depth].push([p, q]);
    }
    bins.forEach((lines, depth) => {
      context.beginPath();
      for (const [a, b] of lines) { context.moveTo(a[0], a[1]); context.lineTo(b[0], b[1]); }
      context.strokeStyle = `rgba(${rgb},${.055 + depth / 13 * (light ? .55 : .64)})`;
      context.lineWidth = .45 + depth / 13 * .42;
      context.stroke();
    });
    for (let index = 0; index < projected.length; index += 11) {
      const point = projected[index];
      if (point[2] < .3) continue;
      context.beginPath();
      context.arc(point[0], point[1], point[2] > 1 ? 1.25 : .7, 0, TAU);
      context.fillStyle = `rgba(${rgb},.7)`;
      context.fill();
    }
  }
  function tick(time) {
    frame = 0;
    if (document.hidden || !inView || (motionPaused && !transitioning)) return;
    // 30 fps is enough for this slow sculpture, including on mobile hardware.
    if (time - lastDrawTime < 1000 / 30) {
      frame = requestAnimationFrame(tick);
      return;
    }
    lastDrawTime = time;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, .04) : .016;
    lastTime = time;
    if (!motionPaused) rotation += delta * .12;
    pointerX += (targetX - pointerX) * .06;
    pointerY += (targetY - pointerY) * .06;
    if (transitioning) {
      let distance = 0;
      for (let i = 0; i < current.length; i++) {
        for (let j = 0; j < 3; j++) {
          const gap = shapes[shapeIndex][i][j] - current[i][j];
          current[i][j] += gap * .065;
          distance += Math.abs(gap);
        }
      }
      if (distance < .3) transitioning = false;
    }
    draw();
    if (!motionPaused || transitioning) frame = requestAnimationFrame(tick);
  }
  function updateAnimation() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    lastDrawTime = 0;
    if (!motionPaused && inView && !document.hidden) frame = requestAnimationFrame(tick);
    else draw();
  }
  updateSculptureMotion = updateAnimation;
  redrawSculpture = draw;
  canvas.addEventListener('pointermove', event => {
    if (motionPaused || event.pointerType === 'touch') return;
    const bounds = canvas.getBoundingClientRect();
    targetX = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    targetY = (event.clientY - bounds.top) / bounds.height * 2 - 1;
  }, { passive: true });
  canvas.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; });
  $('#shape-toggle').addEventListener('click', () => {
    shapeIndex = (shapeIndex + 1) % shapes.length;
    $('#shape-name').textContent = shapeNames[shapeIndex];
    canvas.setAttribute('aria-label', `Sculpture générative verte : ${shapeNames[shapeIndex].toLowerCase()}.`);
    if (motionPaused || reducedMotion.matches) {
      current.forEach((point, index) => point.splice(0, 3, ...shapes[shapeIndex][index]));
      transitioning = false;
      draw();
    } else {
      transitioning = true;
      if (!frame) frame = requestAnimationFrame(tick);
    }
  });
  document.addEventListener('visibilitychange', updateAnimation);
  if ('IntersectionObserver' in window) {
    const canvasObserver = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      updateAnimation();
    });
    canvasObserver.observe(canvas);
  }
  if ('ResizeObserver' in window) new ResizeObserver(fitCanvas).observe(canvas);
  else window.addEventListener('resize', fitCanvas, { passive: true });
  fitCanvas();
  updateAnimation();
})();
