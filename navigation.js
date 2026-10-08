(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const overlay = document.querySelector('.page-transition');
  let navigating = false;
  window.addEventListener('pageshow', () => {
    navigating = false;
    document.body.classList.remove('page-leaving');
    document.body.classList.add('page-entering');
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || !destination.pathname.endsWith('.html') || (destination.pathname === location.pathname && destination.hash === location.hash) || reduced.matches) return;
    if (navigating) { event.preventDefault(); return; }
    event.preventDefault();
    navigating = true;
    overlay.querySelector('.transition-label').textContent = link.dataset.page ? link.textContent.trim() : destination.pathname.endsWith('index.html') ? '闫爽' : link.textContent.trim().replace('↗', '');
    document.body.classList.remove('page-entering');
    document.body.classList.add('page-leaving');
    // The fallback timer guarantees navigation if an animation event is interrupted.
    let followed = false;
    const follow = () => { if (!followed) { followed = true; location.assign(destination.href); } };
    overlay.querySelector('.transition-curtain').addEventListener('animationend', follow, {once:true});
    window.setTimeout(follow, 720);
  });
  document.querySelectorAll('.project-toggle').forEach(button => button.addEventListener('click', () => {
    const details = button.closest('.personal-project-card').querySelector('.project-details');
    const open = details.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
    details.setAttribute('aria-hidden', String(!open));
    button.textContent = open ? '收起项目思路' : '查看项目思路';
  }));
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => header.classList.toggle('is-scrolled', window.scrollY > 24), {passive:true});
})();
