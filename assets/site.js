(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const mm = q => (window.matchMedia ? window.matchMedia(q) : { matches: false });
const onMQ = (mq, fn) => { if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); };
const reduced = mm('(prefers-reduced-motion: reduce)').matches;
const hasIO = 'IntersectionObserver' in window;

// ---- Storing melden (SOS) state, declared first: the nav closes it
const sos = $('#sos');
const sosBtn = $('#sosBtn');
const sosPanel = $('#sosPanel');
let contactOnScreen = false;
let footOnScreen = false;
// phones, subpages: the first screen is the page's hero/intro, and the pill would cover its text or buttons.
// It slides in once the visitor scrolls (the home hero keeps room for it in its bottom padding).
const isHome = document.body.dataset.page === 'home';
const heroEl = isHome ? document.querySelector('main > .hero') : null;
function sosHasFocus() {
  const a = document.activeElement;
  // a link inside the just-closed (display:none) panel does not count as focus
  return !!a && a !== document.body && sos.contains(a) && a.getClientRects().length > 0;
}
function syncSos() {
  if (!sos || !sosPanel) return;
  // "Storing melden" must be pressable everywhere (Tarik): it only steps aside where the page itself shows the phone number
  sos.classList.toggle('is-away', (contactOnScreen || footOnScreen) && sosPanel.hidden && !sosHasFocus());
  // home: the full label while the pill sits on the hero (empty corner); elsewhere it tucks into the round e-stop (site.css)
  sos.classList.toggle('is-wide', !!heroEl && heroEl.getBoundingClientRect().bottom > innerHeight - 110);
}
function setSos(open) {
  if (!sos || !sosBtn || !sosPanel) return;
  sosPanel.hidden = !open;
  sosBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    setNav(false);
    const first = sosPanel.querySelector('a');
    if (first) first.focus();
  }
  syncSos();
}

// ---- Mobile nav
const toggle = $('#navToggle');
const nav = $('#nav');
const scrim = $('#navScrim');
function setNav(open) {
  if (!toggle || !nav) return;
  nav.classList.toggle('open', open);
  if (scrim) scrim.hidden = !open;
  document.documentElement.classList.toggle('nav-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
}
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = !nav.classList.contains('open');
    setNav(open);
    if (open) setSos(false);
  });
  $$('a', nav).forEach(a => a.addEventListener('click', () => setNav(false)));
  // keyboard: Tab out of the open sheet (or Shift+Tab off the toggle) closes it
  const navFocusOut = e => {
    const to = e.relatedTarget;
    if (nav.classList.contains('open') && to && !nav.contains(to) && to !== toggle) setNav(false);
  };
  nav.addEventListener('focusout', navFocusOut);
  toggle.addEventListener('focusout', navFocusOut);
  if (scrim) scrim.addEventListener('click', () => setNav(false));
  document.addEventListener('click', e => {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) setNav(false);
  });
  onMQ(mm('(max-width: 860px)'), e => { if (!e.matches) setNav(false); });
}

// ---- Hero video: fade in once playing, pause/play toggle, respect reduced motion
const heroVideo = $('#heroVideo');
const heroToggle = $('#heroToggle');
if (heroVideo && heroToggle) {
  const setPaused = paused => {
    heroToggle.classList.toggle('paused', paused);
    heroToggle.setAttribute('aria-label', paused ? 'Video afspelen' : 'Video pauzeren');
  };
  const markReady = () => { if (heroVideo.paused) return; heroVideo.classList.add('ready'); setPaused(false); };
  heroVideo.addEventListener('playing', markReady);
  heroVideo.addEventListener('timeupdate', () => { if (!heroVideo.classList.contains('ready')) markReady(); });
  heroVideo.addEventListener('pause', () => setPaused(true));
  if (reduced) {
    // stays paused and hidden: the hero shows the poster background until the visitor presses play
    heroVideo.removeAttribute('autoplay');
    heroVideo.pause();
    setPaused(true);
  } else {
    // autoplay may already have started before this script ran: check the state that exists now
    markReady();
    const p = heroVideo.play();
    if (p && p.then) p.then(markReady, () => setPaused(true));
  }
  let userPaused = false;
  heroToggle.addEventListener('click', () => {
    if (heroVideo.paused) { userPaused = false; const p = heroVideo.play(); if (p && p.catch) p.catch(() => setPaused(true)); }
    else { userPaused = true; heroVideo.pause(); }
  });
  // if the phone blocked autoplay (e.g. iOS Low Power Mode), start on the first tap anywhere
  if (!reduced) {
    const kick = e => {
      if (heroToggle.contains(e.target)) return;
      if (!heroVideo.paused || userPaused) { off(); return; }
      const p = heroVideo.play(); if (p && p.then) p.then(off, () => {}); else off();
    };
    const evs = ['touchstart', 'pointerdown', 'keydown'];
    const off = () => evs.forEach(ev => removeEventListener(ev, kick, true));
    evs.forEach(ev => addEventListener(ev, kick, { capture: true, passive: true }));
    // a video paused by the browser (not by the visitor) resumes when the page is shown again
    document.addEventListener('visibilitychange', () => { if (!document.hidden && heroVideo.paused && !userPaused) heroVideo.play().catch(() => {}); });
  }
}

