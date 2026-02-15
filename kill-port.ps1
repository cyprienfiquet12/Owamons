# Script PowerShell pour tuer un processus utilisant un port spécifique
param(
    [Parameter(Mandatory=$true)]
    [int]$Port
)

Write-Host "🔍 Recherche du processus utilisant le port $Port..."

$process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess

if ($process) {
    $processId = $process
    $processInfo = Get-Process -Id $processId -ErrorAction SilentlyContinue
    
    if ($processInfo) {
        Write-Host "📌 Processus trouvé: $($processInfo.ProcessName) (PID: $processId)"
        Write-Host "🛑 Arrêt du processus..."
        
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        
        Start-Sleep -Seconds 1
        
        # Vérifier si le processus est toujours actif
        $stillRunning = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($stillRunning) {
            Write-Host "❌ Le processus est toujours actif. Tentative de force..."
            taskkill /PID $processId /F
        } else {
            Write-Host "✅ Processus arrêté avec succès!"
        }
    } else {
        Write-Host "⚠️  Processus trouvé (PID: $processId) mais informations non disponibles"
        Write-Host "🛑 Tentative d'arrêt..."
        taskkill /PID $processId /F
    }
} else {
    Write-Host "✅ Aucun processus n'utilise le port $Port"
}

# Vérifier à nouveau
Start-Sleep -Seconds 1
$stillInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if ($stillInUse) {
    Write-Host "⚠️  Le port $Port est toujours utilisé"
} else {
    Write-Host "✅ Le port $Port est maintenant libre"
}


