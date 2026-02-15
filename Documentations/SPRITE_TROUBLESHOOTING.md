# 🖼️ Dépannage des Sprites Pokémon

## Problème : Le sprite ne s'affiche pas

### Solutions

#### 1. Utiliser l'endpoint API au lieu de test.js

Au lieu d'utiliser `test.js`, utilisez l'endpoint API qui diffuse automatiquement l'événement :

```bash
# Via curl
curl -X POST http://localhost:3000/api/spawn

# Via PowerShell
Invoke-WebRequest -Uri http://localhost:3000/api/spawn -Method POST
```

Ou ouvrez dans votre navigateur :
```
http://localhost:3000/api/spawn
```
(Note: Les navigateurs ne peuvent pas faire POST directement, utilisez curl ou un outil comme Postman)

#### 2. Vérifier la console du navigateur

Ouvrez la console du navigateur (F12) sur http://localhost:3000 et vérifiez :
- Les messages de log : `"Displaying Pokémon spawn:"` et `"Sprite URL:"`
- Les erreurs de chargement d'image
- Les erreurs CORS

#### 3. Vérifier que le sprite_url est présent

Dans la console du navigateur, vous devriez voir :
```javascript
Sprite URL: https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png
```

Si `sprite_url` est `null` ou `undefined`, le problème vient de la base de données.

#### 4. Tester l'URL du sprite directement

Ouvrez l'URL du sprite directement dans votre navigateur :
```
https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png
```

Si l'image ne charge pas, c'est un problème de connexion internet ou de CORS.

#### 5. Vérifier les données dans la base

```bash
cd backend
node -e "import('./src/database/connection.js').then(async ({initDatabase, query}) => { await initDatabase(); const pokemon = await query('SELECT name, sprite_url FROM pokemons WHERE name = ?', ['Pikachu']); console.log(JSON.stringify(pokemon, null, 2)); process.exit(0); })"
```

#### 6. Utiliser un service de proxy pour les images

Si les images PokeAPI ne se chargent pas (CORS), vous pouvez :
- Utiliser un proxy CORS
- Héberger les images localement
- Utiliser un autre service d'images Pokémon

## Test Rapide

1. **Démarrer le serveur** :
   ```bash
   npm run dev
   ```

2. **Ouvrir l'overlay** :
   ```
   http://localhost:3000
   ```

3. **Ouvrir la console** (F12)

4. **Spawner un Pokémon** :
   ```bash
   curl -X POST http://localhost:3000/api/spawn
   ```

5. **Vérifier dans la console** :
   - `"Received pokemon_spawn event"`
   - `"Displaying Pokémon spawn"`
   - `"Sprite URL: ..."`
   - `"Sprite loaded successfully"` ou erreur

## Solutions Alternatives

### Si les sprites PokeAPI ne fonctionnent pas

Vous pouvez modifier les `sprite_url` dans la base de données pour utiliser un autre service :

```sql
UPDATE pokemons 
SET sprite_url = 'https://pokeres.bastionbot.org/images/pokemon/1.png'
WHERE pokedex_id = 1;
```

Ou utiliser des emojis/placeholders en attendant.


