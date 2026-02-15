# 📡 Configuration StreamElements

## Option 1 : StreamElements (Recommandé)

### Avantages
- ✅ Interface graphique complète
- ✅ Gestion des webhooks intégrée
- ✅ Support des événements Twitch
- ✅ Facile à configurer

### Configuration

#### 1. Créer un compte StreamElements

1. Allez sur [StreamElements](https://streamelements.com)
2. Connectez-vous avec votre compte Twitch
3. Autorisez les permissions nécessaires

#### 2. Exposer votre serveur local

Pour que StreamElements puisse envoyer des webhooks à votre serveur local, vous devez l'exposer publiquement.

**Option A : ngrok (Recommandé)**
```bash
# Téléchargez ngrok depuis https://ngrok.com/download
ngrok authtoken VOTRE_TOKEN
ngrok http 3000
```

Copiez l'URL HTTPS (ex: `https://abc123.ngrok.io`)

**Option B : localtunnel (Gratuit)**
```bash
npm install -g localtunnel
lt --port 3000
```

#### 3. Configurer le Webhook dans StreamElements

**Méthode 1 : Via l'API (Recommandé)**

1. Allez sur [StreamElements Dashboard](https://streamelements.com/dashboard)
2. Allez dans **Settings** → **API**
3. Créez un nouveau webhook :
   - **URL** : `https://votre-url-ngrok.io/webhook/streamelements`
   - **Method** : POST
   - **Events** : Sélectionnez "Chat Message" ou "All Events"

**Méthode 2 : Via Custom Commands**

1. Allez dans **Commands** → **Custom Commands**
2. Créez une commande pour chaque action :
   - `!capture` → Webhook vers `https://votre-url-ngrok.io/webhook/streamelements`
   - `!battle` → Webhook vers `https://votre-url-ngrok.io/webhook/streamelements`
   - `!flee` → Webhook vers `https://votre-url-ngrok.io/webhook/streamelements`

#### 4. Configurer le Secret (Optionnel mais Recommandé)

Dans votre `.env`, ajoutez :
```env
STREAMELEMENTS_WEBHOOK_SECRET=votre_secret_ici
```

Puis configurez ce même secret dans StreamElements.

### Format des données StreamElements

Le système attend ce format dans le webhook :
```json
{
  "message": "!capture",
  "username": "nom_utilisateur",
  "userId": "twitch_user_id",
  "twitchId": "twitch_user_id"
}
```

Le système accepte aussi :
- `text` au lieu de `message`
- `user` au lieu de `username`

---

## Option 2 : Wizebot

### ⚠️ Important : Wizebot ne supporte PAS les webhooks natifs

Wizebot est principalement un bot de chat et **ne propose pas de système de webhooks** comme StreamElements. 

### Solutions Alternatives

#### Solution A : Connexion Directe Twitch (Recommandé)

Au lieu d'utiliser Wizebot, connectez-vous **directement au chat Twitch**. C'est plus simple et ne nécessite aucun service tiers.

**Voir `TWITCH_DIRECT_SETUP.md` pour les instructions complètes.**

**Avantages** :
- ✅ Pas besoin de Wizebot ou StreamElements
- ✅ Connexion directe au chat
- ✅ Fonctionne immédiatement
- ✅ Gratuit

#### Solution B : Utiliser StreamElements

Si vous voulez utiliser un service tiers, **StreamElements est la meilleure option** car il supporte nativement les webhooks.

Voir la section "Option 1 : StreamElements" ci-dessus.

#### Solution C : Wizebot avec Commandes Personnalisées (Complexe)

Si vous voulez absolument utiliser Wizebot, vous pouvez créer des commandes qui font des requêtes HTTP vers votre serveur, mais c'est plus complexe et moins fiable.

**Note** : Le système supporte toujours l'endpoint `/webhook/wizebot` au cas où vous trouveriez un moyen de l'utiliser, mais Wizebot lui-même ne supporte pas les webhooks.

---

## Comparaison

| Fonctionnalité | StreamElements | Wizebot |
|----------------|----------------|---------|
| Interface graphique | ✅ Excellente | ✅ Bonne |
| Webhooks natifs | ✅ Oui | ⚠️ Via commandes |
| Configuration | ✅ Facile | ✅ Facile |
| Support événements | ✅ Complet | ⚠️ Limité |
| Gratuit | ✅ Oui | ✅ Oui |

---

## Recommandation

**Utilisez StreamElements** si vous voulez :
- Une configuration simple
- Un support complet des événements Twitch
- Une interface intuitive

**Utilisez Wizebot** si vous :
- Utilisez déjà Wizebot pour d'autres fonctionnalités
- Préférez un seul bot pour tout gérer
- N'avez pas besoin de fonctionnalités avancées

---

## Test de la Configuration

Une fois configuré, testez dans votre chat Twitch :
- `!capture` - Devrait tenter une capture
- `!battle` - Devrait enregistrer un vote
- `!flee` - Devrait enregistrer un vote
- `!shop pokeball 10` - Devrait acheter des items

Vérifiez les logs du serveur pour voir les requêtes reçues.

