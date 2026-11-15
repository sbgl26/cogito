// Cadre commun à tous les jeux : choix du niveau, barre du haut, chronomètre ou score,
// menu, sauvegarde automatique, fin de partie, défi du jour.
//
// Une définition de jeu fournit : id, title, color, levels (ou null), rules,
// init(data, level), mount(host, state, api), et en option reset(state),
// status(state), mode: 'score', errors: true.

import { h, icon, fmtTime, sheet, toast, buzz, Timer } from '../core/ui.js';
import { saves, stats, settings, daily } from '../core/store.js';
import { generate } from '../core/generate.js';

export function mountGame(root, def, opts = {}) {
  const run = opts.daily || null; // défi du jour : { date, level, seed }
  const slot = run ? 'daily' : def.id;
  const levels = def.levels || { std: 'Partie' };
  const single = !def.levels;
  const scoreMode = def.mode === 'score';
  const idle = def.mode === 'idle'; // jeu de gestion sans fin : ni niveaux, ni chrono, ni fin de partie
  const home = () => { location.hash = ''; };

  let state = saves.load(slot);
  if (state && state.v !== 2) state = null; // sauvegarde d'un ancien format
  if (run && state && (state.date !== run.date || state.game !== def.id)) state = null;
  let ctl = null, timer = null, destroyed = false, refreshMeta = () => {};
  const page = h('div', { class: 'page' });
  root.append(page);

  const persist = () => {
    if (state && !state.done) saves.store(slot, state);
    refreshMeta();
  };
  const onHide = () => { if (state && timer) state.elapsed = timer.seconds; persist(); };
  window.addEventListener('pagehide', onHide);

  function teardownPlay() {
    if (timer) { state.elapsed = timer.stop(); timer = null; }
    if (ctl) { ctl.destroy(); ctl = null; }
    refreshMeta = () => {};
  }

  const backLink = () => h('a', { class: 'iconbtn', href: '#', 'aria-label': 'Retour aux jeux' }, icon('back'));

  // ----- Écran de départ : règles et niveaux -----
  function startView() {
    teardownPlay();
    page.className = 'page page--cahier';
    page.replaceChildren(
      h('header', { class: 'topbar' }, backLink()),
      h('div', { class: 'start' },
        h('h1', { class: 'start-title' }, h('span', { class: 'marker' }, def.title)),
        h('p', { class: 'start-rule' }, def.rules[0]),
        h('div', { class: 'levels' }, levelButtons()),
        h('button', { type: 'button', class: 'linkbtn', onclick: showRules }, 'Lire toutes les règles'),
      ),
    );
  }

  function levelButtons(onPick) {
    return Object.entries(levels).map(([key, label]) => {
      const s = stats.of(def.id, key);
      const best = s.best == null ? null : scoreMode ? `Record ${s.best}` : 'Record ' + fmtTime(s.best);
      return h('button', {
        type: 'button', class: 'level',
        onclick: () => { if (onPick) onPick(); begin(key); },
      }, h('span', { class: 'level-name' }, single ? 'Jouer' : label), best && h('span', { class: 'level-best' }, best));
    });
  }

  async function begin(level) {
    teardownPlay();
    page.className = 'page page--cahier';
    page.replaceChildren(h('div', { class: 'loading', role: 'status' },
      h('div', { class: 'loading-dots' }, h('i'), h('i'), h('i')),
      h('p', null, 'Création de la grille…')));
    let data;
    try {
      data = await generate(def.id, level, run ? run.seed : null);
    } catch {
      if (destroyed) return;
      toast('La grille n’a pas pu être créée. Réessayez.');
      if (run) home(); else startView();
      return;
    }
    if (destroyed) return;
    state = { v: 2, level, elapsed: 0, errors: 0, hints: 0, done: false, ...def.init(data, level) };
    if (run) Object.assign(state, { date: run.date, game: def.id });
    if (!idle) stats.start(def.id, level);
    persist();
    play();
  }

  // ----- Partie en cours -----
  function play() {
    teardownPlay();
    page.className = 'page page--game' + (idle ? ' page--idle' : '');
    const main = h('span', { class: 'clock' });
    const sub = h('span', { class: 'errs' });
    const host = h('main', { class: 'game-host' });
    const label = run ? 'Défi du jour' : single ? '' : levels[state.level] || '';
    page.replaceChildren(
      h('header', { class: 'topbar' },
        backLink(),
        h('div', { class: 'topbar-title' }, h('strong', null, def.title), label && h('span', null, label)),
        !idle && h('div', { class: 'topbar-meta' }, sub, main),
        h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Menu de la partie', onclick: menu }, icon('more')),
      ),
      host,
    );
    const record = stats.of(def.id, state.level).best || 0;
    refreshMeta = () => {
      if (idle) return;
      if (scoreMode) {
        main.textContent = state.score || 0;
        sub.textContent = 'Record ' + Math.max(record, state.score || 0);
        return;
      }
      main.classList.toggle('is-hidden', !settings.get('timer'));
      if (def.errors) {
        const on = settings.get('checkErrors');
        sub.textContent = on ? `${state.errors} erreur${state.errors > 1 ? 's' : ''}` : '';
        sub.classList.toggle('has', on && state.errors > 0);
      } else sub.textContent = def.status ? def.status(state) : '';
    };
    ctl = def.mount(host, state, api);
    refreshMeta();
    if (!scoreMode && !idle) {
      let lastSave = state.elapsed;
      timer = new Timer((s) => {
        main.textContent = fmtTime(s);
        state.elapsed = s;
        if (s - lastSave >= 10) { lastSave = s; saves.store(slot, state); }
      });
      timer.start(state.elapsed);
    }
  }

  function finish() {
    state.done = true;
    const seconds = timer ? timer.stop() : state.elapsed;
    timer = null;
    state.elapsed = seconds;
    saves.clear(slot);
    return seconds;
  }

  const fact = (label, value) => h('div', { class: 'fact' }, h('dt', null, label), h('dd', null, value));
  const replayActions = () => (run
    ? [{ label: 'Retour aux jeux', kind: 'primary', onClick: home }]
    : [
      { label: single ? 'Rejouer' : 'Rejouer ce niveau', kind: 'primary', onClick: () => begin(state.level) },
      !single && { label: 'Changer de niveau', onClick: startView },
      { label: 'Retour aux jeux', kind: 'quiet', onClick: home },
    ].filter(Boolean));

  const api = {
    persist,
    toast,
    error() { state.errors++; buzz([30, 40, 30], 'error'); refreshMeta(); },

    // Grille terminée (jeux chronométrés).
    win(boardEl) {
      if (state.done) return;
      const seconds = finish();
      const result = stats.win(def.id, state.level, seconds);
      if (run) daily.mark(run.date, { game: def.id, seconds });
      if (boardEl) boardEl.classList.add('is-won');
      buzz([20, 60, 20, 60, 40], 'win');
      setTimeout(() => {
        if (destroyed) return;
        sheet({
          title: run ? 'Défi du jour réussi' : result.record ? 'Nouveau record' : 'Bravo, c’est terminé',
          dismissable: false,
          content: h('dl', { class: 'facts' },
            fact('Temps', fmtTime(seconds)),
            run ? fact('Série', `${daily.streak()} j`) : fact('Record', fmtTime(result.best)),
            def.errors && settings.get('checkErrors') && fact('Erreurs', state.errors),
            def.status ? fact('Bilan', def.status(state)) : fact('Indices', state.hints)),
          actions: replayActions(),
        });
      }, 1100);
    },

    // Fin d'une partie à score (plus aucun coup possible).
    over(boardEl, reason = 'Plus aucune pièce ne rentre') {
      if (state.done) return;
      finish();
      const result = stats.score(def.id, state.level, state.score || 0);
      if (boardEl) boardEl.classList.add('is-over');
      buzz([40, 80, 40], result.record ? 'win' : 'error');
      setTimeout(() => {
        if (destroyed) return;
        sheet({
          title: result.record ? 'Nouveau record' : reason,
          dismissable: false,
          content: h('dl', { class: 'facts' }, fact('Score', state.score || 0), fact('Record', result.best)),
          actions: replayActions(),
        });
      }, 700);
    },

    // Partie perdue (bloquée).
    fail(message, title = 'Partie bloquée') {
      if (state.done) return;
      finish();
      buzz([40, 80, 40], 'error');
      sheet({
        title,
        dismissable: false,
        content: h('p', { class: 'sheet-note' }, message),
        actions: replayActions(),
      });
    },
  };

  // ----- Menu de la partie -----
  function menu() {
    if (idle) {
      sheet({
        title: def.title,
        actions: [
          { label: 'Règles du jeu', kind: 'primary', onClick: showRules },
          {
            label: 'Repartir de zéro',
            onClick: () => sheet({
              title: 'Tout effacer ?',
              content: h('p', { class: 'sheet-note' }, 'Vos pièces et toutes vos améliorations seront perdues.'),
              actions: [
                { label: 'Repartir de zéro', kind: 'danger', onClick: () => { teardownPlay(); saves.clear(slot); state = null; begin('std'); } },
                { label: 'Annuler', kind: 'quiet' },
              ],
            }),
          },
        ],
      });
      return;
    }
    const restart = def.reset && {
      label: 'Recommencer cette grille',
      onClick: () => {
        def.reset(state);
        Object.assign(state, { elapsed: 0, errors: 0, hints: 0 });
        if (timer) { timer.stop(); timer = null; }
        persist();
        play();
      },
    };
    sheet({
      title: def.title,
      actions: [
        !run && { label: 'Nouvelle partie', kind: 'primary', onClick: single ? () => begin('std') : pickLevel },
        restart,
        { label: 'Règles du jeu', onClick: showRules },
      ].filter(Boolean),
    });
  }

  function pickLevel() {
    let close = null;
    close = sheet({
      title: 'Choisir un niveau',
      content: h('div', null,
        h('p', { class: 'sheet-note' }, 'La partie en cours sera abandonnée.'),
        h('div', { class: 'levels levels--sheet' }, levelButtons(() => close()))),
    });
  }

  function showRules() {
    sheet({
      title: 'Règles : ' + def.title,
      content: h('div', { class: 'rules' }, def.rules.map((r) => h('p', null, r))),
      actions: [{ label: 'Compris', kind: 'primary' }],
    });
  }

  // ----- Entrée -----
  const doneToday = run && daily.log()[run.date];
  if (state && !state.done) play();
  else if (doneToday) {
    page.className = 'page page--cahier';
    page.replaceChildren(
      h('header', { class: 'topbar' }, backLink()),
      h('div', { class: 'start' },
        h('h1', { class: 'start-title' }, h('span', { class: 'marker' }, 'Défi réussi')),
        h('p', { class: 'start-rule' }, `${def.title} terminé en ${fmtTime(doneToday.seconds)}. Série en cours : ${daily.streak()} jour${daily.streak() > 1 ? 's' : ''}. Un nouveau défi arrive demain.`),
        h('a', { class: 'btn btn--primary', href: '#' }, 'Retour aux jeux')));
  } else if (run) begin(run.level);
  else if (idle) begin('std');
  else startView();

  return {
    destroy() {
      destroyed = true;
      window.removeEventListener('pagehide', onHide);
      const playing = !!ctl;
      teardownPlay();
      if (playing) persist();
    },
  };
}
