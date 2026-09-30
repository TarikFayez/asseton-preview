// Asseton: Projecten page. Hero photo show, compare frames (Voor / Tijdens / Na), one accessible lightbox for every project
// photo, and the Meer projecten index (type filter + "Lees meer" for clamped texts). Loads after site.js; everything here is null-safe.
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const mm = q => (window.matchMedia ? window.matchMedia(q) : { matches: false });
const onMQ = (mq, fn) => { if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); };
const reducedMQ = mm('(prefers-reduced-motion: reduce)');
const phone = mm('(max-width: 600px)');
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---- Photo sets: one per project ([data-lb-set]); items in DOM order (visible <img> or a hidden <span> extra)
// An extra can carry data-lb-crop="x0 y0 x1 y1" (fractions of the photo, one axis at a time): the lightbox then shows
// only that part (used to keep an old company van at the edge of a photo out of view).
const sets = new Map();
const cropOf = n => {
  const c = (n.dataset.lbCrop || '').trim().split(/\s+/).map(Number);
  return c.length === 4 && c.every(v => v >= 0 && v <= 1) && c[2] > c[0] && c[3] > c[1] ? c : null;
};
const itemsOf = host => {
  if (!sets.has(host)) {
    sets.set(host, $$('[data-lb]', host).map(n => n.tagName === 'IMG'
      ? { node: n, src: n.getAttribute('src'), w: +n.getAttribute('width') || 0, h: +n.getAttribute('height') || 0, alt: n.getAttribute('alt') || '', label: n.dataset.lbLabel || '', crop: cropOf(n) }
      : { node: n, src: n.dataset.lbSrc, w: +n.dataset.lbW || 0, h: +n.dataset.lbH || 0, alt: n.dataset.lbAlt || '', label: n.dataset.lbLabel || '', crop: cropOf(n) }));
  }
  return sets.get(host);
};

// ---- Lightbox (native modal <dialog>: the page behind is inert; focus is also kept inside by hand)
const lb = $('#lb');
const lbImg = $('#lbImg');
const lbStage = $('#lbStage');
const lbNum = $('#lbNum');
const lbTot = $('#lbTot');
const lbChip = $('#lbChip');
const lbTitle = $('#lbTitle');
const lbTag = $('#lbTag');
const lbSr = $('#lbSr');
const lbClose = $('#lbClose');
const lbPrev = $('#lbPrev');
const lbNext = $('#lbNext');
let list = [], idx = 0, seq = 0, returnTo = null, isOpen = false;

const lockScroll = on => {
  const root = document.documentElement;
  if (on) {
    const sbw = window.innerWidth - root.clientWidth;
    if (sbw > 0) document.body.style.paddingRight = sbw + 'px';
    root.classList.add('lb-open');
  } else {
    root.classList.remove('lb-open');
    document.body.style.paddingRight = '';
  }
};
const preload = i => { const it = list[(i + list.length) % list.length]; if (it) { const im = new Image(); im.src = it.src; } };
// a cropped photo: the <img> becomes a box with the crop's shape (contained in the stage) and object-fit:cover
// with object-position shows exactly the cropped part; any other photo fills the stage (object-fit:contain, from the CSS)
const CROP_PROPS = ['top', 'left', 'right', 'bottom', 'width', 'height', 'objectFit', 'objectPosition'];
function fitCrop(it) {
  const st = lbImg.style;
  if (!it || !it.crop || !it.w || !it.h) { CROP_PROPS.forEach(k => { st[k] = ''; }); return; }
  const [x0, y0, x1, y1] = it.crop;
  const cw = it.w * (x1 - x0), ch = it.h * (y1 - y0);
  const sw = lbStage.clientWidth, sh = lbStage.clientHeight;
  if (!sw || !sh) return;
  const k = Math.min(sw / cw, sh / ch), bw = cw * k, bh = ch * k;
  const pos = (a, b) => (b - a < 1 ? (a / (1 - (b - a))) * 100 : 50);
  Object.assign(st, { top: (sh - bh) / 2 + 'px', left: (sw - bw) / 2 + 'px', right: 'auto', bottom: 'auto', width: bw + 'px', height: bh + 'px', objectFit: 'cover', objectPosition: `${pos(x0, x1)}% ${pos(y0, y1)}%` });
}

