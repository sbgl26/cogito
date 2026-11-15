// Catalogue des jeux. Pour ajouter un jeu : créer son dossier dans js/games/,
// exporter une définition (voir js/screens/game.js), l'ajouter ici avec sa couleur
// et sa vignette, brancher son générateur dans js/core/generators.js, puis
// déclarer ses fichiers dans sw.js.

import { hashSeed } from '../core/rng.js';
import { sudokuDef, killerDef } from './sudoku/game.js';
import { nonogramDef, nonocolorDef } from './nonogram/game.js';
import { blocsDef } from './blocs/game.js';
import { matchDef } from './match/game.js';
import { sumsDef } from './sums/game.js';
import { triDef } from './tri/game.js';
import { solitaireDef } from './solitaire/game.js';
import { g2048Def } from './g2048/game.js';
import { minesDef } from './mines/game.js';
import { spiderDef } from './spider/game.js';
import { scierieDef } from './scierie/game.js';
import { sushiDef } from './sushi/game.js';

// ----- Vignettes (SVG 96 × 64). Couleurs fixes : la vignette est un autocollant,
// identique en thème clair et sombre. -----
const INK = '#1B2440', PEN = '#1F4FD8', RED = '#E0473C', GREEN = '#2FA36B', WHITE = '#FFFFFF', LINE = '#C6CDDF';
const svg = (body) => `<svg viewBox="0 0 96 64" aria-hidden="true">${body}</svg>`;
const sheet = (x = 26, y = 10, s = 44) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="4" fill="${WHITE}" stroke="${INK}" stroke-width="2"/>`;
const lines = (n, color, x = 26, y = 10, s = 44) => {
  let d = '';
  for (let k = 1; k < n; k++) d += `M${x + (s * k) / n} ${y}v${s}M${x} ${y + (s * k) / n}h${s}`;
  return `<path d="${d}" stroke="${color}" stroke-width="1.2"/>`;
};
const text = (x, y, t, size, color, hand) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="${color}" font-family="${hand ? "'Patrick Hand', cursive" : "'Bricolage Grotesque', sans-serif"}" font-weight="${hand ? 400 : 700}">${t}</text>`;
// Dessin en pixels : chaque caractère est une case ('.' = vide, sinon clé de couleur).
const pixels = (rows, colors, x, y, s) => rows.map((row, r) => [...row].map((ch, c) =>
  (ch === '.' ? '' : `<rect x="${x + c * s + 0.6}" y="${y + r * s + 0.6}" width="${s - 1.2}" height="${s - 1.2}" rx="1.2" fill="${colors[ch]}"/>`)).join('')).join('');
