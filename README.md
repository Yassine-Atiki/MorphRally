# Morph Rally — Grand Prix Atlas

Course autonome de huit GT en 3D sur un circuit côtier. Trois tours, tactiques, dépassements et boost sonore.

## Jouer

Ouvrir le site GitHub Pages une fois la publication activée, puis cliquer sur « Prendre le départ ».

- 1 / 2 / 3 : prudent, équilibré, attaque.
- Espace : boost.
- C : caméra de poursuite ou aérienne.
- P : pause.
- D : diagnostic avec cinq sondes, forces et anticipation.
- R : retour à la grille.

Les voitures utilisent les steering behaviors de Craig Reynolds. Le Grand Prix n’utilise pas d’apprentissage neuronal.

## Organisation

- `index.html` : entrée du jeu.
- `race.css` : interface.
- `js/` : scripts et bibliothèque p5.js locale.
- `assets/audio/` : son moteur et attribution.
- `audio-credits.html` : crédits audio accessibles dans le jeu.

## Crédits

p5.js : licence livrée dans `js/p5-LICENSE.txt`.

Son moteur : qubodup, « Car Engine Loop 96kHz, 4s », sous CC BY 3.0. Voir `assets/audio/CREDITS.md` et la page de crédits du jeu.
