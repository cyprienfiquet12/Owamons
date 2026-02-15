# Guide de Configuration - Pokémon Twitch Chat System

## 🚀 Démarrage Rapide

### Option A : Docker (recommandé — une seule commande)

Prérequis : [Docker](https://docs.docker.com/get-docker/) et [Docker Compose](https://docs.docker.com/compose/install/).

1. **Créer un fichier `.env`** à la racine du projet avec au minimum (Twitch) :

```env
PORT=3000
TWITCH_CHANNEL=votre_canal
TWITCH_ACCESS_TOKEN=oauth:votre_token
# Optionnel : secrets pour webhooks
STREAMELEMENTS_WEBHOOK_SECRET=
WIZEBOT_WEBHOOK_SECRET=
```

Pour personnaliser la base (optionnel) :

```env
POSTGRES_USER=owamons
POSTGRES_PASSWORD=owamons
POSTGRES_DB=owamons
```

2. **Lancer l’application** :

```bash
docker-compose up -d
```

PostgreSQL et le backend démarrent ; les migrations s’exécutent automatiquement. Le serveur est accessible sur **http://localhost:3000** (ou le `PORT` défini dans `.env`).

3. **Overlay OBS** : ajoutez une source « Navigateur » avec l’URL `http://localhost:3000` (ou `http://votre-ip:PORT` si OBS est sur une autre machine).

4. **Données initiales (premier lancement)** : pour peupler les Pokémon et la boutique, exécutez une fois :  
   `docker-compose exec backend npm run seed`

5. **Arrêter** : `docker-compose down`. Les données PostgreSQL sont conservées dans un volume.

---

### Option B : Installation manuelle (sans Docker)

#### 1. Installation des dépendances

```bash
npm run setup
```

#### 2. Configuration

Créez un fichier `.env` à la racine avec notamment :

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/pokemon_twitch
TWITCH_CHANNEL=your_channel_name
TWITCH_ACCESS_TOKEN=oauth:your_token
STREAMELEMENTS_WEBHOOK_SECRET=your_secret_here
```

#### 3. Initialisation de la base de données

PostgreSQL doit être installé et accessible. Puis :

```bash
cd backend
npm run migrate
npm run seed
```

#### 4. Démarrage du serveur

```bash
# Depuis la racine
npm run dev

# Ou depuis le backend
cd backend
npm run dev
```

Le serveur sera accessible sur `http://localhost:3000`

## 📡 Configuration StreamElements

1. Allez sur [StreamElements Dashboard](https://streamelements.com/dashboard)
2. Créez un webhook personnalisé pointant vers : `http://votre-serveur:3000/webhook/streamelements`
3. Configurez le secret dans votre `.env`

## 🎨 Utilisation de l'Overlay

1. Ouvrez `http://localhost:3000` dans votre navigateur
2. L'overlay s'affichera automatiquement lors des événements
3. Pour OBS, ajoutez une source "Navigateur" pointant vers cette URL

## 🎮 Commandes Disponibles

- `!capture` - Tenter de capturer le Pokémon actif
- `!battle` - Voter pour combattre
- `!flee` - Voter pour fuir
- `!shop <item> [quantity]` - Acheter un item (ex: `!shop pokeball 10`)
- `!spawn` - Spawner un Pokémon (pour tests)

## 📊 API Endpoints

- `GET /health` - Health check
- `GET /api/user/:id` - Informations utilisateur
- `GET /api/inventory/:userId` - Inventaire
- `POST /api/shop` - Achat d'item
- `GET /api/event/active` - Événement actif
- `GET /api/pokemon` - Liste des Pokémon

## 🐛 Dépannage

### La base de données ne se crée pas

Vérifiez que le dossier `backend/data/` existe et est accessible en écriture.

### Les Pokémon ne spawnent pas

1. Vérifiez que la base de données est initialisée : `npm run seed`
2. Vérifiez les logs du serveur pour les erreurs

### L'overlay ne s'affiche pas

1. Vérifiez que le serveur est démarré
2. Ouvrez la console du navigateur (F12) pour voir les erreurs
3. Vérifiez que Socket.io se connecte correctement

## 📝 Notes

- En développement, SQLite est utilisé automatiquement
- Pour la production, configurez `DATABASE_URL` pour PostgreSQL
- Les légendaires ont un cooldown global de 1 heure
- Les votes expirent après 30s (45s pour les légendaires)