const tube = (x, doses) => `<path d="M${x} 12v33a7 7 0 0014 0V12" fill="${WHITE}" stroke="${INK}" stroke-width="2"/>` +
  doses.map((c, k) => `<rect x="${x + 2.5}" y="${42 - k * 8}" width="9" height="7" rx="${k ? 1.5 : 3.5}" fill="${c}"/>`).join('') +
  `<path d="M${x - 2} 12h18" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
const playingCard = (x, y, rot, label, color) => `<g transform="rotate(${rot} ${x + 13} ${y + 40})"><rect x="${x}" y="${y}" width="26" height="37" rx="3.500" fill="${WHITE}" stroke="${INK}" stroke-width="2"/>${label ? text(x + 13, y + 26, label, 20, color) : ''}</g>`;

const MOTIFS = {
  sudoku: svg(sheet() + lines(3, INK) + text(33.500, 22, '5', 12, INK) + text(62.5, 36.500, '3', 12, INK) + text(48, 37.5, '7', 14, PEN, true) + text(33.5, 52, '9', 14, PEN, true)),
  killer: svg(sheet() + lines(3, LINE) +
    `<path d="M29 13h24v12H41v14H29z M57 27h10v24H43V41h14z" fill="none" stroke="${INK}" stroke-width="1.300" stroke-dasharray="3 2.2"/>` +
    text(34.5, 20.5, '12', 7, INK) + text(62, 34.5, '21', 7, INK) + text(62.5, 49, '8', 13, PEN, true)),
  nonogram: svg(sheet() + pixels(['.#.#.', '#####', '#####', '.###.', '..#..'], { '#': INK }, 28, 12, 8)),
  nonocolor: svg(sheet() + pixels(['.r.r.', 'rrbrr', '.rrr.', '..g..', '.gg..'], { r: RED, b: '#F2A12E', g: GREEN }, 28, 12, 8)),
  blocs: svg(sheet() + lines(5, LINE) + pixels(['.....', '.....', '#....', '##.##', '###.#'], { '#': INK }, 26, 10, 8.8) +
    pixels(['pp', '.p'], { p: PEN }, 52, 7, 8.8)),
  match: svg(`<path d="M27 25c8-16 34-16 42 0" fill="none" stroke="${PEN}" stroke-width="2.200" stroke-linecap="round" stroke-dasharray="1 4.500"/>` +
    sheet(12, 22, 28) + sheet(56, 22, 28) + text(26, 43, '7', 19, INK) + text(70, 43, '3', 19, INK) + text(48, 43, '+', 16, INK)),
  sums: svg(sheet() + lines(3, LINE) + text(33.500, 21.500, '4', 10, INK) + text(48, 21.5, '7', 10, LINE) + text(62.5, 21.5, '2', 10, INK) +
    text(33.5, 36, '6', 10, LINE) + text(48, 36, '5', 10, INK) + text(62.5, 36, '1', 10, LINE) + text(33.5, 50.5, '3', 10, INK) + text(48, 50.5, '8', 10, LINE) + text(62.5, 50.5, '9', 10, INK) +
    `<circle cx="48" cy="32.500" r="6" fill="none" stroke="${PEN}" stroke-width="1.800"/>` + text(82, 36, '5', 11, INK) + text(82, 21.5, '6', 11, INK) + text(82, 50.5, '12', 11, INK)),
  tri: svg(tube(22, [RED, RED, PEN, '#F5C02E']) + tube(41, [GREEN, GREEN, GREEN, GREEN]) + tube(60, [PEN, '#F5C02E'])),
  solitaire: svg(playingCard(22, 14, -14, '', INK) + playingCard(35, 12, 0, '', INK) + playingCard(48, 14, 14, 'A', RED) +
    `<path d="M40.500 27.5c0-3 4-3.800 5.500-.8 1.500-3 5.500-2.200 5.500.8 0 3.300-5.500 6.700-5.500 6.700s-5.500-3.400-5.500-6.700z" fill="${RED}" transform="translate(2 1)"/>`),
};

const tile = (x, y, v, fill, size = 12) => `<rect x="${x}" y="${y}" width="20" height="20" rx="3.500" fill="${fill}" stroke="${INK}" stroke-width="1.800"/>` + text(x + 10, y + 14.500, v, size, INK);
MOTIFS.g2048 = svg(tile(26, 10, 2, WHITE) + tile(50, 10, 4, '#FFF2A6') + tile(26, 34, 8, '#FFB65C') + tile(50, 34, 16, '#FFA3C7', 10.500));
MOTIFS.mines = svg(sheet() + lines(3, LINE) + text(33.500, 22, '1', 12, PEN) + text(48, 22, '2', 12, GREEN) + text(33.5, 36.500, '1', 12, PEN) + text(62.500, 51, '3', 12, RED) +
  `<path d="M45 30v12M45 30l8 3-8 3" fill="${RED}" stroke="${INK}" stroke-width="1.600" stroke-linejoin="round" stroke-linecap="round"/>` +
  `<circle cx="62.500" cy="32.500" r="4.200" fill="${INK}"/><path d="M62.5 26.500v12M56.500 32.5h12M58.300 28.300l8.400 8.400M66.700 28.300l-8.400 8.400" stroke="${INK}" stroke-width="1.300" stroke-linecap="round"/>`);

MOTIFS.spider = svg([0, 1, 2, 3].map((k) => `<rect x="${17 + k * 16}" y="${9 + k * 3}" width="15" height="22" rx="2.5" fill="${PEN}" stroke="${INK}" stroke-width="1.6"/>`).join('') +
  [['R', 17], ['D', 33], ['V', 49], ['10', 65]].map(([t, x], k) => `<rect x="${x}" y="${24 + k * 3}" width="15" height="22" rx="2.5" fill="${WHITE}" stroke="${INK}" stroke-width="1.6"/>` + text(x + 7.5, 39 + k * 3, t, t.length > 1 ? 8.5 : 10, INK)).join(''));

const coin = (x, y, r = 7) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFD43B" stroke="${INK}" stroke-width="1.8"/><circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="none" stroke="#F59F00" stroke-width="1.6"/>`;
MOTIFS.scierie = svg(`<rect x="44" y="34" width="5" height="16" rx="1.5" fill="#8A5A3C" stroke="${INK}" stroke-width="1.6"/>` +
  `<circle cx="46" cy="27" r="13" fill="#2F9E44" stroke="${INK}" stroke-width="1.8"/><circle cx="56" cy="18" r="8.5" fill="#40C057" stroke="${INK}" stroke-width="1.8"/><circle cx="37" cy="19" r="7" fill="#2B8A3E" stroke="${INK}" stroke-width="1.8"/>` +
  `<rect x="14" y="44" width="24" height="8" rx="4" fill="#C98B4A" stroke="${INK}" stroke-width="1.8"/><circle cx="34" cy="48" r="2" fill="${INK}"/>` + coin(72, 44));
