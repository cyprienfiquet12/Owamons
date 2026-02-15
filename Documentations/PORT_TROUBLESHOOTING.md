# 🔧 Dépannage : Port Déjà Utilisé (EADDRINUSE)

## Erreur
```
Error: listen EADDRINUSE: address already in use :::3000
```

## Solutions Rapides

### Solution 1 : Utiliser le script PowerShell (Recommandé)

```powershell
.\kill-port.ps1 -Port 3000
```

### Solution 2 : Trouver et tuer manuellement

1. **Trouver le processus** :
   ```powershell
   netstat -ano | findstr :3000
   ```

2. **Tuer le processus** (remplacez PID par le numéro trouvé) :
   ```powershell
   taskkill /PID <PID> /F
   ```

### Solution 3 : Utiliser un autre port

Modifiez votre fichier `.env` :
```env
PORT=3001
```

Puis redémarrez le serveur.

### Solution 4 : Arrêter tous les processus Node.js

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

## Prévention

### Vérifier avant de démarrer

```powershell
# Vérifier si le port est libre
$port = 3000
$inUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($inUse) {
    Write-Host "⚠️  Le port $port est utilisé"
    Write-Host "Utilisez: .\kill-port.ps1 -Port $port"
} else {
    Write-Host "✅ Le port $port est libre"
}
```

### Arrêter proprement le serveur

Au lieu de fermer brutalement le terminal, utilisez `Ctrl+C` dans le terminal où le serveur tourne.

## Script Automatique

Créez un fichier `start-server.ps1` :

```powershell
# Vérifier et libérer le port si nécessaire
$port = 3000
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess

if ($process) {
    Write-Host "🛑 Arrêt du processus utilisant le port $port..."
    Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Host "🚀 Démarrage du serveur..."
npm run dev
```

Puis utilisez :
```powershell
.\start-server.ps1
```


