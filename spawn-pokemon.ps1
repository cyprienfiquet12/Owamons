# Script PowerShell pour spawner un Pokémon via l'API
# Assurez-vous que le serveur tourne: npm run dev

$url = "http://localhost:3000/api/spawn"

Write-Host "🔄 Spawning a Pokémon..." -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -ErrorAction Stop
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "✅ $($data.message)" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Détails:" -ForegroundColor Yellow
        Write-Host "  - Pokémon: $($data.event.pokemon.name)"
        Write-Host "  - Niveau: $($data.event.level)"
        Write-Host "  - Timer: $($data.event.voteDuration) secondes"
        Write-Host ""
        Write-Host "💡 Ouvrez http://localhost:3000 dans votre navigateur pour voir l'overlay!" -ForegroundColor Magenta
    } else {
        Write-Host "❌ Erreur: $($data.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur de connexion:" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Assurez-vous que le serveur tourne:" -ForegroundColor Yellow
    Write-Host "   npm run dev" -ForegroundColor Yellow
}


