@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo ========================================
echo   Owamons - Installation pour streamers
echo ========================================
echo.

REM Vérifier que Docker est installé et démarré
docker info >nul 2>nul
if errorlevel 1 (
    echo [ERREUR] Docker n'est pas installé ou n'est pas démarré.
    echo.
    echo 1. Téléchargez Docker Desktop : https://www.docker.com/products/docker-desktop/
    echo 2. Installez-le et lancez Docker Desktop.
    echo 3. Relancez ce script.
    echo.
    pause
    exit /b 1
)
echo [OK] Docker est prêt.
echo.

REM Créer .env à partir de .env.example si absent
if not exist ".env" (
    echo Création du fichier .env à partir de .env.example...
    copy .env.example .env >nul
    echo [OK] Fichier .env créé.
    echo      Pensez à l'ouvrir pour y mettre votre chaîne Twitch et votre token.
    echo.
) else (
    echo [OK] Fichier .env déjà présent.
    echo.
)

echo Lancement des conteneurs (PostgreSQL + application)...
echo.
docker compose up -d --build
if errorlevel 1 (
    echo [ERREUR] Échec du démarrage des conteneurs.
    pause
    exit /b 1
)

echo.
echo Attente du démarrage du serveur (environ 30 secondes)...
timeout /t 30 /nobreak >nul

echo.
echo Chargement des données initiales (Pokémon, boutique, etc.)...
docker compose exec -T backend npm run seed 2>nul
if errorlevel 1 (
    echo [INFO] Le chargement des données a été ignoré ou a déjà été fait.
) else (
    echo [OK] Données chargées.
)

echo.
echo ========================================
echo   Installation terminée
echo ========================================
echo.
echo 1. Ouvrez le fichier .env et renseignez :
echo    - TWITCH_CHANNEL  = le nom de votre chaîne
echo    - TWITCH_ACCESS_TOKEN = votre token (oauth:xxx)
echo    Obtenir un token : https://twitchtokengenerator.com/
echo.
echo 2. Si vous venez de modifier .env, redémarrez :
echo    docker compose restart backend
echo.
echo 3. Dans OBS, ajoutez une source "Navigateur" avec l'URL :
echo    http://localhost:3000
echo.
echo Pour arrêter l'application : docker compose down
echo.
pause
