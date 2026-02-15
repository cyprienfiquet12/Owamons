# 🐛 Débogage de l'Overlay

## Problème : Les données arrivent mais rien ne s'affiche

### Étapes de Diagnostic

1. **Ouvrez la console du navigateur (F12)**

2. **Vérifiez les messages suivants** :

   - `🔍 Checking DOM elements...` - Vérification des éléments DOM
   - `✅` ou `❌` pour chaque élément
   - `Received pokemon_spawn event` - Réception de l'événement
   - `Displaying Pokémon spawn` - Affichage du Pokémon
   - `Removing hidden class` - Retrait de la classe hidden

3. **Vérifiez les styles calculés** :

   Dans la console, vous devriez voir :
   ```
   eventDisplay computed display: block
   eventDisplay computed visibility: visible
   eventDisplay computed opacity: 1
   ```

4. **Test visuel** :

   Une bordure rouge devrait apparaître pendant 2 secondes autour de l'overlay.
   Si vous ne la voyez pas, l'élément est peut-être hors de l'écran.

### Solutions Possibles

#### Solution 1 : Vérifier le z-index

L'overlay pourrait être derrière d'autres éléments. Dans la console :

```javascript
document.getElementById('event-display').style.zIndex = '9999';
```

#### Solution 2 : Vérifier la position

L'overlay est positionné en `top: 20px; right: 20px`. Vérifiez qu'il n'est pas hors de l'écran.

Dans la console :
```javascript
const el = document.getElementById('event-display');
console.log('Position:', el.getBoundingClientRect());
```

#### Solution 3 : Forcer l'affichage manuellement

Dans la console du navigateur :
```javascript
document.getElementById('event-display').classList.remove('hidden');
document.getElementById('event-display').style.display = 'block';
document.getElementById('event-display').style.visibility = 'visible';
document.getElementById('event-display').style.opacity = '1';
document.getElementById('event-display').style.zIndex = '9999';
```

#### Solution 4 : Vérifier le CSS

Le body a `background: transparent` et `overflow: hidden`. Vérifiez que cela ne cause pas de problème.

#### Solution 5 : Vérifier les dimensions

L'overlay pourrait avoir une largeur/hauteur de 0. Dans la console :

```javascript
const el = document.getElementById('event-display');
const rect = el.getBoundingClientRect();
console.log('Dimensions:', rect.width, 'x', rect.height);
```

### Test Rapide

Exécutez ce code dans la console pour forcer l'affichage :

```javascript
// Forcer l'affichage
const eventDisplay = document.getElementById('event-display');
const pokemonSpawn = document.getElementById('pokemon-spawn');

if (eventDisplay) {
  eventDisplay.classList.remove('hidden');
  eventDisplay.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; z-index: 9999 !important; position: fixed !important; top: 20px !important; right: 20px !important; background: red !important; padding: 20px !important;';
  console.log('✅ Overlay forcé à s\'afficher');
  console.log('Position:', eventDisplay.getBoundingClientRect());
} else {
  console.error('❌ event-display element not found');
}
```

Si vous voyez un rectangle rouge, le problème vient du CSS. Si vous ne voyez rien, le problème vient du DOM.

### Vérification Complète

Exécutez ce script dans la console :

```javascript
(function() {
  console.log('=== DIAGNOSTIC OVERLAY ===');
  
  const eventDisplay = document.getElementById('event-display');
  const pokemonSpawn = document.getElementById('pokemon-spawn');
  
  if (!eventDisplay) {
    console.error('❌ event-display element not found');
    return;
  }
  
  if (!pokemonSpawn) {
    console.error('❌ pokemon-spawn element not found');
    return;
  }
  
  console.log('✅ Elements found');
  
  const style = window.getComputedStyle(eventDisplay);
  const rect = eventDisplay.getBoundingClientRect();
  
  console.log('Classes:', eventDisplay.classList.toString());
  console.log('Display:', style.display);
  console.log('Visibility:', style.visibility);
  console.log('Opacity:', style.opacity);
  console.log('Z-index:', style.zIndex);
  console.log('Position:', style.position);
  console.log('Top:', style.top);
  console.log('Right:', style.right);
  console.log('Width:', rect.width);
  console.log('Height:', rect.height);
  console.log('Bounding rect:', rect);
  
  if (rect.width === 0 || rect.height === 0) {
    console.warn('⚠️ Element has zero dimensions!');
  }
  
  if (style.display === 'none') {
    console.warn('⚠️ Element is hidden by display:none');
  }
  
  if (style.visibility === 'hidden') {
    console.warn('⚠️ Element is hidden by visibility:hidden');
  }
  
  if (parseFloat(style.opacity) === 0) {
    console.warn('⚠️ Element is hidden by opacity:0');
  }
})();
```


