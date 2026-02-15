# 🔑 Guide : Obtenir un Token Twitch OAuth

Pour utiliser la connexion directe au chat Twitch (alternative à Wizebot/StreamElements), vous avez besoin d'un token OAuth.

## Méthode 1 : Twitch Token Generator (Le Plus Simple)

1. Allez sur [Twitch Token Generator](https://twitchtokengenerator.com/)
2. Sélectionnez les scopes :
   - ✅ `chat:read` - Lire les messages du chat
   - ✅ `chat:edit` - Envoyer des messages (optionnel, pour les réponses)
3. Cliquez sur "Generate Token"
4. Autorisez l'application
5. **Copiez le token** (commence par `oauth:`)

Ajoutez-le dans votre `.env` :
```env
TWITCH_ACCESS_TOKEN=oauth:votre_token_ici
```

## Méthode 2 : Créer une Application Twitch (Plus Contrôle)

### 1. Créer l'Application

1. Allez sur [Twitch Developers Console](https://dev.twitch.tv/console)
2. Connectez-vous avec votre compte Twitch
3. Cliquez sur **"Register Your Application"**
4. Remplissez :
   - **Name** : Pokémon Chat System (ou autre)
   - **OAuth Redirect URLs** : `http://localhost:3000` (pour le dev)
   - **Category** : Chat Bot
5. Cliquez sur **"Create"**
6. Notez votre **Client ID**

### 2. Obtenir le Token

**Option A : Via l'URL d'autorisation (Manuel)**

1. Remplacez `VOTRE_CLIENT_ID` dans cette URL :
```
https://id.twitch.tv/oauth2/authorize?client_id=VOTRE_CLIENT_ID&redirect_uri=http://localhost:3000&response_type=token&scope=chat:read+chat:edit
```

2. Ouvrez cette URL dans votre navigateur
3. Autorisez l'application
4. Vous serez redirigé vers `http://localhost:3000#access_token=OAUTH_TOKEN_ICI`
5. Copiez le token depuis l'URL (la partie après `access_token=`)

**Option B : Via Script (Automatique)**

Créez un fichier `get-twitch-token.js` :

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CLIENT_ID = 'VOTRE_CLIENT_ID';
const REDIRECT_URI = 'http://localhost:3000';

const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=chat:read+chat:edit`;

console.log('🔗 Ouvrez cette URL dans votre navigateur :');
console.log(authUrl);
console.log('\n📋 Après autorisation, copiez le token depuis l\'URL de redirection');
```

### 3. Configurer dans `.env`

```env
TWITCH_CLIENT_ID=votre_client_id
TWITCH_ACCESS_TOKEN=oauth:votre_token
TWITCH_CHANNEL=votre_chaine_twitch
```

## Méthode 3 : Utiliser un Bot Existant

Si vous avez déjà un bot Twitch (comme Nightbot, Streamlabs Bot, etc.), vous pouvez utiliser son token OAuth.

## Vérification

Une fois configuré, redémarrez le serveur :

```bash
npm run dev
```

Vous devriez voir :
```
✅ Connected to Twitch chat as votre_bot_username on irc.chat.twitch.tv:6697
```

## Dépannage

### Erreur : "Invalid token"
- Vérifiez que le token commence par `oauth:`
- Vérifiez que le token n'a pas expiré (les tokens générés via twitchtokengenerator.com expirent après quelques jours)
- Régénérez le token si nécessaire

### Erreur : "Missing required scope"
- Assurez-vous d'avoir sélectionné `chat:read` lors de la génération du token
- Régénérez le token avec les bons scopes

### Le bot ne se connecte pas
- Vérifiez que `TWITCH_CHANNEL` est correct (sans le @)
- Vérifiez que `TWITCH_ACCESS_TOKEN` est correct
- Vérifiez les logs du serveur pour les erreurs

## Token Expiré ?

Les tokens OAuth peuvent expirer. Si le bot se déconnecte, régénérez simplement le token et redémarrez le serveur.

Pour un token permanent, vous devrez utiliser le flux OAuth avec refresh token (plus complexe, voir la documentation Twitch API).


