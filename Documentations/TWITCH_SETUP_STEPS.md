# 🚀 Configuration Rapide : Token Twitch

## Étapes Suivantes

### 1. Ajouter le Token dans `.env`

Ouvrez votre fichier `.env` à la racine du projet et ajoutez/modifiez ces lignes :

```env
TWITCH_ACCESS_TOKEN=oauth:votre_token_ici
TWITCH_CHANNEL=votre_chaine_twitch
```

**Important** :
- Si votre token ne commence **PAS** par `oauth:`, ajoutez-le : `oauth:votre_token`
- Remplacez `votre_chaine_twitch` par le nom de votre chaîne **sans le @** (ex: `monchaine` et non `@monchaine`)

### 2. Vérifier la Configuration

Votre fichier `.env` devrait contenir au minimum :

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pokemon_twitch

# Twitch Chat (Connexion Directe)
TWITCH_ACCESS_TOKEN=oauth:votre_token_ici
TWITCH_CHANNEL=votre_chaine_twitch
```

### 3. Redémarrer le Serveur

```bash
# Arrêtez le serveur actuel (Ctrl+C)
# Puis redémarrez :
npm run dev
```

### 4. Vérifier la Connexion

Vous devriez voir dans les logs :

```
✅ Database ready
📡 Connecting to Twitch chat...
✅ Connected to Twitch chat as votre_bot_username on irc.chat.twitch.tv:6697
🚀 Server running on port 3000
📡 Socket.io ready for connections
```

### 5. Tester dans le Chat

Allez dans votre chat Twitch et testez :
- `!capture` - Devrait tenter une capture
- `!battle` - Devrait enregistrer un vote
- `!flee` - Devrait enregistrer un vote
- `!shop pokeball 10` - Devrait acheter des items
- `!spawn` - Devrait spawner un Pokémon (modérateurs seulement)

## Dépannage

### Le bot ne se connecte pas

**Erreur : "Invalid token"**
- Vérifiez que le token commence par `oauth:`
- Vérifiez que le token n'a pas expiré
- Régénérez le token si nécessaire

**Erreur : "Missing required scope"**
- Le token doit avoir les scopes `chat:read` et `chat:edit`
- Régénérez le token avec les bons scopes

**Erreur : "Cannot find module 'tmi.js'"**
- Installez la dépendance : `cd backend && npm install tmi.js`

### Le bot se connecte mais ne répond pas

- Vérifiez que `TWITCH_CHANNEL` est correct (sans @)
- Vérifiez que le bot a les permissions dans votre chat
- Vérifiez les logs du serveur pour les erreurs

### Le token expire

Les tokens générés via twitchtokengenerator.com expirent après quelques jours. Si le bot se déconnecte :
1. Régénérez le token
2. Mettez à jour `.env`
3. Redémarrez le serveur

## Commandes Disponibles

| Commande | Description | Qui peut l'utiliser |
|----------|-------------|---------------------|
| `!capture` | Tenter de capturer le Pokémon actif | Tous |
| `!battle` | Voter pour combattre | Tous |
| `!flee` | Voter pour fuir | Tous |
| `!shop <item> [qty]` | Acheter un item | Tous |
| `!spawn` | Spawner un Pokémon | Modérateurs seulement |

## Prochaines Étapes

Une fois que tout fonctionne :
1. ✅ Testez toutes les commandes dans votre chat
2. ✅ Vérifiez que l'overlay s'affiche correctement
3. ✅ Configurez l'overlay dans OBS
4. ✅ Prêt à streamer ! 🎉