function show(i, dir) {
  if (!list.length) return;
  idx = (i + list.length) % list.length;
  const it = list[idx];
  const token = ++seq;
  lbNum.textContent = String(idx + 1);
  lbTot.textContent = String(list.length);
  lbChip.textContent = it.label;
  // spoken with the caption (aria-live), so moving between two 'Voor' photos is still announced
  if (lbSr) lbSr.textContent = list.length > 1 ? `Foto ${idx + 1} van ${list.length}. ` : '';
  lbChip.className = 'lb-chip label' + (it.label === 'Na' ? ' is-na' : it.label === 'Tijdens' ? ' is-tijdens' : '');
  const swap = () => {
    if (token !== seq) return;
    lbImg.src = it.src;
    lbImg.alt = it.alt;
    if (it.w && it.h) { lbImg.width = it.w; lbImg.height = it.h; }
    fitCrop(it);
    lbImg.style.transform = '';
    lbImg.classList.remove('is-out', 'is-drag');
  };
  if (!dir || reducedMQ.matches) { swap(); }
  else {
    lbImg.style.setProperty('--dir', String(dir));
    lbImg.style.transform = '';
    lbImg.classList.remove('is-drag');
    lbImg.classList.add('is-out');
    const pre = new Image();
    pre.src = it.src;
    const ready = pre.decode ? pre.decode().catch(() => {}) : new Promise(r => { pre.onload = pre.onerror = r; });
    Promise.all([ready, wait(170)]).then(swap);
  }
  preload(idx + 1); preload(idx - 1);
}

// viaPointer: opened by a click or tap. The close button then takes focus without a keyboard focus ring
// (a tap on a non-focusable photo would otherwise make Chrome draw one); keyboard opens keep the ring.
function openLb(host, start, trigger, viaPointer) {
  if (!lb || !host) return;
  list = itemsOf(host);
  if (!list.length) return;
  returnTo = trigger || document.activeElement;
  lbTitle.textContent = host.dataset.lbTitle || '';
  lbTag.textContent = host.dataset.lbTag || '';
  lb.classList.toggle('is-single', list.length < 2);
  lockScroll(true);
  if (typeof lb.showModal === 'function') { if (!lb.open) lb.showModal(); }
  else lb.setAttribute('open', '');
  isOpen = true;
  show(start || 0, 0);
  // showModal() has already focused the close button with the browser's own ring heuristics; re-focus it quietly
  if (viaPointer) { lbClose.blur(); try { lbClose.focus({ focusVisible: false }); } catch (_) { lbClose.focus(); } }
  else lbClose.focus();
}
function closeLb() {
  if (!lb || !isOpen) return;
  isOpen = false;
  seq++;
  if (typeof lb.close === 'function' && lb.open) lb.close(); else lb.removeAttribute('open');
  lockScroll(false);
  const back = returnTo;
  returnTo = null;
  if (back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
}

if (lb && lbImg && lbStage) {
  lbClose.addEventListener('click', closeLb);
  lbPrev.addEventListener('click', () => show(idx - 1, -1));
  lbNext.addEventListener('click', () => show(idx + 1, 1));
  // Escape: the dialog's own cancel, routed through closeLb (scroll unlock + focus return)
  lb.addEventListener('cancel', e => { e.preventDefault(); closeLb(); });
  lb.addEventListener('close', () => { if (isOpen) { isOpen = false; lockScroll(false); } });
  lb.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeLb(); return; }
    if (e.key === 'Tab') {
      const f = [lbClose, lbPrev, lbNext].filter(b => b.getClientRects().length > 0 && getComputedStyle(b).visibility !== 'hidden'); // (offsetParent is null for the fixed phone arrows)
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !lb.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !lb.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      return;
    }
    if (list.length < 2) return;
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (k) { e.preventDefault(); show(idx + k, k); }
    else if (e.key === 'Home') { e.preventDefault(); show(0, -1); }
    else if (e.key === 'End') { e.preventDefault(); show(list.length - 1, 1); }
  });
  // Swipe (touch / pen): the photo follows the finger, a flick of 50px changes photo
  let sx = 0, sy = 0, dx = 0, pid = null, horiz = null;
  lbStage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || list.length < 2 || e.target.closest('.lb-nav')) return;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; dx = 0; horiz = null;
  });
  lbStage.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const mx = e.clientX - sx, my = e.clientY - sy;
    if (horiz === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      horiz = Math.abs(mx) > Math.abs(my);
      if (horiz) { try { lbStage.setPointerCapture(pid); } catch (_) {} }
    }
    if (!horiz) return;
    dx = mx;
    if (!reducedMQ.matches) { lbImg.classList.add('is-drag'); lbImg.style.transform = `translateX(${dx}px)`; }
  });
  const endSwipe = e => {
    if (e.pointerId !== pid) return;
    pid = null;
    if (horiz && Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    else { lbImg.classList.remove('is-drag'); lbImg.style.transform = ''; }
    horiz = null;
  };
  lbStage.addEventListener('pointerup', endSwipe);
  lbStage.addEventListener('pointercancel', endSwipe);
  addEventListener('resize', () => { if (isOpen) fitCrop(list[idx]); });
}

