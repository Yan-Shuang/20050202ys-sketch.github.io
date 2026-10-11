(() => {
  const root = document.documentElement, body = document.body, main = document.querySelector('main');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton = document.querySelector('.motion-toggle');
  const overlay = document.querySelector('.page-transition');
  const curtain = overlay?.querySelector('.transition-curtain'), label = overlay?.querySelector('.transition-label');
  const views = [...document.querySelectorAll('[data-preview-route]')], isPreview = views.length > 0;
  const names = { index: '首页', about: '关于', experience: '能力', projects: '作品', notes: '方法', contact: '联系' };
  const positions = new Map(), detailAnimations = new Map();
  let preference, pending = null, enteringTimer, previewClick = false, currentPreview = location.hash || '#preview-index';
  try { preference = localStorage.getItem('portfolio-motion'); } catch { /* Optional storage. */ }
  const motionOff = () => preference === 'off' || reduced.matches;
  const activeView = () => isPreview ? views.find(view => !view.hidden) : main;
  const clearTransition = () => {
    clearTimeout(enteringTimer);
    body.classList.remove('page-entering', 'page-leaving');
    body.removeAttribute('aria-busy');
  };
  const clearPending = () => {
    if (!pending) return;
    clearTimeout(pending.timer);
    curtain?.removeEventListener('animationend', pending.onEnd);
    pending = null;
  };
  const cancelNavigation = () => { clearPending(); clearTransition(); };
  let observer;
  const prepareReveals = () => {
    observer?.disconnect();
    activeView()?.querySelectorAll('.reveal').forEach(element => {
      element.classList.remove('reveal-pending');
      if (!motionOff() && observer && element.getBoundingClientRect().top > innerHeight) {
        element.classList.add('reveal-pending'); observer.observe(element);
      }
    });
  };
  if ('IntersectionObserver' in window) observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.remove('reveal-pending'); observer.unobserve(entry.target); } });
  }, { threshold: 0.08 });
  const updateHeader = () => document.querySelector('.site-header')?.classList.toggle('is-scrolled', scrollY > 24);
  const enterPage = () => {
    clearPending(); clearTransition(); prepareReveals(); updateHeader();
    if (motionOff()) return;
    void overlay?.offsetWidth;
    body.classList.add('page-entering');
    enteringTimer = setTimeout(clearTransition, 1100);
  };
  const previewDestination = url => {
    const match = /^#preview-(index|about|experience|projects|notes|contact)(?:\/([^/]+))?$/.exec(url.hash);
    return match ? { route: match[1], anchor: match[2] } : null;
  };
  const renderPreview = (initial = false) => {
    const destination = previewDestination(new URL(location.href)) || { route: 'index' };
    const routeChanged = body.dataset.route !== destination.route;
    if (!initial) positions.set(currentPreview, scrollY);
    views.forEach(view => { view.hidden = view.dataset.previewRoute !== destination.route; });
    body.dataset.route = destination.route;
    document.title = activeView()?.dataset.previewTitle || document.title;
    document.querySelectorAll('.site-nav a').forEach(link => {
      if (link.getAttribute('href') === '#preview-' + destination.route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const position = !initial && !previewClick ? positions.get(location.hash || '#preview-index') : undefined;
    if (position !== undefined) scrollTo({ top: position, behavior: 'instant' });
    else if (destination.anchor) activeView()?.querySelector('#' + CSS.escape(destination.anchor))?.scrollIntoView({ behavior: 'instant' });
    else scrollTo({ top: 0, behavior: 'instant' });
    currentPreview = location.hash || '#preview-index';
    if (!initial) { main?.focus({ preventScroll: true }); if (routeChanged) enterPage(); }
    previewClick = false;
  };
  if (isPreview) {
    history.scrollRestoration = 'manual'; renderPreview(true);
    addEventListener('hashchange', () => { if (!location.hash || previewDestination(new URL(location.href))) renderPreview(); });
  }
  const commit = destination => {
    clearPending();
    if (isPreview) { previewClick = true; location.hash = destination.hash; }
    else location.assign(destination.href);
  };
  const applyMotion = () => {
    root.dataset.motion = motionOff() ? 'off' : 'on';
    if (motionButton) {
      motionButton.setAttribute('aria-pressed', String(motionOff()));
      motionButton.textContent = reduced.matches ? '系统已减少动效' : motionOff() ? '恢复动效' : '暂停动效';
      motionButton.disabled = reduced.matches;
    }
    if (motionOff()) {
      const destination = pending?.destination;
      clearTransition();
      detailAnimations.forEach(state => state.finish());
      document.querySelectorAll('.reveal-pending').forEach(element => element.classList.remove('reveal-pending'));
      if (destination) commit(destination);
    }
  };
  applyMotion();
  motionButton?.addEventListener('click', () => {
    preference = motionOff() ? 'on' : 'off';
    try { localStorage.setItem('portfolio-motion', preference); } catch { /* Optional storage. */ }
    applyMotion();
  });
  reduced.addEventListener('change', applyMotion);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin) return;
    const preview = isPreview && destination.pathname === location.pathname ? previewDestination(destination) : null;
    const route = isPreview ? preview?.route : /\/([^/]+)\.html$/.exec(destination.pathname)?.[1];
    if (!(route in names)) return;
    if (pending) { event.preventDefault(); return; }
    if (isPreview ? destination.hash === location.hash || (!location.hash && destination.hash === '#preview-index') : destination.pathname === location.pathname && destination.hash === location.hash) { event.preventDefault(); return; }
    if (isPreview && route === body.dataset.route) return;
    if (motionOff() || !curtain) { if (isPreview) previewClick = true; return; }
    event.preventDefault(); clearTransition();
    if (label) label.textContent = names[route];
    void overlay.offsetWidth;
    body.classList.add('page-leaving'); body.setAttribute('aria-busy', 'true');
    const job = { destination };
    job.onEnd = event => { if (event.target === curtain && event.animationName === 'curtainCover' && pending === job) commit(destination); };
    pending = job;
    curtain.addEventListener('animationend', job.onEnd);
    // Original 550 ms cover; fallback guarantees progress if CSS is interrupted.
    job.timer = setTimeout(() => { if (pending === job) commit(destination); }, 720);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && pending) { event.preventDefault(); cancelNavigation(); }
  });
  addEventListener('pageshow', enterPage);
  addEventListener('pagehide', cancelNavigation);
  addEventListener('scroll', updateHeader, { passive: true });
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const activateTab = tab => {
    tabs.forEach(item => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    });
    const system = document.querySelector('.system-panel');
    if (system) system.dataset.stage = tab.dataset.stage;
  };
  if (tabs.length) {
    activateTab(tabs[0]);
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateTab(tab));
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
        if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
        if (event.key === 'Home') next = tabs[0];
        if (event.key === 'End') next = tabs[tabs.length - 1];
        if (next) { event.preventDefault(); activateTab(next); next.focus(); }
      });
    });
  }
  // Progressive enhancement retains native details and keyboard behavior.
  document.querySelectorAll('.project-detail').forEach(details => {
    const summary = details.querySelector('summary');
    const toggle = open => {
      const start = details.getBoundingClientRect().height;
      detailAnimations.get(details)?.animation.cancel();
      details.open = true; details.style.height = '';
      const end = open ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height + 1;
      const animation = details.animate([{ height: start + 'px' }, { height: end + 'px' }], { duration: 450, easing: 'ease' });
      details.style.overflow = 'hidden';
      const state = { open, animation, finish: () => {
        if (detailAnimations.get(details) !== state) return;
        animation.cancel(); details.open = open; details.style.height = ''; details.style.overflow = '';
        detailAnimations.delete(details);
      } };
      detailAnimations.set(details, state); animation.onfinish = state.finish;
    };
    summary?.addEventListener('click', event => {
      if (motionOff() || !details.animate) return;
      event.preventDefault(); toggle(!(detailAnimations.get(details)?.open ?? details.open));
    });
    details.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !details.open) return;
      event.preventDefault(); summary.focus();
      if (motionOff() || !details.animate) details.open = false;
      else toggle(false);
    });
  });
  root.classList.add('js'); prepareReveals();
})();
