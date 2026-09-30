// Asseton: Werken bij. Turns the vacancy index into a role switcher (tabs) and shows one vacancy at a time.
// Without this script both vacancies stay on the page one after the other and the index is plain in-page links.
(() => {
'use strict';
const vac = document.getElementById('vac');
const list = document.getElementById('vacTabs');
if (!vac || !list) return;
const tabs = Array.from(list.querySelectorAll('.vac-tab'));
const docs = tabs.map(t => document.getElementById((t.getAttribute('href') || '').slice(1)));
if (tabs.length < 2 || docs.some(d => !d)) return;
const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const railCta = document.getElementById('vacRailCta');
const railApply = document.getElementById('vacRailApply');

list.setAttribute('role', 'tablist');
list.setAttribute('aria-orientation', 'vertical');
tabs.forEach((t, i) => {
  t.setAttribute('role', 'tab');
  t.setAttribute('aria-controls', docs[i].id);
  docs[i].setAttribute('role', 'tabpanel');
});
const mqRail = window.matchMedia ? matchMedia('(min-width: 1025px)') : { matches: true };
const syncOrient = () => list.setAttribute('aria-orientation', mqRail.matches ? 'vertical' : 'horizontal');
syncOrient();
if (mqRail.addEventListener) mqRail.addEventListener('change', syncOrient); else if (mqRail.addListener) mqRail.addListener(syncOrient);

let cur = -1;
const select = (i, animate) => {
  if (i === cur) return false;
  cur = i;
  tabs.forEach((t, k) => { const on = k === i; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
  docs.forEach((d, k) => { d.hidden = k !== i; });
  if (railApply && tabs[i].dataset.subject) railApply.href = 'mailto:info@asseton.nl?subject=' + tabs[i].dataset.subject;
  const d = docs[i];
  d.classList.remove('vac-in');
  if (animate && !reduced) { void d.offsetWidth; d.classList.add('vac-in'); }
  return true;
};
const top = el => {
  const cs = getComputedStyle(el);
  let dy = 0;
  try { dy = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform).m42 || 0; } catch (_) {}
  return el.getBoundingClientRect().top + scrollY - dy - (parseFloat(cs.scrollMarginTop) || 0);
};
// after a switch deep inside a vacancy, start the new one from its title
const toStart = () => {
  const d = docs[cur];
  const m = parseFloat(getComputedStyle(d).scrollMarginTop) || 0;
  if (d.getBoundingClientRect().top < m - 2) scrollTo({ top: Math.max(0, top(d)), behavior: reduced ? 'auto' : 'smooth' });
};
const docOf = id => {
  const el = id ? document.getElementById(id) : null;
  return el ? docs.findIndex(d => d.contains(el)) : -1;
};

// Start: a link on this site (home -> werken-bij.html#servicemonteur-elektrotechniek) opens that vacancy and scrolls to it
// (the head script kept the #fragment in window.__asGoto; site.js scrolls again on load).
// A pasted or shared link only preselects its vacancy: the page still opens at the top.
const goto = typeof window.__asGoto === 'string' ? window.__asGoto : '';
let start = docOf(goto);
if (start < 0) {
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    const h = nav && nav.name.indexOf('#') >= 0 ? decodeURIComponent(nav.name.split('#')[1]) : '';
    start = docOf(h);
  } catch (_) { start = -1; }
}
select(start < 0 ? 0 : start, false);
vac.classList.add('is-tabs');
if (railCta) railCta.hidden = false;
if (goto && docOf(goto) >= 0) {
  const el = document.getElementById(goto);
  const root = document.documentElement, prev = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto'; scrollTo(0, Math.max(0, top(el))); root.style.scrollBehavior = prev;
}

// While the open vacancy's 04 panel ("Klaar voor deze uitdaging?") is on screen it already offers "Solliciteer nu!" and the phone
// number, so the rail's copy of those buttons fades out (>=1025) and the fixed "Storing melden" pill steps aside instead of
// sitting on the page's last buttons (phone). site.js keeps hiding the pill over the footer; an open or focused pill stays.
const applies = docs.map(d => d.querySelector('.vac-apply')).filter(Boolean);
const sos = document.getElementById('sos');
const sosPanel = document.getElementById('sosPanel');
if (applies.length && 'IntersectionObserver' in window) {
  const seen = new Set();
  const sync = () => {
    const on = seen.size > 0;
    vac.classList.toggle('is-applying', on);
    if (sos) sos.classList.toggle('wb-away', on && (!sosPanel || sosPanel.hidden));
  };
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
    sync();
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
  applies.forEach(a => io.observe(a));
  if (sosPanel && 'MutationObserver' in window) new MutationObserver(sync).observe(sosPanel, { attributes: true, attributeFilter: ['hidden'] });
}

tabs.forEach((t, i) => {
  t.addEventListener('click', e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab / window: a normal link
    e.preventDefault();
    if (select(i, true)) toStart();
  });
  t.addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let n;
    if (d) n = (cur + d + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    else if (e.key === ' ' || e.key === 'Spacebar') n = i;
    else return;
    e.preventDefault();
    if (select(n, true)) toStart();
    tabs[n].focus();
  });
});
})();
