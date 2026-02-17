# Overlay Infos Pokéchat

Widget overlay qui fait défiler les infos et commandes Pokéchat sur 4 slides.

## Contenu des slides

1. Choisis ton starter : `!starter`
2. Achète tes premières Pokéballs : `!shop 1 pokéball`
3. Participe aux `!combat` ou `!capture` pour t’inscrire au classement
4. Plus d’infos : `!pokéchat`

## Utilisation dans OBS

1. **Source** → **Navigateur** (Browser Source).
2. **URL** : chemin local vers `index.html`, par ex.  
   `file:///C:/Users/.../Owamons/pokechat-info-overlay/index.html`
3. **Largeur** : 450 px (ou plus). **Hauteur** : 120 px (ou plus).
4. Cocher **Fond transparent** si besoin.
5. Positionner la source en bas à gauche (ou où tu veux).

## Comportement

- Rotation automatique toutes les **6 secondes**.
- Les **points** en bas permettent de changer de slide au clic.
- Au **survol** du widget, le défilement se met en pause.

## Fichiers

- `index.html` – structure du widget
- `styles.css` – mise en forme (position, fond, commandes en `code`)
- `script.js` – défilement et interaction

Pour modifier le délai entre deux slides, change `SLIDE_DURATION_MS` dans `script.js` (valeur en millisecondes).