// ---- Hero: the project photos cross-fade in DOM order; each photo lights its item in the index along the bottom
// (data-ix). The lit item's orange line runs for --dur and its animationend moves the show on, so pausing the line
// (animation-play-state) pauses everything: toggle, pointer on the index, keyboard focus in the index, hero off screen,
// tab hidden. Reduced motion: the first photo stays, no zoom, no toggle.
const hero = $('[data-hero]');
if (hero) {
  const slides = $$('.pj-slide', hero);
  const ixItems = $$('.pjx-list li', hero);
  const toggle = $('#pjToggle', hero);
  const ixNav = $('.pjx', hero);
  let cur = Math.max(0, slides.findIndex(s => s.classList.contains('is-on')));
  let userPaused = false, overIx = false, focusIx = false, offscreen = false, busy = false, prevTimer = 0;
  const lightIx = sl => ixItems.forEach(li => li.classList.toggle('is-on', li.dataset.ix === sl.dataset.ix));
  const sync = () => hero.classList.toggle('is-paused', userPaused || overIx || focusIx || offscreen || document.hidden);
  const ready = img => (!img || (img.complete && img.naturalWidth)) ? Promise.resolve()
    : new Promise(r => { img.loading = 'eager'; img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); setTimeout(r, 4000); });
  const go = n => {
    const from = slides[cur], to = slides[n];
    if (!to || to === from) return;
    clearTimeout(prevTimer);
    slides.forEach(s => s.classList.remove('is-prev'));
    from.classList.remove('is-on');
    from.classList.add('is-prev');
    to.classList.add('is-on');
    cur = n;
    lightIx(to);
    prevTimer = setTimeout(() => from.classList.remove('is-prev'), 1800);
  };
  const running = () => hero.classList.contains('is-running');
  hero.addEventListener('animationend', e => {
    if (e.animationName !== 'pjFill' || busy || !running()) return;
    const li = e.target.closest('li');
    if (!li || !li.classList.contains('is-on')) return;
    const n = (cur + 1) % slides.length;
    busy = true;
    ready($('img', slides[n])).then(() => { busy = false; if (running()) go(n); });
  });
  const setUserPaused = on => {
    userPaused = on;
    if (toggle) {
      toggle.classList.toggle('paused', on);
      toggle.setAttribute('aria-label', on ? 'Foto’s afspelen' : 'Foto’s pauzeren');
    }
    sync();
  };
  const start = () => {
    if (slides.length < 2 || reducedMQ.matches) return;
    hero.classList.add('is-running');
    if (toggle) toggle.hidden = false;
    sync();
  };
  const stop = () => {
    hero.classList.remove('is-running', 'is-paused');
    if (toggle) toggle.hidden = true;
  };
  lightIx(slides[cur]);
  if (toggle) toggle.addEventListener('click', () => setUserPaused(!userPaused));
  if (ixNav) {
    ixNav.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { overIx = true; sync(); } });
    ixNav.addEventListener('pointerleave', () => { overIx = false; sync(); });
    ixNav.addEventListener('focusin', () => { focusIx = true; sync(); });
    ixNav.addEventListener('focusout', e => { focusIx = !!(e.relatedTarget && ixNav.contains(e.relatedTarget)); sync(); });
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { offscreen = !e.isIntersecting; sync(); }).observe(hero);
  document.addEventListener('visibilitychange', sync);
  onMQ(reducedMQ, e => { if (e.matches) stop(); else start(); });
  start();
}

