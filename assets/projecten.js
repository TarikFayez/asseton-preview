// Asseton: Projecten page. Compare frames (Voor / Tijdens / Na) + one accessible lightbox for every project photo.
// Loads after site.js; everything here is null-safe.
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
const sets = new Map();
const itemsOf = host => {
  if (!sets.has(host)) {
    sets.set(host, $$('[data-lb]', host).map(n => n.tagName === 'IMG'
      ? { node: n, src: n.getAttribute('src'), w: +n.getAttribute('width') || 0, h: +n.getAttribute('height') || 0, alt: n.getAttribute('alt') || '', label: n.dataset.lbLabel || '' }
      : { node: n, src: n.dataset.lbSrc, w: +n.dataset.lbW || 0, h: +n.dataset.lbH || 0, alt: n.dataset.lbAlt || '', label: n.dataset.lbLabel || '' }));
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
  if (full) full.addEventListener('click', e => {
    const p = panes.find(x => x.dataset.pane === view);
    openLb(host, p ? indexOf(p) : 0, full, e.detail > 0);
  });
  // entering the phone layout (photos stacked): back to the neutral view
  onMQ(phone, e => { if (e.matches) setView('alle'); });
});

// ---- Meer projecten: photo buttons open that project's photos
$$('.more-img').forEach(btn => btn.addEventListener('click', e => openLb(btn.closest('[data-lb-set]'), 0, btn, e.detail > 0)));
})();