MOTIFS.sushi = svg(`<ellipse cx="42" cy="40" rx="27" ry="11" fill="${WHITE}" stroke="${INK}" stroke-width="2"/><ellipse cx="42" cy="38.5" rx="20" ry="7" fill="none" stroke="${LINE}" stroke-width="1.4"/>` +
  `<rect x="24" y="24" width="17" height="12" rx="4" fill="${WHITE}" stroke="${INK}" stroke-width="1.8"/><rect x="23" y="19" width="19" height="8" rx="4" fill="#FF922B" stroke="${INK}" stroke-width="1.8"/>` +
  `<rect x="45" y="24" width="17" height="12" rx="4" fill="${WHITE}" stroke="${INK}" stroke-width="1.8"/><rect x="44" y="19" width="19" height="8" rx="4" fill="#FA5252" stroke="${INK}" stroke-width="1.8"/>` + coin(78, 22, 6.5));

// Une couleur de surligneur par jeu.
const COLORS = {
  sudoku: '#FFE14D', killer: '#FFB65C', nonogram: '#9AD0FF', nonocolor: '#FFA3C7', blocs: '#9BE5A8',
  match: '#CDB8FF', sums: '#84E3D8', tri: '#FFA08F', solitaire: '#D2EC6F', g2048: '#FFC971', mines: '#B9C2D6', spider: '#F3A6E8', scierie: '#8EDB7E', sushi: '#FFD8A8',
};

export const GAMES = [sudokuDef, killerDef, nonogramDef, nonocolorDef, blocsDef, solitaireDef, spiderDef, g2048Def, matchDef, sumsDef, triDef, minesDef, scierieDef, sushiDef]
  .map((def) => ({ ...def, motif: MOTIFS[def.id], color: COLORS[def.id] }));

export const byId = (id) => GAMES.find((g) => g.id === id);

export const DEFAULT_COLOR = COLORS.sudoku;

// Défi du jour : un jeu différent chaque jour, la même grille pour tout le monde.
export function dailyPick(date) {
  const pool = GAMES.filter((g) => g.daily);
  const [y, m, d] = date.split('-').map(Number);
  const def = pool[Math.floor(Date.UTC(y, m - 1, d) / 86400000) % pool.length];
  return { def, date, level: def.daily, seed: hashSeed(date + ':' + def.id) };
}
