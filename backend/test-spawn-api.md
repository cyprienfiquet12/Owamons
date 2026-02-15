# 🧪 Tester le Spawn via l'API

## Problème avec test.js

Le fichier `test.js` ne doit PAS être utilisé si le serveur tourne déjà, car il essaie de démarrer le serveur et cause l'erreur `EADDRINUSE`.

## Solution Recommandée : Utiliser l'Endpoint API

### 1. Démarrer le serveur (dans un terminal)

```bash
npm run dev
```

### 2. Ouvrir l'overlay (dans votre navigateur)

```
http://localhost:3000
```

### 3. Spawner un Pokémon (dans un autre terminal)

#### Option A : Via curl (Linux/Mac/Git Bash)

```bash
curl -X POST http://localhost:3000/api/spawn
```

#### Option B : Via PowerShell (Windows)

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/spawn -Method POST
```

#### Option C : Via le navigateur (avec extension)

Installez une extension comme "REST Client" ou utilisez Postman.

#### Option D : Créer un fichier HTML simple

Créez `test-spawn.html` :

```html
<!DOCTYPE html>
<html>
<head>
    <title>Test Spawn</title>
</head>
<body>
    <button onclick="spawn()">Spawn Pokémon</button>
    <div id="result"></div>
    
    <script>
        async function spawn() {
            try {
                const response = await fetch('http://localhost:3000/api/spawn', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const data = await response.json();
                document.getElementById('result').innerHTML = 
                    '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
                document.getElementById('result').innerHTML = 
                    '<p style="color: red;">Erreur: ' + error.message + '</p>';
            }
        }
    </script>
</body>
</html>
```

Ouvrez ce fichier dans votre navigateur et cliquez sur le bouton.

## Alternative : Script PowerShell

Créez `spawn-pokemon.ps1` :

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/spawn" -Method POST
$data = $response.Content | ConvertFrom-Json
Write-Host "✅ $($data.message)"
Write-Host "Pokémon: $($data.event.pokemon.name)"
Write-Host "Niveau: $($data.event.level)"
```

Puis exécutez :
```powershell
.\spawn-pokemon.ps1
```

## Vérification

Après avoir spawné un Pokémon :
1. L'overlay dans votre navigateur devrait afficher le Pokémon
2. Le sprite devrait être visible
3. Le timer devrait commencer à décompter

## Dépannage

### Le Pokémon ne s'affiche pas

1. Vérifiez que le serveur tourne : `http://localhost:3000/health`
2. Ouvrez la console du navigateur (F12) et vérifiez les erreurs
3. Vérifiez les logs du serveur

### Erreur "already in progress"

Un événement est déjà actif. Attendez qu'il expire (30 secondes) ou réinitialisez la base de données.


