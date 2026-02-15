# Variables d'Environnement

Créez un fichier `.env` à la racine du projet avec les variables suivantes :

## Configuration Serveur

```env
PORT=3000
```
Port sur lequel le serveur écoute (défaut: 3000)

```env
NODE_ENV=development
```
Environnement d'exécution : `development` ou `production`

## Configuration Base de Données

### SQLite (Développement)
```env
DB_PATH=./backend/data/database.sqlite
```
Chemin vers le fichier SQLite (utilisé si `NODE_ENV=development`)

### PostgreSQL (Production)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/pokemon_twitch
```
URL de connexion PostgreSQL (utilisé si `NODE_ENV=production` et `DATABASE_URL` est défini)

```env
DATABASE_SSL=true
```
Active SSL pour PostgreSQL (optionnel, défaut: false)

## Configuration Twitch

```env
TWITCH_CHANNEL=your_channel_name
```
Nom de votre canal Twitch (sans le @)

### Pour la connexion directe au chat (Alternative à StreamElements/Wizebot)

```env
TWITCH_BOT_USERNAME=your_bot_username
```
Nom d'utilisateur du bot (optionnel, utilise TWITCH_CHANNEL par défaut)

```env
TWITCH_ACCESS_TOKEN=oauth:your_oauth_token
```
Token OAuth pour se connecter au chat Twitch. Obtenez-le via : https://twitchtokengenerator.com/ ou créez une app sur https://dev.twitch.tv/console

### Configuration Spawn Automatique

```env
AUTO_SPAWN_ENABLED=true
```
Active le spawn automatique de Pokémon (défaut: true). Mettez à `false` pour désactiver.

```env
AUTO_SPAWN_MIN_MINUTES=5
```
Intervalle minimum en minutes entre les spawns automatiques (défaut: 5 minutes, min: 1)

```env
AUTO_SPAWN_MAX_MINUTES=15
```
Intervalle maximum en minutes entre les spawns automatiques (défaut: 15 minutes, max: 60)

**Note** : Le délai entre chaque spawn est **aléatoire** entre `AUTO_SPAWN_MIN_MINUTES` et `AUTO_SPAWN_MAX_MINUTES`.

## Configuration StreamElements

```env
STREAMELEMENTS_WEBHOOK_SECRET=your_secret_here
```
Secret pour valider les webhooks StreamElements (optionnel mais recommandé)

## Configuration Wizebot

```env
WIZEBOT_WEBHOOK_SECRET=your_secret_here
```
Secret pour valider les webhooks Wizebot (optionnel mais recommandé)

## Exemple de fichier .env complet

```env
# Server
PORT=3000
NODE_ENV=development

# Database (SQLite pour dev)
DB_PATH=./backend/data/database.sqlite

# Database (PostgreSQL pour prod)
# DATABASE_URL=postgresql://user:password@localhost:5432/pokemon_twitch
# DATABASE_SSL=false

# Twitch
TWITCH_CHANNEL=your_channel_name

# StreamElements
STREAMELEMENTS_WEBHOOK_SECRET=your_secret_here
```

## Notes

- Ne commitez JAMAIS le fichier `.env` dans Git
- Le fichier `.env` est déjà dans `.gitignore`
- Copiez `.env.example` (s'il existe) ou créez votre propre `.env`
- Pour la production, utilisez des variables d'environnement système plutôt qu'un fichier `.env`

