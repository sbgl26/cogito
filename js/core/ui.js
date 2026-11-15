// Petites briques d'interface partagées : création d'éléments, icônes,
// panneaux (bottom sheets), messages, chronomètre, vibrations.

import { settings } from './store.js';

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const PATHS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  undo: '<path d="M8 5L3.5 9.5 8 14"/><path d="M4 9.5h10a6 6 0 010 12h-3"/>',
  eraser: '<path d="M14.5 4.5l6 6-9 9H7l-3.5-3.5z"/><path d="M9 10l6 6"/><path d="M11 19.5h9"/>',
  pencil: '<path d="M4 20l1-4.5L16.5 4l3.5 3.5L8.5 19z"/><path d="M14 6.5l3.5 3.5"/>',
  bulb: '<path d="M9 17.5h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2v.1h5V16c0-.8.4-1.500 1-2A6 6 0 0012 3z"/>',
  games: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>',
  stats: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
  gear: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  fill: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  ring: '<circle cx="12" cy="12" r="7.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  tube: '<path d="M8.500 4v13a3.5 3.5 0 007 0V4"/><path d="M7 4h10"/><path d="M8.5 11h7"/>',
  cards: '<rect x="4" y="6" width="10" height="14" rx="1.5"/><path d="M9 4h8.5A1.500 1.500 0 0119 5.5V17"/>',
};

export function icon(name) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || ''}</svg>`;
  return span;
}

export function fmtTime(total) {
  const s = Math.max(0, Math.floor(total || 0));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  const two = (n) => String(n).padStart(2, '0');
  return hh ? `${hh}:${two(mm)}:${two(ss)}` : `${two(mm)}:${two(ss)}`;
}

// Retour haptique + petit son. sound : 'place', 'tap', 'error', 'clear', 'win' ou null.
export function buzz(pattern = 8, sound = 'place') {
  if (settings.get('haptics')) {
    try { navigator.vibrate && navigator.vibrate(pattern); } catch { /* non pris en charge */ }
  }
  if (sound) sfx(sound);
}

// Sons synthétisés (aucun fichier audio) : [fréquence Hz, durée s, forme d'onde, volume].
const SOUNDS = {
  tap: [[440, 0.04, 'triangle', 0.04]],
  place: [[620, 0.06, 'triangle', 0.05]],
  error: [[170, 0.16, 'square', 0.035]],
  clear: [[660, 0.07, 'triangle', 0.05], [990, 0.12, 'triangle', 0.05]],
  win: [[523, 0.11, 'triangle', 0.06], [659, 0.11, 'triangle', 0.06], [784, 0.11, 'triangle', 0.06], [1047, 0.32, 'triangle', 0.06]],
};
let audio = null;

export function sfx(name) {
  if (!settings.get('sound') || !SOUNDS[name]) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audio) audio = new Ctx();
    if (audio.state === 'suspended') audio.resume();
    let t = audio.currentTime;
    for (const [freq, dur, type, vol] of SOUNDS[name]) {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur * 0.85;
    }
  } catch { /* audio indisponible ou refusé : on reste silencieux */ }
}

const layer = () => document.getElementById('layer');

export function toast(message) {
  layer().querySelectorAll('.toast').forEach((t) => t.remove());
  const el = h('div', { class: 'toast', role: 'status' }, message);
  layer().append(el);
  setTimeout(() => el.remove(), 2600);
}

// Panneau qui monte du bas de l'écran. Renvoie une fonction de fermeture.
export function sheet({ title, content, actions = [], dismissable = true }) {
  const close = () => {
    document.removeEventListener('keydown', onKey);
    wrap.classList.add('is-leaving');
    setTimeout(() => wrap.remove(), 160);
  };
  const onKey = (e) => { if (e.key === 'Escape' && dismissable) close(); };
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    title && h('h2', { class: 'sheet-title' }, title),
    content && h('div', { class: 'sheet-body' }, content),
    actions.length > 0 && h('div', { class: 'sheet-actions' },
      actions.map((a) => h('button', {
        type: 'button',
        class: 'btn' + (a.kind ? ' btn--' + a.kind : ''),
        onclick: () => { if (!a.keepOpen) close(); a.onClick && a.onClick(); },
      }, a.label, a.note && h('span', { class: 'btn-note' }, a.note))),
    ),
  );
  const wrap = h('div', { class: 'sheet-wrap', onclick: (e) => { if (e.target === wrap && dismissable) close(); } }, panel);
  layer().append(wrap);
  document.addEventListener('keydown', onKey);
  const first = panel.querySelector('button');
  if (first) first.focus({ preventScroll: true });
  return close;
}

export function closeAllSheets() {
  layer().replaceChildren();
}

// Chronomètre qui se met en pause tout seul quand l'app passe en arrière-plan.
export class Timer {
  constructor(onTick) {
    this.onTick = onTick;
    this.base = 0;
    this.t0 = null;
    this.id = null;
    this.running = false;
    this.last = -1;
    this.onVisibility = () => (document.hidden ? this.pause() : this.resume());
  }
  get seconds() {
    return Math.floor(this.base + (this.t0 != null ? (performance.now() - this.t0) / 1000 : 0));
  }
  tick() {
    const s = this.seconds;
    if (s !== this.last) { this.last = s; this.onTick(s); }
  }
  start(from = 0) {
    this.base = from;
    this.running = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    if (!document.hidden) this.resume();
    this.tick();
  }
  resume() {
    if (!this.running || this.t0 != null) return;
    this.t0 = performance.now();
    this.id = setInterval(() => this.tick(), 250);
  }
  pause() {
    if (this.t0 == null) return;
    this.base += (performance.now() - this.t0) / 1000;
    this.t0 = null;
    clearInterval(this.id);
  }
  stop() {
    this.pause();
    this.running = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    return Math.floor(this.base);
  }
}
