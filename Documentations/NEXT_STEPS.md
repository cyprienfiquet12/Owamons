# 🚀 Prochaines Étapes - Guide de Configuration

Maintenant que le serveur tourne, voici les étapes pour finaliser la configuration et commencer à utiliser le système.

## ✅ Étape 1 : Initialiser la Base de Données

Si vous ne l'avez pas encore fait, initialisez la base de données PostgreSQL :

```bash
cd backend
node src/database/init.js
```

Vous devriez voir :
```
📦 Connected to PostgreSQL database
📋 Initializing database schema...
✅ Database schema initialized
✅ Seeded X Pokémon
✅ Seeded X shop items
✅ Seeded X badges
✅ Database initialization completed!
```

## ✅ Étape 2 : Vérifier que le Serveur Fonctionne

Le serveur devrait être accessible sur `http://localhost:3000`

### Tests Rapides

1. **Health Check** :
   ```
   http://localhost:3000/health
   ```
   Devrait retourner : `{"status":"ok","timestamp":"..."}`

2. **Liste des Pokémon** :
   ```
   http://localhost:3000/api/pokemon
   ```
   Devrait retourner la liste des Pokémon

3. **Liste des Items de Boutique** :
   ```
   http://localhost:3000/api/shop/items
   ```
   Devrait retourner : Pokéball, Superball, Hyperball

## ✅ Étape 3 : Tester un Spawn (Admin)

Pour tester le système de spawn, vous pouvez utiliser l'endpoint StreamElements ou créer un script de test.

### Option A : Via Webhook StreamElements (si configuré)

Envoyez une commande `!spawn` dans votre chat Twitch (si StreamElements est configuré).

### Option B : Via API Directe (Test)

Créez un fichier de test temporaire `backend/test-spawn.js` :

```javascript
import { spawnPokemon } from './src/services/spawnService.js';
import { initDatabase } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  await initDatabase();
  const event = await spawnPokemon();
  console.log('✅ Spawn réussi:', event.pokemon.name);
  process.exit(0);
}

test().catch(console.error);
```

Puis exécutez :
```bash
cd backend
node test-spawn.js
```

## ✅ Étape 4 : Configurer StreamElements

### 4.1 Créer un Webhook dans StreamElements

1. Allez sur [StreamElements Dashboard](https://streamelements.com/dashboard)
2. Allez dans **Settings** → **API** ou **Webhooks**
3. Créez un nouveau webhook pointant vers :
   ```
   http://votre-serveur:3000/webhook/streamelements
   ```
   
   **Note** : Si vous testez en local, utilisez un service comme :
   - [ngrok](https://ngrok.com/) pour exposer votre localhost
   - [localtunnel](https://localtunnel.github.io/www/) (alternative gratuite)

### 4.2 Configurer le Secret (Optionnel mais Recommandé)

Dans votre `.env`, ajoutez :
```env
STREAMELEMENTS_WEBHOOK_SECRET=votre_secret_ici
```

Puis configurez ce même secret dans StreamElements.

### 4.3 Tester les Commandes

Une fois configuré, testez dans votre chat Twitch :
- `!capture` - Tenter de capturer le Pokémon actif
- `!battle` - Voter pour combattre
- `!flee` - Voter pour fuir
- `!shop pokeball 10` - Acheter 10 Pokéballs

## ✅ Étape 5 : Configurer l'Overlay dans OBS

### 5.1 Accéder à l'Overlay

L'overlay est accessible sur :
```
http://localhost:3000
```

### 5.2 Ajouter dans OBS

1. Ouvrez OBS Studio
2. Ajoutez une nouvelle source **"Navigateur"** (Browser Source)
3. URL : `http://localhost:3000`
4. Largeur : `1920` (ou selon vos besoins)
5. Hauteur : `1080` (ou selon vos besoins)
6. Cochez **"Actualiser le navigateur quand la scène devient active"**

### 5.3 Personnaliser la Position

Ajustez la position et la taille de l'overlay dans OBS selon vos préférences.

## ✅ Étape 6 : Tester le Flux Complet

### Scénario de Test

1. **Spawner un Pokémon** :
   - Utilisez `!spawn` dans le chat ou le script de test
   - L'overlay devrait afficher le Pokémon avec le timer de vote

2. **Voter** :
   - Utilisez `!capture`, `!battle`, ou `!flee` dans le chat
   - Les votes devraient se mettre à jour en temps réel dans l'overlay

3. **Tenter une Capture** :
   - Utilisez `!capture` quand un Pokémon est actif
   - Le résultat (succès/échec) devrait s'afficher dans l'overlay

4. **Acheter des Items** :
   - Utilisez `!shop pokeball 5` pour acheter 5 Pokéballs
   - Vérifiez votre inventaire via l'API : `GET /api/inventory/:userId`

## ✅ Étape 7 : Configuration Avancée (Optionnel)

### 7.1 Ajouter Plus de Pokémon

Éditez `backend/data/pokemon.json` et ajoutez plus de Pokémon, puis réexécutez le seed :

```bash
cd backend
node src/database/seed.js
```

### 7.2 Personnaliser les Probabilités

Modifiez les `spawn_weight` dans `pokemon.json` pour ajuster les probabilités de spawn.

### 7.3 Ajuster les Récompenses

Modifiez les valeurs dans `backend/src/utils/rarity.js` :
- `COIN_REWARDS_CAPTURE` - Récompenses par capture
- `COIN_REWARDS_BATTLE` - Récompenses par combat
- `XP_REWARDS` - Récompenses XP

## 📊 Endpoints API Utiles

- `GET /health` - Vérifier que le serveur fonctionne
- `GET /api/pokemon` - Liste tous les Pokémon
- `GET /api/shop/items` - Liste les items de boutique
- `GET /api/event/active` - Événement actif
- `GET /api/user/:id` - Informations d'un utilisateur
- `GET /api/inventory/:userId` - Inventaire d'un utilisateur

## 🐛 Dépannage

### L'overlay ne s'affiche pas
- Vérifiez que le serveur tourne sur le bon port
- Ouvrez la console du navigateur (F12) pour voir les erreurs
- Vérifiez que Socket.io se connecte (devrait voir "Connected to server" dans la console)

### Les commandes ne fonctionnent pas
- Vérifiez que StreamElements est bien configuré
- Vérifiez les logs du serveur pour voir les requêtes reçues
- Testez directement l'endpoint webhook avec Postman ou curl

### La base de données ne répond pas
- Vérifiez que PostgreSQL est démarré
- Vérifiez votre `DATABASE_URL` dans `.env`
- Testez la connexion : `psql -U postgres -d pokemon_twitch`

## 🎮 Prêt à Streamer !

Une fois toutes ces étapes complétées, votre système est prêt à être utilisé en direct sur Twitch !

Les viewers pourront :
- Voir les Pokémon spawner en temps réel
- Voter pour capturer/combattre/fuir
- Gagner de l'XP et des Pokécoins
- Acheter des items en boutique
- Collectionner des Pokémon
- Débloquer des badges

Bon stream ! 🎉


