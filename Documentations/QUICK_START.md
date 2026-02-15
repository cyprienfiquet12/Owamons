# 🚀 Guide de Démarrage Rapide

Maintenant que votre serveur fonctionne, voici les étapes pour commencer à utiliser le système.

## ✅ Étape 1 : Tester le Système Localement

### 1.1 Vérifier que tout fonctionne

Ouvrez votre navigateur et testez :

- **Health Check** : http://localhost:3000/health
- **Liste des Pokémon** : http://localhost:3000/api/pokemon
- **Items de boutique** : http://localhost:3000/api/shop/items
- **Overlay** : http://localhost:3000 (devrait afficher l'interface)

### 1.2 Tester un Spawn

Créez un fichier `backend/test-spawn.js` :

```javascript
import { spawnPokemon } from './src/services/spawnService.js';
import { initDatabase } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  try {
    await initDatabase();
    console.log('🔄 Spawning a Pokémon...');
    const event = await spawnPokemon();
    console.log('✅ Spawn réussi!');
    console.log('Pokémon:', event.pokemon.name);
    console.log('Rareté:', event.pokemon.rarity);
    console.log('Niveau:', event.level);
    console.log('Timer:', event.voteDuration, 'secondes');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

test();
```

Exécutez :
```bash
cd backend
node test-spawn.js
```

Un Pokémon devrait spawner et être visible sur l'overlay à http://localhost:3000

## ✅ Étape 2 : Configurer StreamElements (Pour Twitch)

### 2.1 Exposer votre serveur local

Pour que StreamElements puisse envoyer des webhooks à votre serveur local, vous devez l'exposer publiquement.

#### Option A : ngrok (Recommandé)