// ---- SOS: open/close, Escape, outside click, contact preset, hide over Contact
if (sos && sosBtn && sosPanel) {
  sosBtn.addEventListener('click', () => setSos(sosPanel.hidden));
  document.addEventListener('click', e => { if (!sosPanel.hidden && !sos.contains(e.target)) setSos(false); });
  $$('a', sosPanel).forEach(a => a.addEventListener('click', () => setSos(false)));
  sos.addEventListener('focusin', syncSos);
  sos.addEventListener('focusout', e => {
    // keyboard: tabbing out of the open panel closes it (non-modal dialog)
    const to = e.relatedTarget;
    if (!sosPanel.hidden && to && !sos.contains(to)) setSos(false);
    setTimeout(syncSos, 0);
  });
  const contactSec = $('#contact');
  if (contactSec && hasIO) {
    new IntersectionObserver(([e]) => {
      contactOnScreen = e.isIntersecting;
      syncSos();
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0 }).observe(contactSec);
  }
  // footer (contact details + brand lockup): the pill would sit on the wordmark tagline on short viewports
  const footEl = $('footer');
  if (footEl && hasIO) {
    new IntersectionObserver(([e]) => {
      footOnScreen = e.isIntersecting;
      syncSos();
    }, { threshold: 0 }).observe(footEl);
  }
}
const sosForm = $('#sosForm');
const mqStack = mm('(max-width: 860px)');
if (sosForm) sosForm.addEventListener('click', e => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab / window: a normal link
  const dienst = $('#dienst');
  if (dienst) dienst.value = 'Storingen & onderhoud';
  else { try { sessionStorage.setItem('asseton-dienst', 'Storingen & onderhoud'); } catch (_) {} return; }
  // Stacked layout: the form sits below the contact rows, so land on the form itself
  const cf = $('#contactForm');
  const stacked = mqStack.matches && !!cf;
  if (stacked) {
    e.preventDefault();
    // measure without the pending reveal offset (translateY) so the form lands under the header
    const cs = getComputedStyle(cf);
    let dy = 0;
    try { dy = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform).m42 || 0; } catch (_) {}
    const top = cf.getBoundingClientRect().top + scrollY - dy - (parseFloat(cs.scrollMarginTop) || 0);
    scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  }
  setTimeout(() => { const naam = $('#naam'); if (naam) naam.focus({ preventScroll: true }); }, stacked && !reduced ? 650 : 400);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (sosPanel && !sosPanel.hidden) { setSos(false); if (sosBtn) sosBtn.focus(); syncSos(); }
  else if (nav && nav.classList.contains('open')) { setNav(false); if (toggle) toggle.focus(); }
});

// ---- Service disclosures (<=860px): first row per list open, rest closed
const mqSvc = mm('(max-width: 860px)');
const svcLists = $$('.svc-list');
const applySvc = () => {
  svcLists.forEach(list => {
    $$('.svc', list).forEach((svc, i) => {
      const btn = $('.svc-btn', svc);
      const body = $('.svc-body', svc);
      if (!btn) return;
      if (mqSvc.matches) {
        if (!svc.dataset.ready) { svc.classList.toggle('is-closed', i > 0); svc.dataset.ready = '1'; }
        btn.disabled = false;
        btn.removeAttribute('role');
        btn.removeAttribute('tabindex');
        if (body && body.id) btn.setAttribute('aria-controls', body.id);
        btn.setAttribute('aria-expanded', String(!svc.classList.contains('is-closed')));
      } else {
        // Desktop: always open, so the title is plain heading text, not an inert control
        btn.disabled = true;
        btn.setAttribute('role', 'presentation');
        btn.setAttribute('tabindex', '-1');
        btn.removeAttribute('aria-expanded');
        btn.removeAttribute('aria-controls');
      }
    });
  });
};
svcLists.forEach(list => $$('.svc', list).forEach(svc => {
  const btn = $('.svc-btn', svc);
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!mqSvc.matches) return;
    const closed = svc.classList.toggle('is-closed');
    btn.setAttribute('aria-expanded', String(!closed));
  });
}));
applySvc();
onMQ(mqSvc, applySvc);

