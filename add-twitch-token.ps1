# Script pour ajouter le token Twitch au fichier .env
# Usage: .\add-twitch-token.ps1 "votre_token_ici"

param(
    [Parameter(Mandatory=$true)]
    [string]$Token
)

$envFile = ".env"

if (-not (Test-Path $envFile)) {
    Write-Host "❌ Fichier .env non trouvé!" -ForegroundColor Red
    Write-Host "💡 Créez d'abord le fichier .env" -ForegroundColor Yellow
    exit 1
}

# S'assurer que le token commence par oauth:
if (-not $Token.StartsWith("oauth:")) {
    $Token = "oauth:$Token"
}

# Lire le contenu actuel
$content = Get-Content $envFile -Raw

# Vérifier si TWITCH_ACCESS_TOKEN existe déjà
if ($content -match "TWITCH_ACCESS_TOKEN\s*=") {
    # Remplacer la ligne existante
    $content = $content -replace "TWITCH_ACCESS_TOKEN\s*=.*", "TWITCH_ACCESS_TOKEN=$Token"
    Write-Host "✅ Token Twitch mis à jour dans .env" -ForegroundColor Green
} else {
    # Ajouter la ligne
    if (-not $content.EndsWith("`n")) {
        $content += "`n"
    }
    $content += "`n# Twitch Chat Token`n"
    $content += "TWITCH_ACCESS_TOKEN=$Token`n"
    Write-Host "✅ Token Twitch ajouté dans .env" -ForegroundColor Green
}

# Écrire le fichier
Set-Content -Path $envFile -Value $content -NoNewline

Write-Host ""
Write-Host "📋 Configuration actuelle:" -ForegroundColor Cyan
Get-Content $envFile | Select-String -Pattern "TWITCH" | ForEach-Object {
    if ($_ -match "TWITCH_ACCESS_TOKEN") {
        $masked = $_ -replace "oauth:[^`r`n]+", "oauth:*****"
        Write-Host "  $masked" -ForegroundColor Gray
    } else {
        Write-Host "  $_" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "🚀 Redémarrez le serveur avec: npm run dev" -ForegroundColor Yellow