// ---- Compare frames: pick a side (click/tap it, or the view switch) to enlarge it; click the enlarged side for full screen.
// Phones: the photos stack, a tap opens full screen straight away.
$$('[data-cmp]').forEach(cmp => {
  const host = cmp.closest('[data-lb-set]');
  const panes = $$('.cmp-pane', cmp);
  const bar = host ? $('.cmp-bar', host) : null;
  const radios = bar ? $$('[role="radio"]', bar) : [];
  const full = bar ? $('.cmp-full', bar) : null;
  if (!host || !panes.length) return;
  let view = 'alle';
  const setView = (v, moveFocus) => {
    view = v;
    cmp.classList.toggle('has-focus', v !== 'alle');
    panes.forEach(p => p.classList.toggle('is-focus', p.dataset.pane === v));
    radios.forEach(r => {
      const on = r.dataset.view === v;
      r.setAttribute('aria-checked', String(on));
      r.tabIndex = on ? 0 : -1;
      if (on && moveFocus) r.focus();
    });
  };
  const indexOf = pane => {
    const img = pane && $('img[data-lb]', pane);
    return Math.max(0, itemsOf(host).findIndex(it => it.node === img));
  };
  panes.forEach(p => p.addEventListener('click', e => {
    if (phone.matches || view === p.dataset.pane) openLb(host, indexOf(p), full, e.detail > 0);
    else setView(p.dataset.pane);
  }));
  radios.forEach((r, i) => {
    r.addEventListener('click', () => setView(r.dataset.view));
    r.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      let n;
      if (d) n = (i + d + radios.length) % radios.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = radios.length - 1;
      else if (e.key === 'Escape' && view !== 'alle') { e.preventDefault(); setView('alle', true); return; }
      else return;
      e.preventDefault();
      setView(radios[n].dataset.view, true);
    });
  });
  // full screen starts at the enlarged side, or at the first side of this frame (a case can have photos before it)
  if (full) full.addEventListener('click', e => {
    const p = panes.find(x => x.dataset.pane === view) || panes[0];
    openLb(host, indexOf(p), full, e.detail > 0);
  });
  // entering the phone layout (photos stacked): back to the neutral view
  onMQ(phone, e => { if (e.matches) setView('alle'); });
});

// ---- Photo buttons (single photos, Meer projecten thumbnails): open that project's photos at the photo that was hit.
// A Voor & na thumbnail is one button with two halves: a click on the Na half starts at Na; the keyboard starts at Voor.
$$('[data-lb-open]').forEach(btn => btn.addEventListener('click', e => {
  const host = btn.closest('[data-lb-set]');
  if (!host) return;
  const half = e.target && e.target.closest ? e.target.closest('.mp-half') : null;
  const img = $('img[data-lb]', half && btn.contains(half) ? half : btn);
  openLb(host, Math.max(0, itemsOf(host).findIndex(it => it.node === img)), btn, e.detail > 0);
}));

