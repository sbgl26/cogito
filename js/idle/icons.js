// Icônes des améliorations, dessinées pour l'app : contour à l'encre, aplats francs.
// Chaque icône est un SVG 48 × 48 fourni sous forme de texte.

const INK = '#1B2440';
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;

// Étoile ou roue dentée : n pointes entre les rayons R et r.
function star(n, R, r, turn = -Math.PI / 2) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = turn + (i * Math.PI) / n, k = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(24 + Math.cos(a) * k).toFixed(1)} ${(24 + Math.sin(a) * k).toFixed(1)}`;
  }
  return d + 'z';
}

export const ICONS = {
  hache: svg(
    `<path d="M13 41L30 13" stroke="${INK}" stroke-width="9.5" stroke-linecap="round"/><path d="M13 41L30 13" stroke="#D9965A" stroke-width="4.5" stroke-linecap="round"/>` +
    `<path d="M23 9.500c6-5.500 15-4 19.500 3L33 25c-2-5.500-6-9.500-12.500-10.500z" fill="#F03E3E" ${S}/>` +
    `<path d="M35.500 21.500l5-7" stroke="#FFFFFF" stroke-width="2.500" stroke-linecap="round" opacity=".75"/>`),
  eclair: svg(`<path d="M28 4L10 27h11l-4.500 17L37 20H26z" fill="#FFD43B" ${S}/><path d="M24.500 10.500L16 22" stroke="#FFF3BF" stroke-width="2.500" stroke-linecap="round"/>`),
  scie: svg(`<path d="${star(11, 20, 15)}" fill="#E9ECEF" ${S}/><circle cx="24" cy="24" r="6.500" fill="#ADB5BD" ${S}/><circle cx="24" cy="24" r="1.800" fill="${INK}"/>` +
    `<path d="M14 18a11.500 11.500 0 0 1 7-5" fill="none" stroke="#FFFFFF" stroke-width="2.500" stroke-linecap="round"/>`),
  arbre: svg(`<rect x="20.500" y="30" width="7" height="13" rx="2.500" fill="#8D5A3B" ${S}/><circle cx="24" cy="21" r="13" fill="#37B24D" ${S}/>` +
    `<circle cx="33.500" cy="13.500" r="7.500" fill="#51CF66" ${S}/><circle cx="14" cy="15" r="6.500" fill="#2F9E44" ${S}/>` +
    `<path d="M18 24a7 7 0 0 0 6 5" fill="none" stroke="#2B8A3E" stroke-width="2.500" stroke-linecap="round"/>`),
  toque: svg(`<path d="M13.500 28a9 9 0 0 1 3.500-16.500 9.800 9.800 0 0 1 14 0A9 9 0 0 1 34.500 28z" fill="#FFFFFF" ${S}/>` +
    `<rect x="13.500" y="28" width="21" height="11" rx="2.500" fill="#FFFFFF" ${S}/><path d="M19 32v3.500M24 32v3.500M29 32v3.500" stroke="#CED4DA" stroke-width="2.500" stroke-linecap="round"/>`),
  tapis: svg(`<rect x="4.500" y="20" width="39" height="19" rx="9.500" fill="#495057" ${S}/><circle cx="14" cy="29.500" r="4.200" fill="#DEE2E6" ${S}/><circle cx="34" cy="29.500" r="4.200" fill="#DEE2E6" ${S}/>` +
    `<path d="M14 11h19m0 0l-5.500-5.500M33 11l-5.500 5.500" fill="none" stroke="${INK}" stroke-width="7.500" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M14 11h19m0 0l-5.500-5.500M33 11l-5.500 5.500" fill="none" stroke="#FFD43B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`),
  etoile: svg(`<path d="${star(5, 20, 9)}" fill="#FFD43B" ${S}/><path d="M17 17l4-1.500" stroke="#FFF3BF" stroke-width="2.500" stroke-linecap="round"/>`),
  tabouret: svg(`<path d="M16 26l-4.500 17M32 26l4.500 17M24 27v16M13.500 36h21" fill="none" ${S}/>` +
    `<path d="M8.500 15v5.500c0 3.800 7 7 15.500 7s15.500-3.200 15.500-7V15" fill="#E03131" ${S}/><ellipse cx="24" cy="15" rx="15.500" ry="7" fill="#FF6B6B" ${S}/>`),
};