// ---- Word-rise headings (headings only)
$$('.head2 h2, .h2-solo, .contact-info h2, .statement .st-line').forEach(el => {
  // words in order; an explicit <br> (e.g. the statement's phone break) is kept where it was
  const parts = [];
  el.childNodes.forEach(n => {
    if (n.nodeName === 'BR') parts.push(n);
    else n.textContent.split(/\s+/).filter(Boolean).forEach(w => parts.push(w));
  });
  const words = parts.filter(p => typeof p === 'string');
  el.textContent = '';
  let i = 0;
  parts.forEach(p => {
    if (typeof p !== 'string') { el.appendChild(p); return; }
    const outer = document.createElement('span'); outer.className = 'w';
    const inner = document.createElement('span'); inner.textContent = p;
    inner.style.transitionDelay = (i * 45) + 'ms';
    outer.appendChild(inner); el.appendChild(outer);
    if (++i < words.length) el.appendChild(document.createTextNode(' '));
  });
});

// ---- Reveal on scroll (final state immediately under reduced motion)
const revealEls = $$('.reveal');
if (hasIO && !reduced) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  revealEls.forEach(el => io.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('in'));
}

// ---- Live-wire section index + nav scroll-spy
const spySecs = $$('main section[id]');
const linkFor = { diensten: '#diensten', onderhoud: '#diensten', projecten: 'projecten.html', 'over-ons': '#over-ons', 'werken-bij': 'werken-bij.html' };
const navLinks = nav && document.body.dataset.page === 'home' ? $$('a:not(.nav-cta)', nav) : [];
const light = sec => { const tag = sec && $('.sec-top', sec); if (tag) tag.classList.add('lit'); };
let activeId = null;
const setActive = sec => {
  const id = sec ? sec.id : null;
  if (sec) light(sec);
  if (id === activeId) return;
  activeId = id;
  const href = id ? linkFor[id] : null;
  navLinks.forEach(a => {
    const on = !!href && a.getAttribute('href') === href;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  });
};
const atEnd = () => innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
const spyEnd = () => {
  if (!atEnd()) return false;
  let pick = null;
  spySecs.forEach(s => { if (s.getBoundingClientRect().top <= innerHeight * 0.45) pick = s; });
  if (pick) setActive(pick);
  return !!pick;
};
if (reduced || !hasIO) spySecs.forEach(light);
if (hasIO && spySecs.length) {
  const inBand = new Set();
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) inBand.add(e.target); else inBand.delete(e.target); });
    if (spyEnd()) return;
    let cur = null;
    spySecs.forEach(s => { if (inBand.has(s)) cur = s; });
    setActive(cur);
  }, { rootMargin: '-40% 0px -55% 0px' });
  spySecs.forEach(s => spy.observe(s));
}

// ---- Power line: fills as you scroll (+ scroll-spy end-of-page fallback)
const powerLine = $('#powerLine');
let tick = false;
const onScrollFrame = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  if (powerLine) powerLine.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  spyEnd();
  syncSos();
  tick = false;
};
const queueFrame = () => { if (!tick) { tick = true; requestAnimationFrame(onScrollFrame); } };
addEventListener('scroll', queueFrame, { passive: true });
addEventListener('resize', queueFrame, { passive: true });
onScrollFrame();

const year = $('#year');
if (year) year.textContent = new Date().getFullYear();

// ---- Footer wordmark: sized by CSS (the SVG is width:100%), powers on when it enters view
const footMark = $('.foot-mark');
if (footMark) {
  if (reduced || !hasIO) footMark.classList.add('on');
  else {
    const fio = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { footMark.classList.add('on'); fio.disconnect(); }
    }, { threshold: 0.4 });
    fio.observe(footMark);
  }
}

// ---- Contact form: opens a pre-filled e-mail until a form backend is connected
const form = $('#contactForm');
if (form) form.addEventListener('submit', e => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const d = new FormData(form);
  const body = [
    `Naam: ${d.get('naam')}`,
    `Telefoon: ${d.get('telefoon')}`,
    `E-mail: ${d.get('email')}`,
    `Dienst: ${d.get('diensten')}`,
    '',
    d.get('bericht')
  ].join('\n');
  window.location.href = `mailto:info@asseton.nl?subject=${encodeURIComponent('Aanvraag via website: ' + d.get('diensten'))}&body=${encodeURIComponent(body)}`;
});
})();

