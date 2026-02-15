# Migration vers PostgreSQL - Modifications Effectuées

## ✅ Fichiers Adaptés

### Base de données
- ✅ `backend/src/database/connection.js` - Adapté pour PostgreSQL uniquement
- ✅ `backend/src/database/init.js` - Utilise async/await et syntaxe PostgreSQL
- ✅ `backend/src/database/seed.js` - Adapté pour PostgreSQL
- ✅ `backend/src/database/schema-postgresql.sql` - Schéma PostgreSQL créé
- ✅ `backend/src/server.js` - Initialisation async de la base de données

## ⚠️ Fichiers Nécessitant des Modifications (async/await)

Les fonctions `query()` et `queryOne()` sont maintenant **async** et doivent être appelées avec `await`.

### Fichiers à modifier :

1. **Services** (tous les appels doivent être await) :
   - `backend/src/services/spawnService.js`
   - `backend/src/services/captureService.js`
   - `backend/src/services/battleService.js`
   - `backend/src/services/economyService.js`
   - `backend/src/services/arenaService.js`

2. **Routes API** :
   - `backend/src/routes/api.js` - Toutes les routes doivent être async

3. **Intégrations** :
   - `backend/src/integrations/streamelements.js` - Toutes les fonctions doivent être async

4. **WebSocket** :
   - `backend/src/websocket/handlers.js` - Toutes les fonctions doivent être async

## 🔧 Changements de Syntaxe SQL

### Placeholders
- **SQLite** : `?` (placeholders positionnels)
- **PostgreSQL** : `$1, $2, $3...` (placeholders numérotés)

✅ **Déjà corrigé dans** : `init.js`, `seed.js`

### INSERT avec conflit
- **SQLite** : `INSERT OR IGNORE INTO ...`
- **PostgreSQL** : `INSERT INTO ... ON CONFLICT (column) DO NOTHING`

✅ **Déjà corrigé dans** : `init.js`, `seed.js`

### Types de données
- **SQLite** : `INTEGER PRIMARY KEY AUTOINCREMENT`
- **PostgreSQL** : `SERIAL PRIMARY KEY`

✅ **Déjà corrigé dans** : `schema-postgresql.sql`

### Timestamps
- **SQLite** : `DATETIME DEFAULT CURRENT_TIMESTAMP`
- **PostgreSQL** : `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

✅ **Déjà corrigé dans** : `schema-postgresql.sql`

## 📝 Prochaines Étapes

Pour que le système fonctionne complètement avec PostgreSQL, il faut :

1. Convertir tous les appels `query()` et `queryOne()` en `await query()` et `await queryOne()`
2. Rendre toutes les fonctions qui utilisent ces appels `async`
3. Changer les placeholders `?` en `$1, $2, $3...` dans toutes les requêtes
4. Remplacer `INSERT OR IGNORE` par `INSERT ... ON CONFLICT DO NOTHING`

## 🚀 Utilisation

Pour initialiser la base de données PostgreSQL :

```bash
# Assurez-vous que DATABASE_URL est configuré dans .env
cd backend
node src/database/init.js
```

Le script `init.js` va :
1. Créer toutes les tables
2. Insérer les Pokémon depuis `pokemon.json`
3. Insérer les items de boutique
4. Insérer les badges