// ---- Meer projecten: long texts are clamped where the row is narrow; "Lees meer" only appears when text is cut off
const clamps = $$('.mp-p').map(p => ({ p, btn: p.parentElement ? $('.mp-toggle', p.parentElement) : null })).filter(c => c.btn);
const checkClamps = () => clamps.forEach(({ p, btn }) => {
  if (p.classList.contains('is-open') || !p.getClientRects().length) return;
  p.classList.add('is-clamp');
  btn.hidden = !(p.scrollHeight > p.clientHeight + 2);
});
clamps.forEach(({ p, btn }) => btn.addEventListener('click', () => {
  const open = p.classList.toggle('is-open');
  btn.setAttribute('aria-expanded', String(open));
  const t = $('span', btn);
  if (t) t.textContent = open ? 'Lees minder' : 'Lees meer';
}));
checkClamps();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(checkClamps);
let rz = 0;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(checkClamps, 150); });

// ---- Meer projecten: filter by type (Alle / Techniek / Voor & na: the same words as the labels on the rows).
// Rows that leave fade out, the rows that stay slide to their new place (FLIP), rows that come back rise in.
// Reduced motion: the list just changes.
const mpList = $('.mp-list');
const fBtns = $$('[data-filter]');
const mpStatus = $('#mpStatus');
if (mpList && fBtns.length) {
  const items = $$('.mp-item', mpList);
  const match = (it, f) => f === 'alle' || it.dataset.type === f;
  fBtns.forEach(b => { const c = $('.mp-c', b); if (c) c.textContent = String(items.filter(it => match(it, b.dataset.filter)).length); });
  let cur = (fBtns.find(b => b.getAttribute('aria-pressed') === 'true') || fBtns[0]).dataset.filter;
  let fseq = 0;
  const reset = it => { it.classList.remove('is-leaving', 'is-entering'); it.style.transform = ''; it.style.transition = ''; it.style.transitionDelay = ''; };
  const apply = f => {
    if (f === cur) return;
    cur = f;
    const token = ++fseq;
    fBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
    const n = items.filter(it => match(it, f)).length;
    if (mpStatus) mpStatus.textContent = n === 1 ? '1 project' : `${n} projecten`;
    if (reducedMQ.matches) {
      items.forEach(it => { reset(it); it.hidden = !match(it, f); if (!it.hidden) it.classList.add('in'); });
      checkClamps();
      return;
    }
    const leaving = items.filter(it => !it.hidden && !match(it, f));
    leaving.forEach(it => { it.style.transitionDelay = ''; it.classList.remove('is-entering'); it.classList.add('is-leaving'); });
    wait(leaving.length ? 200 : 0).then(() => {
      if (token !== fseq) return;
      const first = new Map(items.filter(it => !it.hidden && !it.classList.contains('is-leaving')).map(it => [it, it.getBoundingClientRect().top]));
      items.forEach(it => { reset(it); it.hidden = !match(it, f); });
      let k = 0;
      items.forEach(it => {
        if (it.hidden) return;
        it.classList.add('in');
        const top0 = first.get(it);
        if (top0 === undefined) { it.classList.add('is-entering'); it.style.transitionDelay = `${k++ * 70}ms`; return; }
        const dy = top0 - it.getBoundingClientRect().top;
        if (Math.abs(dy) > 1) { it.style.transition = 'none'; it.style.transform = `translateY(${dy}px)`; }
      });
      checkClamps();
      void mpList.offsetHeight; // commit the start positions before animating to the end
      requestAnimationFrame(() => {
        if (token !== fseq) return;
        items.forEach(it => { if (it.hidden) return; it.style.transition = ''; it.style.transform = ''; it.classList.remove('is-entering'); });
        setTimeout(() => { if (token === fseq) items.forEach(it => { it.style.transitionDelay = ''; }); }, 1000);
      });
    });
  };
  fBtns.forEach(b => b.addEventListener('click', () => apply(b.dataset.filter)));
}
})();
