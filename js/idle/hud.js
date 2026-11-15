// Économie et affichage communs aux jeux de gestion : caisse, boutons d'amélioration,
// gains qui s'envolent, revenus pendant l'absence.
//
// state : { cash, total, lv: { clé: niveau }, seen: horodatage }.
// upgrades : [{ key, label, icon, base, growth, max, hint(state) }].

import { h, buzz, sheet } from '../core/ui.js';

const UNITS = ['k', 'M', 'Md', 'T', 'Qa', 'Qi'];

export function fmt(value) {
  let n = Math.floor(value);
  if (n < 1000) return String(n);
  let i = -1;
  while (n >= 1000 && i < UNITS.length - 1) { n /= 1000; i++; }
  return (n < 100 ? n.toFixed(1).replace('.', ',').replace(',0', '') : String(Math.floor(n))) + ' ' + UNITS[i];
}

const OFFLINE_CAP = 4 * 3600; // secondes d'absence prises en compte
const OFFLINE_RATE = 0.5;     // part du revenu gagnée hors de l'app

export function createIdle({ host, state, api, upgrades, income, onBuy }) {
  const cashEl = h('b', { class: 'idle-amount' });
  const rateEl = h('span', { class: 'idle-rate' });
  const pill = h('div', { class: 'idle-cash' }, h('i', { class: 'coin' }), h('span', { class: 'idle-cash-text' }, cashEl, rateEl));
  const floats = h('div', { class: 'idle-floats', 'aria-hidden': 'true' });
  const buttons = upgrades.map((u) => {
    const level = h('span', { class: 'up-level' });
    const price = h('span', { class: 'up-price' });
    const btn = h('button', { type: 'button', class: 'up', onclick: () => buy(u) },
      h('span', { class: 'up-icon' }, u.icon), h('span', { class: 'up-label' }, u.label), level, price);
    return { u, btn, level, price };
  });
  const bar = h('div', { class: 'idle-bar' }, buttons.map((b) => b.btn));
  host.append(pill, floats, bar);

  const cost = (u) => Math.round(u.base * Math.pow(u.growth, state.lv[u.key] || 0));
  const maxed = (u) => (state.lv[u.key] || 0) >= u.max;
  let shown = -1;

  function refresh(force) {
    const cash = Math.floor(state.cash);
    if (!force && cash === shown) return;
    shown = cash;
    cashEl.textContent = fmt(cash);
    const perSec = income();
    rateEl.textContent = `${perSec < 10 ? perSec.toFixed(1).replace('.', ',').replace(',0', '') : fmt(perSec)} par seconde`;
    for (const { u, btn, level, price } of buttons) {
      const full = maxed(u);
      btn.disabled = full || cash < cost(u);
      btn.classList.toggle('is-max', full);
      level.textContent = u.hint ? u.hint(state) : `Niv. ${(state.lv[u.key] || 0) + 1}`;
      price.replaceChildren(...(full ? ['Max'] : [h('i', { class: 'coin coin--small' }), fmt(cost(u))]));
    }
  }

  function buy(u) {
    if (maxed(u) || state.cash < cost(u)) return;
    state.cash -= cost(u);
    state.lv[u.key] = (state.lv[u.key] || 0) + 1;
    buzz(10, 'clear');
    onBuy(u.key);
    save();
    refresh(true);
  }

  // Ajoute de l'argent ; si une position écran est donnée, un « +N » s'en envole.
  function earn(amount, spot) {
    state.cash += amount;
    state.total += amount;
    if (spot && floats.childElementCount < 14) {
      const el = h('span', { class: 'idle-gain', style: `left:${spot.x}px;top:${spot.y}px` }, '+' + fmt(amount));
      floats.append(el);
      setTimeout(() => el.remove(), 900);
    }
  }

  function save() {
    state.seen = Date.now();
    api.persist();
  }

  // Revenus pendant l'absence.
  const away = Math.min(OFFLINE_CAP, (Date.now() - (state.seen || Date.now())) / 1000);
  const bonus = Math.floor(away * income() * OFFLINE_RATE);
  if (away > 90 && bonus > 0) {
    state.cash += bonus;
    state.total += bonus;
    sheet({
      title: 'Pendant votre absence',
      content: h('p', { class: 'idle-away' }, h('i', { class: 'coin' }), h('b', null, '+' + fmt(bonus)),
        h('span', null, `gagnés en ${away >= 3600 ? Math.floor(away / 3600) + ' h ' : ''}${Math.floor((away % 3600) / 60)} min`)),
      actions: [{ label: 'Encaisser', kind: 'primary' }],
    });
  }
  save();
  const timer = setInterval(save, 4000);
  refresh(true);

  return {
    earn, refresh,
    destroy() { clearInterval(timer); state.seen = Date.now(); },
  };
}
