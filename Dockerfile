# Build depuis la racine du monorepo (workspace backend + frontend)
FROM node:20-alpine

# Client PostgreSQL pour pg_restore (seed depuis le dump)
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Fichiers de dépendances (racine + backend pour workspace + file:..)
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package-lock.json* backend/

# Install des dépendances à la racine (workspace installe le backend)
RUN npm install

# Code applicatif
COPY backend/ backend/
COPY frontend/ frontend/
# Dump pour le seed (peuplement initial de la BDD)
COPY pokemon_twitch_backup.dump ./

# Script d'entrée : attendre la DB, migrer, lancer le serveur
COPY backend/docker-entrypoint.sh backend/docker-entrypoint.sh
# Corriger les fins de ligne CRLF (Windows) → LF pour Linux
RUN sed -i 's/\r$//' backend/docker-entrypoint.sh && chmod +x backend/docker-entrypoint.sh

WORKDIR /app/backend

# dotenv charge .env depuis le CWD ; en Docker les variables viennent du compose
EXPOSE 3000

# Exécuter via sh pour éviter tout souci de shebang / CRLF
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
