# Cogito — carnet de jeux de logique (PWA)

Une seule app, jouable hors connexion, sans dépendance ni étape de build
(HTML + CSS + modules JavaScript natifs). Douze jeux :

| Jeu | Niveaux | Particularités |
| --- | --- | --- |
| Sudoku | Facile à Expert | notes, indice, erreurs signalées |
| Killer Sudoku | Facile à Expert | cages et sommes, solution unique |
| Nonogram | 5×5, 10×10, 15×15 | glissé au doigt, sans jamais deviner |
| Nonogram couleur | 2 à 4 couleurs | même moteur, blocs colorés |
| Blocs | score | pièces à glisser sur une grille 9×9 |
| Solitaire | tirage 1 ou 3 | Klondike au toucher, fin automatique |
| Spider | 1 ou 2 couleurs | suites du roi à l'as, indice |
| 2048 | score | glissé, annulation |
| Paires | — | chiffres identiques ou qui font 10 |
| Sommes | 5×5 à 8×8 | totaux par ligne et colonne, solution unique |
| Tri de couleurs | 5 à 12 couleurs | départs toujours solubles |
| Démineur | 3 tailles | premier coup sûr, appui long = drapeau |

Autour des jeux : défi du jour (même grille pour tout le monde, série de jours),
statistiques, reprise automatique, thème clair / sombre, sons et vibrations.

« Cogito » est un nom de travail : il se change dans `index.html`,
`manifest.webmanifest` et `js/screens/hub.js`.

## Mise en ligne

Le dossier se sert tel quel par n'importe quel hébergement statique en **HTTPS**
(obligatoire pour le hors-ligne, sauf sur `http://localhost`). Tous les chemins sont relatifs.

Avec GitHub Pages : pousser ce dossier à la racine d'un dépôt public, puis
Settings → Pages → « Deploy from a branch » → `main` / racine. L'app est alors
à l'adresse `https://<compte>.github.io/<dépôt>/`.

Sur iPhone : ouvrir l'adresse dans Safari, Partager, « Sur l'écran d'accueil ».

## Publier une nouvelle version

Changer `VERSION` en haut de `sw.js` (et `APP_VERSION` dans `js/screens/hub.js`).
Les téléphones détectent la nouvelle version à l'ouverture et se rechargent seuls.
Tout fichier ajouté doit aussi être listé dans `FILES` (`sw.js`).

## Organisation

```
index.html, manifest.webmanifest, sw.js
css/app.css                  thème, une couleur de surligneur par jeu (--tint)
js/app.js                    routeur (#sudoku, #defi, #stats, #reglages…)
js/core/store.js             réglages, statistiques, parties en cours, défi du jour
js/core/ui.js                éléments, icônes, panneaux, chronomètre, sons
js/core/rng.js               hasard à graine (défi du jour)
js/core/generate.js          génération des grilles dans un Web Worker
js/screens/hub.js            accueil, statistiques, réglages
js/screens/game.js           cadre commun des jeux (niveaux, chrono ou score, fin de partie)
js/games/registry.js         catalogue, couleurs, vignettes
js/games/<jeu>/engine.js     logique pure, testable sous Node
js/games/<jeu>/game.js       interface du jeu
tests/test-engines.mjs       node tests/test-engines.mjs
```

## Ajouter un jeu

1. `js/games/<jeu>/engine.js` (sans DOM) et `game.js` qui exporte une définition
   `{ id, title, tagline, levels | null, rules, init(data, level), mount(host, state, api) }`,
   plus en option `reset(state)`, `status(state)`, `mode: 'score'`, `errors: true`, `daily: '<niveau>'`.
2. Brancher son générateur dans `js/core/generators.js`.
3. L'ajouter dans `js/games/registry.js` (couleur + vignette) et dans `FILES` de `sw.js`.

L'objet `api` donne `persist()`, `error()`, `win(el)`, `over(el)` (jeux à score),
`fail(message)` et `toast(message)` ; le cadre gère le reste.

## Garanties des générateurs

- Sudoku, Killer, Sommes : solution unique, vérifiée par un solveur.
- Nonogram (noir et blanc ou couleur) : résoluble ligne à ligne, sans deviner.
- Tri de couleurs : chaque départ a une solution trouvée par recherche.
- Solitaire, Spider, Paires, Démineur, 2048 : hasard pur, comme les jeux d'origine.

## Données et licences

Tout est stocké sur l'appareil (localStorage) : aucun compte, aucun serveur, aucun traceur.
Polices embarquées : Bricolage Grotesque et Patrick Hand, sous licence SIL Open Font License.
Grilles, visuels et code sont originaux ; aucun contenu d'un éditeur tiers n'est repris.
