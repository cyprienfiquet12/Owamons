# ⚠️ Problème d'Installation - better-sqlite3

## Le Problème

Le package `better-sqlite3` nécessite des outils de compilation C++ (Visual Studio Build Tools) sur Windows. C'est normal et attendu.

## ✅ Solutions

### Option 1 : Installer Visual Studio Build Tools (Recommandé - 5-10 min)

1. **Téléchargez Visual Studio Build Tools** :
   - Allez sur : https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
   - Téléchargez "Build Tools for Visual Studio 2022"

2. **Installez avec la workload C++** :
   - Lancez l'installateur
   - Cochez **"Desktop development with C++"**
   - Cliquez sur "Install"

3. **Redémarrez votre terminal** (fermez et rouvrez PowerShell/CMD)

4. **Réessayez l'installation** :
   ```bash
   npm run setup
   ```

### Option 2 : Utiliser PostgreSQL (Alternative - Pas de compilation)

Si vous préférez éviter l'installation des build tools :

1. **Installez PostgreSQL** :
   - Téléchargez : https://www.postgresql.org/download/windows/
   - Installez avec les paramètres par défaut

2. **Créez la base de données** :
   - Ouvrez pgAdmin ou psql
   - Exécutez : `CREATE DATABASE pokemon_twitch;`

3. **Modifiez votre `.env`** :
   ```env
   NODE_ENV=development
   DATABASE_URL=postgresql://postgres:votre_mot_de_passe@localhost:5432/pokemon_twitch
   ```

4. **Installez les dépendances sans better-sqlite3** :
   ```bash
   # Supprimez better-sqlite3 du package.json temporairement
   # Puis :
   cd backend
   npm install
   ```

### Option 3 : Utiliser WSL (Si vous avez WSL)

Si vous avez Windows Subsystem for Linux :

```bash
wsl
cd /mnt/c/Users/cypri/Documents/Projets/Owamons
npm run setup
```

## 📝 Note Importante

Une fois les **Visual Studio Build Tools** installés, vous pourrez installer n'importe quel module natif Node.js sans problème. C'est un investissement unique qui servira pour tous vos futurs projets.

## 🚀 Après l'Installation

Une fois que `npm run setup` fonctionne :

```bash
# Initialiser la base de données
cd backend
node src/database/init.js

# Démarrer le serveur
npm run dev
```

## ❓ Besoin d'Aide ?

Si vous rencontrez toujours des problèmes après avoir installé les build tools :
- Vérifiez que vous avez bien redémarré votre terminal
- Vérifiez que "Desktop development with C++" est bien installé
- Essayez de fermer et rouvrir votre IDE


