# Owamons – Overlay Pokémon pour Twitch

Système interactif pour ton stream : le chat peut capturer des Pokémon, voter pour combattre ou fuir, gagner de l’XP et des Pokécoins, acheter des balls et affronter des arènes.

---

## Ce dont tu as besoin

- **Docker** (c’est tout)  
  - Windows / Mac : [Docker Desktop](https://www.docker.com/products/docker-desktop/)  
  - Linux : [Installer Docker](https://docs.docker.com/get-docker/)

---

## Installation (en une fois)

1. **Télécharge le projet** (ZIP ou clone) et ouvre un terminal dans le dossier du projet.

2. **Lance le script d’installation** :
   - **Windows** : double-clique sur `install.bat` ou exécute-le dans l’invite de commandes.
   - **Mac / Linux** : dans le terminal, écris :
     ```bash
     chmod +x install.sh
     ./install.sh
     ```

3. Le script va :
   - Vérifier que Docker fonctionne
   - Créer un fichier `.env` s’il n’existe pas
   - Lancer l’application et la base de données
   - Charger les données (Pokémon, boutique, etc.)

Quand tu vois **« Installation terminée »**, c’est bon.

---

## Configuration Twitch

Ouvre le fichier **`.env`** à la racine du projet et remplis au minimum :

| Variable | À mettre |
|----------|----------|
| `TWITCH_CHANNEL` | Le nom de **ta chaîne** (sans @) |
| `TWITCH_ACCESS_TOKEN` | Un token OAuth (commence par `oauth:...`) |

**Où obtenir un token ?**  
→ [twitchtokengenerator.com](https://twitchtokengenerator.com/) (connexion avec ton compte Twitch, copie le token dans `.env`).

Si tu modifies le `.env` après la première installation, redémarre l’app :

```bash
docker compose restart backend
```

---

## Overlay dans OBS

1. Dans OBS, ajoute une source **« Navigateur »** (Browser Source).
2. Dans l’URL, mets : **`http://localhost:3000`**  
   (Si OBS est sur un autre PC que l’app, remplace `localhost` par l’adresse IP du PC où tourne Docker.)

L’overlay s’affichera pendant les événements (spawn, capture, combat, etc.).

---

## Commandes utiles

| Action | Commande |
|--------|----------|
| Tout lancer | `docker compose up -d` |
| Tout arrêter | `docker compose down` |
| Redémarrer l’app après modification du `.env` | `docker compose restart backend` |

---

## En cas de problème

- **Docker ne se lance pas**  
  Vérifie que Docker Desktop (ou le service Docker sous Linux) est bien démarré, puis relance le script d’installation.

- **L’overlay ne s’affiche pas**  
  Vérifie que l’URL dans OBS est bien `http://localhost:3000` (ou l’IP du serveur) et que les conteneurs tournent (`docker compose ps`).

- **Le chat ne réagit pas**  
  Vérifie dans `.env` que `TWITCH_CHANNEL` et `TWITCH_ACCESS_TOKEN` sont corrects, puis redémarre le backend.

Pour plus de détails (webhooks StreamElements/Wizebot, spawn auto, etc.), consulte le dossier **Documentations/**.

---

## Pour les développeurs

- Installation manuelle (sans Docker) : voir [Documentations/SETUP.md](Documentations/SETUP.md).
- Structure du projet : backend (Node.js, Express, Socket.io), frontend (overlay), PostgreSQL en Docker.
