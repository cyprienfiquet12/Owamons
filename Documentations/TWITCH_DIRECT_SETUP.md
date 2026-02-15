# 📡 Configuration Directe avec Twitch (Alternative à Wizebot)

Si Wizebot ne supporte pas les webhooks, vous pouvez connecter votre système directement à Twitch pour écouter les messages du chat.

## Option 1 : Twitch IRC (Recommandé - Simple)

### Avantages
- ✅ Pas besoin de service tiers
- ✅ Connexion directe au chat Twitch
- ✅ Fonctionne avec n'importe quel bot ou aucun bot
- ✅ Gratuit

### Configuration

#### 1. Créer une Application Twitch

1. Allez sur [Twitch Developers](https://dev.twitch.tv/console)
2. Créez un compte développeur si nécessaire
3. Créez une nouvelle application :
   - **Name** : Pokémon Chat System (ou autre)
   - **OAuth Redirect URLs** : `http://localhost:3000` (pour le dev)
   - **Category** : Chat Bot
4. Notez votre **Client ID** et créez un **Client Secret**

#### 2. Obtenir un Token OAuth

**Option A : Via le site Twitch (pour test)**
1. Allez sur : `https://id.twitch.tv/oauth2/authorize?client_id=VOTRE_CLIENT_ID&redirect_uri=http://localhost:3000&response_type=token&scope=chat:read+chat:edit`
2. Autorisez et copiez le token depuis l'URL

**Option B : Via script (automatique)**
Un script sera créé pour automatiser cela.

#### 3. Configurer dans `.env`

```env
TWITCH_CLIENT_ID=votre_client_id
TWITCH_CLIENT_SECRET=votre_client_secret
TWITCH_ACCESS_TOKEN=votre_access_token
TWITCH_CHANNEL=votre_chaine_twitch
```

#### 4. Installation des dépendances

```bash
cd backend
npm install tmi.js
```

#### 5. Le système se connectera automatiquement

Une fois configuré, le système écoutera directement les messages du chat Twitch sans avoir besoin de Wizebot ou StreamElements.

---

## Option 2 : Utiliser StreamElements (Plus Simple)

Si Wizebot ne fonctionne pas, **StreamElements est la meilleure alternative** car :
- ✅ Support natif des webhooks
- ✅ Configuration très simple
- ✅ Interface graphique intuitive
- ✅ Gratuit

Voir `STREAMELEMENTS_SETUP.md` pour les instructions complètes.

---

## Option 3 : Créer un Bot Twitch Personnalisé

Si vous voulez un contrôle total, vous pouvez créer votre propre bot qui écoute le chat et envoie les commandes à votre serveur.

### Avantages
- ✅ Contrôle total
- ✅ Pas de dépendance externe
- ✅ Personnalisable à 100%

### Inconvénients
- ⚠️ Nécessite plus de configuration
- ⚠️ Gestion des tokens OAuth

---

## Recommandation

**Pour la simplicité** : Utilisez **StreamElements** (voir `STREAMELEMENTS_SETUP.md`)

**Pour l'indépendance** : Utilisez **Twitch IRC direct** (Option 1 ci-dessus)

Souhaitez-vous que je configure l'intégration Twitch IRC directe pour vous ?