// ---- Start position + in-page links.
// A fresh visit or a reload opens at the top (the hero on the home page), unless a link on this site asked for a section
// (e.g. Projecten -> index.html#contact; the head script keeps it in window.__asGoto). Pasted/stale #fragments open at the top.
// Back/Forward returns to where the visitor was: the bfcache keeps the position by itself; otherwise it is restored
// from sessionStorage (saved per history entry on pagehide). Stops once the visitor interacts.
// After a jump (link on this page, or arrival from another page) keyboard focus moves to the target, so Tab continues from there.
(() => {
  const goto = typeof window.__asGoto === 'string' ? window.__asGoto : '';
  // "Storing melden" from a subpage: preset the service in the contact form
  let preset = '';
  try { preset = sessionStorage.getItem('asseton-dienst') || ''; sessionStorage.removeItem('asseton-dienst'); } catch (_) {}
  const dienst = document.getElementById('dienst');
  if (preset && dienst && goto === 'contact') dienst.value = preset;
  let touched = false;
  ['touchstart', 'wheel', 'keydown', 'pointerdown'].forEach(ev => addEventListener(ev, () => { touched = true; }, { once: true, passive: true, capture: true }));
  const reducedMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const jumpTo = top => {
    const root = document.documentElement, prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto'; scrollTo(0, Math.max(0, top)); root.style.scrollBehavior = prev;
  };
  // focus without scrolling; a section/heading/panel becomes focusable for this (tabindex=-1, no ring: .jump-target)
  const focusTarget = el => {
    if (!el || !el.getClientRects().length) return;
    if (!el.matches('a[href],button:not([disabled]),input,select,textarea,[tabindex]')) { el.setAttribute('tabindex', '-1'); el.classList.add('jump-target'); }
    try { el.focus({ preventScroll: true }); } catch (_) {}
  };

  // Back/Forward: one id per history entry (kept in history.state), scroll position per id in sessionStorage
  const stamp = () => {
    const s = history.state && typeof history.state === 'object' ? history.state : {};
    if (s.asId) return;
    try { history.replaceState(Object.assign({}, s, { asId: Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }), ''); } catch (_) {}
  };
  const keyOf = () => (history.state && history.state.asId ? 'asseton-y:' + history.state.asId : '');
  let restoreY = 0;
  try {
    const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    const k = keyOf();
    if (!goto && nav && nav.type === 'back_forward' && k) restoreY = Math.max(0, parseInt(sessionStorage.getItem(k), 10) || 0);
  } catch (_) {}
  stamp();
  addEventListener('pagehide', () => { const k = keyOf(); if (k) try { sessionStorage.setItem(k, String(Math.round(scrollY))); } catch (_) {} });

  const target = () => {
    if (!goto) return null;
    // stacked contact layout: the form sits below the contact rows, so land on the form when it was preset
    if (goto === 'contact' && preset && window.matchMedia && matchMedia('(max-width: 860px)').matches) return document.getElementById('contactForm') || document.getElementById(goto);
    return document.getElementById(goto);
  };
  const settle = () => {
    if (touched) return;
    const el = target();
    if (!el) { if (Math.abs(scrollY - restoreY) > 1) jumpTo(restoreY); return; }
    const cs = getComputedStyle(el);
    let dy = 0;
    try { dy = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform).m42 || 0; } catch (_) {}
    jumpTo(el.getBoundingClientRect().top + scrollY - dy - (parseFloat(cs.scrollMarginTop) || 0));
  };
  settle();
  addEventListener('load', () => { settle(); setTimeout(settle, 0); });
  // arrival from another page: focus the target once the page scripts ran (a preset "Storing melden" lands in the form)
  const arrive = () => {
    const el = target();
    const a = document.activeElement;
    if (!el || (a && a !== document.body)) return;
    const naam = document.getElementById('naam');
    focusTarget(goto === 'contact' && preset && naam ? naam : el);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', arrive, { once: true }); else arrive();
  // a #fragment typed into the address bar never jumps the page: strip it, back to the top
  addEventListener('hashchange', () => {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
    stamp();
    jumpTo(0);
  });

  // in-page links: smooth scroll to the target (under the sticky header), then move keyboard focus there.
  // Modified clicks (new tab / window) and links a page script already handled are left alone.
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a || a.classList.contains('skip')) return;
    const id = a.getAttribute('href').slice(1);
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    e.preventDefault();
    const top = id === 'top' ? 0 : el.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : 'smooth' });
    focusTarget(el);
  });
})();