1. Téléchargez [ngrok](https://ngrok.com/download)
2. Installez et authentifiez :
   ```bash
   ngrok authtoken VOTRE_TOKEN
   ```
3. Exposez le port 3000 :
   ```bash
   ngrok http 3000
   ```
4. Copiez l'URL HTTPS (ex: `https://abc123.ngrok.io`)

#### Option B : localtunnel (Gratuit, plus simple)

```bash
npm install -g localtunnel
lt --port 3000
```

Copiez l'URL fournie (ex: `https://random-name.loca.lt`)

### 2.2 Configurer le Webhook StreamElements

1. Allez sur [StreamElements Dashboard](https://streamelements.com/dashboard)
2. Allez dans **Settings** → **API** ou cherchez "Webhooks"
3. Créez un nouveau webhook :
   - **URL** : `https://votre-url-ngrok.io/webhook/streamelements`
   - **Method** : POST
   - **Secret** (optionnel) : Créez un secret et ajoutez-le dans votre `.env` :
     ```env
     STREAMELEMENTS_WEBHOOK_SECRET=votre_secret_ici
     ```

### 2.3 Tester les Commandes

Dans votre chat Twitch, testez :
- `!capture` - Tenter de capturer le Pokémon actif
- `!battle` - Voter pour combattre
- `!flee` - Voter pour fuir
- `!shop pokeball 5` - Acheter 5 Pokéballs

## ✅ Étape 3 : Configurer l'Overlay dans OBS

### 3.1 Ajouter la Source Navigateur

1. Ouvrez OBS Studio
2. Dans votre scène, cliquez sur **"+"** → **"Navigateur"** (Browser Source)
3. Configurez :
   - **Nom** : "Pokémon Overlay"
   - **URL** : `http://localhost:3000` (ou votre URL ngrok si vous voulez tester à distance)
   - **Largeur** : `1920`
   - **Hauteur** : `1080`
   - ✅ Cochez **"Actualiser le navigateur quand la scène devient active"**
   - ✅ Cochez **"Arrêter la source quand elle n'est pas visible"** (optionnel)

### 3.2 Positionner l'Overlay

- Ajustez la position et la taille selon vos préférences
- Vous pouvez utiliser des filtres OBS pour ajuster l'opacité, la couleur, etc.

### 3.3 Tester l'Affichage

1. Spawnez un Pokémon (via le script de test ou StreamElements)
2. L'overlay devrait afficher le Pokémon avec le timer de vote
3. Les votes devraient se mettre à jour en temps réel

## ✅ Étape 4 : Tester le Flux Complet

### Scénario de Test Complet

1. **Démarrer le serveur** :
   ```bash
   npm run dev
   ```

2. **Démarrer ngrok** (dans un autre terminal) :
   ```bash
   ngrok http 3000
   ```

3. **Spawnez un Pokémon** :
   - Via le script de test, ou
   - Via la commande `!spawn` dans le chat (si configuré)

4. **Voter dans le chat** :
   - `!capture` - Devrait tenter une capture
   - `!battle` - Devrait enregistrer un vote
   - `!flee` - Devrait enregistrer un vote

5. **Vérifier l'overlay** :
   - Le Pokémon devrait s'afficher
   - Les votes devraient se mettre à jour
   - Le timer devrait décompter

6. **Tester l'achat** :
   - `!shop pokeball 10` - Devrait acheter 10 Pokéballs
   - Vérifiez via l'API : `GET /api/inventory/:userId`

## ✅ Étape 5 : Personnalisation (Optionnel)

### 5.1 Ajouter Plus de Pokémon

Éditez `backend/data/pokemon.json` et ajoutez vos Pokémon préférés, puis :

```bash
cd backend
node src/database/seed.js
```

### 5.2 Ajuster les Probabilités

Modifiez les `spawn_weight` dans `pokemon.json` :
- Plus le poids est élevé, plus le Pokémon a de chances de spawner
- Exemple : `spawn_weight: 100` = commun, `spawn_weight: 5` = rare

### 5.3 Modifier les Récompenses

Éditez `backend/src/utils/rarity.js` pour ajuster :
- `COIN_REWARDS_CAPTURE` - Récompenses par capture
- `COIN_REWARDS_BATTLE` - Récompenses par combat
- `XP_REWARDS` - Récompenses XP

### 5.4 Personnaliser l'Overlay

Éditez les fichiers dans `frontend/overlay/` :
- `index.html` - Structure
- `styles.css` - Apparence
- `app.js` - Comportement

## 📊 Endpoints API Utiles

### Pour le Développement

- `GET /health` - Vérifier que le serveur fonctionne
- `GET /api/pokemon` - Liste tous les Pokémon
- `GET /api/pokemon?rarity=LEGENDARY` - Filtrer par rareté
- `GET /api/shop/items` - Liste les items de boutique
- `GET /api/event/active` - Événement actif
- `GET /api/user/:id` - Informations d'un utilisateur
- `GET /api/inventory/:userId` - Inventaire d'un utilisateur

### Pour Tester

```bash
# Liste des Pokémon
curl http://localhost:3000/api/pokemon

# Événement actif
curl http://localhost:3000/api/event/active

# Items de boutique
curl http://localhost:3000/api/shop/items
```

## 🎮 Commandes Chat Disponibles

| Commande | Description | Exemple |
|----------|-------------|---------|
| `!capture` | Tenter de capturer le Pokémon actif | `!capture` |
| `!battle` | Voter pour combattre | `!battle` |
| `!flee` | Voter pour fuir | `!flee` |
| `!shop <item> [qty]` | Acheter un item | `!shop pokeball 10` |
| `!spawn` | Spawner un Pokémon (admin/test) | `!spawn` |

## 🐛 Dépannage Rapide

### L'overlay ne s'affiche pas
- Vérifiez que le serveur tourne : http://localhost:3000/health
- Ouvrez la console du navigateur (F12) pour voir les erreurs
- Vérifiez que Socket.io se connecte

### Les commandes ne fonctionnent pas
- Vérifiez que StreamElements est configuré
- Vérifiez les logs du serveur
- Testez l'endpoint webhook avec Postman

### Le Pokémon ne spawn pas
- Vérifiez les logs du serveur
- Vérifiez que la base de données contient des Pokémon : `GET /api/pokemon`
- Vérifiez que `init.js` a été exécuté

## 🚀 Prêt à Streamer !

Une fois toutes ces étapes complétées, votre système est prêt pour un stream en direct !

**Rappel** :
- Gardez `ngrok` ou `localtunnel` actif pendant le stream
- Le serveur doit rester actif
- Testez tout avant le stream en direct

Bon stream ! 🎉


