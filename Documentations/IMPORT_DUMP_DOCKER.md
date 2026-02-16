# Importer `pokemon_twitch_backup.dump` dans la BDD Docker

Commandes pour restaurer le dump PostgreSQL dans la base du conteneur **owamons-db**.

**Prérequis :** le fichier `pokemon_twitch_backup.dump` est à la racine du projet (`Owamons/pokemon_twitch_backup.dump`).  
Si ta base Docker utilise d’autres identifiants (`.env` avec `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`), remplace `owamons` / le mot de passe dans les commandes.

---

## 1. Démarrer Postgres (si besoin)

```bash
cd C:\Users\cypri\Documents\Projets\Owamons
docker compose up -d postgres
```

---

## 2. Copier le dump dans le conteneur

```bash
docker cp pokemon_twitch_backup.dump owamons-db:/tmp/pokemon_twitch_backup.dump
```

*(Si le dump est ailleurs, remplace `pokemon_twitch_backup.dump` par le chemin relatif au dossier courant.)*

---

## 3. Supprimer la table absente du dump (éviter les erreurs de pg_restore)

```bash
docker exec owamons-db psql -U owamons -d owamons -c "DROP TABLE IF EXISTS user_pokedex CASCADE"
```

---

## 4. Restaurer le dump

```bash
docker exec owamons-db pg_restore --no-owner --no-acl --clean --if-exists -U owamons -d owamons /tmp/pokemon_twitch_backup.dump
```

*(Les avertissements "errors ignored on restore" peuvent apparaître ; si la restauration des données principales a bien eu lieu, c’est souvent acceptable.)*

---

## 5. Recréer la table `user_pokedex` (migration 010)

```bash
docker cp backend/src/database/migrations/010_user_pokedex.sql owamons-db:/tmp/010_user_pokedex.sql
docker exec owamons-db psql -U owamons -d owamons -f /tmp/010_user_pokedex.sql
```

---

## 6. (Optionnel) Vérifier les tables

```bash
docker exec owamons-db psql -U owamons -d owamons -c "\dt"
```

---

## Résumé en un bloc (copier-coller)

À exécuter depuis la **racine du projet** (`Owamons`) :

```bash
docker compose up -d postgres
docker cp pokemon_twitch_backup.dump owamons-db:/tmp/pokemon_twitch_backup.dump
docker exec owamons-db psql -U owamons -d owamons -c "DROP TABLE IF EXISTS user_pokedex CASCADE"
docker exec owamons-db pg_restore --no-owner --no-acl --clean --if-exists -U owamons -d owamons /tmp/pokemon_twitch_backup.dump
docker cp backend/src/database/migrations/010_user_pokedex.sql owamons-db:/tmp/010_user_pokedex.sql
docker exec owamons-db psql -U owamons -d owamons -f /tmp/010_user_pokedex.sql
docker exec owamons-db psql -U owamons -d owamons -c "\dt"
```

Si ton `.env` définit d’autres valeurs pour la BDD Docker (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`), remplace `owamons` (user et base) et le mot de passe dans les commandes `psql` et `pg_restore`.

---

# Créer un backup (dump) de la BDD Docker

**Format par défaut : .sql** (réimport avec `psql`).

**Important (surtout sous Windows) :** ne pas utiliser de redirection `> backup.sql` avec `docker exec ... pg_dump`. La sortie passe par le shell et peut corrompre le format (tabs, `\N`, fins de ligne), ce qui provoque des erreurs à l’import du type *syntax error at or near "14"* sur les blocs `COPY ... FROM stdin`.

## Dump au format SQL (.sql)

À exécuter depuis la **racine du projet**.

**Bash :**
```bash
docker exec owamons-db pg_dump -U owamons -d owamons -f /tmp/backup.sql
docker cp owamons-db:/tmp/backup.sql ./backup_$(date +%Y%m%d_%H%M%S).sql
```

**PowerShell (nom de fichier daté) :**
```powershell
$name = "backup_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".sql"
docker exec owamons-db pg_dump -U owamons -d owamons -f /tmp/backup.sql
docker cp owamons-db:/tmp/backup.sql $name
```

Tu obtiens un `.sql` (format COPY), **sans corruption**. Pour réimporter plus tard :

```powershell
docker cp backup_XXXXXXXX_XXXXXX.sql owamons-db:/tmp/restore.sql
docker exec owamons-db psql -U owamons -d owamons -f /tmp/restore.sql
```

## Option : format INSERT (fichier plus lourd, très portable)

Si tu veux des `INSERT` au lieu de `COPY` (utile si le fichier transite par des outils qui modifient les fins de ligne) :

```powershell
$name = "backup_inserts_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".sql"
docker exec owamons-db pg_dump -U owamons -d owamons --inserts -f /tmp/backup_inserts.sql
docker cp owamons-db:/tmp/backup_inserts.sql $name
```

## Option : format custom .dump (pour pg_restore)

Si tu préfères le format binaire pour `pg_restore` :

```powershell
$name = "backup_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".dump"
docker exec owamons-db pg_dump -U owamons -d owamons -F c -f /tmp/backup.dump
docker cp owamons-db:/tmp/backup.dump $name
```

---

## Importer le backup dans Supabase (PostgreSQL 17)

Supabase tourne sous **PostgreSQL 17**. Le conteneur Docker du projet est en **PostgreSQL 18**. Un dump PG 18 peut parfois poser problème à l’import sur PG 17 (catalogues, syntaxe), et le format **COPY** est très sensible aux fins de ligne / encodage dès qu’on passe par l’éditeur SQL ou un outil web.

**Recommandation : utiliser le format INSERT** (pas de blocs COPY, que des `INSERT INTO ... VALUES (...)`). Ça évite à la fois les soucis de version et les erreurs du type *syntax error at or near "14"*.

### 1. Créer un dump en INSERT (pour Supabase)

Depuis la racine du projet, avec le conteneur **owamons-db** (PG 18) :

```powershell
$name = "backup_supabase_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".sql"
docker exec owamons-db pg_dump -U owamons -d owamons --inserts -f /tmp/backup_inserts.sql
docker cp owamons-db:/tmp/backup_inserts.sql $name
```

Fichier plus lourd, mais importable dans Supabase (SQL Editor ou `psql` vers Supabase) sans erreur de COPY.

### 2. (Optionnel) Même version que Supabase : dump avec Postgres 17

Pour aligner la version du dump sur Supabase (17), lancer un conteneur Postgres 17 qui se connecte à ta BDD et écrit le fichier dans le dossier courant (pas de redirection, pas de corruption) :

**PowerShell (à lancer depuis la racine du projet) :**
```powershell
$name = "backup_supabase_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".sql"
docker run --rm --network owamons_default -v "${PWD}:/out" -e PGPASSWORD=owamons postgres:17-alpine pg_dump -h postgres -U owamons -d owamons --inserts -f /out/$name
```

Le réseau Docker est en général `owamons_default` (nom du dossier du projet + `_default`). Si besoin, vérifier avec `docker network ls`.

En pratique, **`--inserts`** suffit souvent à régler les erreurs à l’import sur Supabase, même avec un dump pris depuis PG 18.
