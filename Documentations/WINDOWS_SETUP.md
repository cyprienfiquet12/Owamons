# Installation sur Windows - Guide Complet

## Problème : better-sqlite3 nécessite des outils de compilation

Le package `better-sqlite3` est un module natif qui nécessite des outils de compilation C++ sur Windows.

## Solution 1 : Installer Visual Studio Build Tools (Recommandé)

### Option A : Visual Studio Build Tools (Léger)

1. Téléchargez **Visual Studio Build Tools** depuis :
   https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022

2. Lors de l'installation, sélectionnez :
   - **"Desktop development with C++"** workload
   - Cochez toutes les options sous cette workload

3. Redémarrez votre terminal/PowerShell

4. Réessayez l'installation :
   ```bash
   npm run setup
   ```

### Option B : Visual Studio Community (Complet)

1. Téléchargez **Visual Studio Community** (gratuit) :
   https://visualstudio.microsoft.com/vs/community/

2. Lors de l'installation, sélectionnez :
   - **"Desktop development with C++"** workload

3. Redémarrez votre terminal

4. Réessayez :
   ```bash
   npm run setup
   ```

## Solution 2 : Utiliser PostgreSQL (Alternative)

Si vous préférez ne pas installer les build tools, vous pouvez utiliser PostgreSQL même en développement :

1. Installez PostgreSQL : https://www.postgresql.org/download/windows/

2. Créez une base de données :
   ```sql
   CREATE DATABASE pokemon_twitch;
   ```

3. Configurez votre `.env` :
   ```env
   NODE_ENV=development
   DATABASE_URL=postgresql://postgres:password@localhost:5432/pokemon_twitch
   ```

4. Installez les dépendances (sans better-sqlite3) :
   ```bash
   cd backend
   npm install --ignore-scripts
   ```

5. Le système utilisera automatiquement PostgreSQL au lieu de SQLite.

## Solution 3 : Utiliser WSL (Windows Subsystem for Linux)

Si vous avez WSL installé :

1. Ouvrez WSL
2. Naviguez vers votre projet
3. Exécutez `npm run setup`
4. Les outils de compilation Linux sont généralement plus faciles à installer

## Vérification

Après avoir installé les build tools, vérifiez que tout fonctionne :

```bash
npm run setup
cd backend
node src/server.js
```

Si vous voyez "🚀 Server running on port 3000", tout est OK !

## Dépannage

### Erreur : "Could not find any Visual Studio installation"

- Assurez-vous d'avoir installé "Desktop development with C++"
- Redémarrez votre terminal après l'installation
- Essayez de fermer et rouvrir votre IDE

### Erreur : "node-gyp rebuild failed"

- Vérifiez que Python est installé (requis par node-gyp)
- Vérifiez que vous avez les permissions d'administration si nécessaire

### Alternative rapide : Utiliser npm avec --build-from-source

Parfois, forcer la compilation depuis les sources peut aider :

```bash
npm install better-sqlite3 --build-from-source
```

## Note

Une fois les build tools installés, vous n'aurez plus besoin de les réinstaller pour d'autres projets Node.js utilisant des modules natifs.


