#!/bin/sh
# Owamons - Installation pour streamers (Linux / Mac)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "========================================"
echo "  Owamons - Installation pour streamers"
echo "========================================"
echo ""

# Vérifier que Docker est installé et démarré
if ! docker info >/dev/null 2>&1; then
    echo "[ERREUR] Docker n'est pas installé ou n'est pas démarré."
    echo ""
    echo "1. Installez Docker : https://docs.docker.com/get-docker/"
    echo "2. Démarrez Docker, puis relancez ce script."
    echo ""
    exit 1
fi
echo "[OK] Docker est prêt."
echo ""

# Créer .env à partir de .env.example si absent
if [ ! -f .env ]; then
    echo "Création du fichier .env à partir de .env.example..."
    cp .env.example .env
    echo "[OK] Fichier .env créé."
    echo "     Pensez à l'éditer pour y mettre votre chaîne Twitch et votre token."
    echo ""
else
    echo "[OK] Fichier .env déjà présent."
    echo ""
fi

echo "Lancement des conteneurs (PostgreSQL + application)..."
echo ""
docker compose up -d --build

echo ""
echo "Attente du démarrage du serveur (environ 30 secondes)..."
sleep 30

echo ""
echo "Chargement des données initiales (Pokémon, boutique, etc.)..."
if docker compose exec -T backend npm run seed 2>/dev/null; then
    echo "[OK] Données chargées."
else
    echo "[INFO] Le chargement des données a été ignoré ou a déjà été fait."
fi

echo ""
echo "========================================"
echo "  Installation terminée"
echo "========================================"
echo ""
echo "1. Éditez le fichier .env et renseignez :"
echo "   - TWITCH_CHANNEL     = le nom de votre chaîne"
echo "   - TWITCH_ACCESS_TOKEN = votre token (oauth:xxx)"
echo "   Obtenir un token : https://twitchtokengenerator.com/"
echo ""
echo "2. Si vous venez de modifier .env, redémarrez :"
echo "   docker compose restart backend"
echo ""
echo "3. Dans OBS, ajoutez une source « Navigateur » avec l'URL :"
echo "   http://localhost:3000"
echo ""
echo "Pour arrêter l'application : docker compose down"
echo ""
