# Backend - Pokémon Twitch Chat System

## Installation

```bash
npm install
```

## Configuration

Créez un fichier `.env` à la racine du backend avec :

```env
PORT=3000
NODE_ENV=development
DB_PATH=./data/database.sqlite
TWITCH_CHANNEL=your_channel_name
STREAMELEMENTS_WEBHOOK_SECRET=your_secret
```

## Initialisation de la base de données

```bash
# Créer le schéma et seed les données
npm run migrate
npm run seed
```

Ou utiliser le script d'initialisation complet :

```bash
node src/database/init.js
```

## Démarrage

```bash
# Mode développement (avec watch)
npm run dev

# Mode production
npm start
```

## Structure

- `src/server.js` - Point d'entrée principal
- `src/routes/` - Routes API REST
- `src/websocket/` - Gestionnaires Socket.io
- `src/services/` - Logique métier
- `src/database/` - Connexion DB et migrations
- `src/integrations/` - Intégrations externes (StreamElements)
- `src/utils/` - Helpers et utilitaires

## API Endpoints

- `GET /health` - Health check
- `GET /api/user/:id` - Informations utilisateur
- `GET /api/inventory/:userId` - Inventaire utilisateur
- `POST /api/shop` - Achat d'item
- `GET /api/event/active` - Événement actif
- `POST /webhook/streamelements` - Webhook StreamElements

## Commandes StreamElements

- `!capture` - Tenter de capturer le Pokémon actif
- `!battle` - Voter pour combattre
- `!flee` - Voter pour fuir
- `!shop <item> [quantity]` - Acheter un item
- `!spawn` - Spawner un Pokémon (admin/test)


