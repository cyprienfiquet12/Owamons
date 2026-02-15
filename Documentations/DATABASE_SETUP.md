# Configuration de la Base de Données PostgreSQL

## Format de DATABASE_URL

Le format de `DATABASE_URL` pour PostgreSQL est :
```
postgresql://username:password@host:port/database_name
```

## Exemples

### PostgreSQL Local (Installation Standard)
```env
DATABASE_URL=postgresql://postgres:VotreMotDePasse@localhost:5432/pokemon_twitch
```

### PostgreSQL avec Utilisateur Personnalisé
```env
DATABASE_URL=postgresql://monuser:monpassword@localhost:5432/pokemon_twitch
```

### PostgreSQL sur un Autre Port
```env
DATABASE_URL=postgresql://postgres:password@localhost:5433/pokemon_twitch
```

### PostgreSQL Distant
```env
DATABASE_URL=postgresql://user:password@192.168.1.100:5432/pokemon_twitch
```

### Services Cloud (Heroku, Railway, etc.)
```env
DATABASE_URL=postgresql://user:pass@host.railway.app:5432/railway
DATABASE_SSL=true
```

## Étapes pour Configurer

### 1. Créer la Base de Données

Connectez-vous à PostgreSQL et créez la base de données :

```sql
-- Via psql
psql -U postgres

-- Créer la base de données
CREATE DATABASE pokemon_twitch;

-- Créer un utilisateur (optionnel)
CREATE USER pokemon_user WITH PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE pokemon_twitch TO pokemon_user;

-- Quitter
\q
```

### 2. Configurer le fichier .env

Éditez le fichier `.env` à la racine du projet :

```env
DATABASE_URL=postgresql://postgres:votre_mot_de_passe@localhost:5432/pokemon_twitch
```

**Remplacez :**
- `postgres` par votre nom d'utilisateur PostgreSQL
- `votre_mot_de_passe` par votre mot de passe PostgreSQL
- `5432` par le port PostgreSQL (généralement 5432)
- `pokemon_twitch` par le nom de votre base de données

### 3. Tester la Connexion

```bash
cd backend
node src/database/init.js
```

Si tout fonctionne, vous devriez voir :
```
📦 Connected to PostgreSQL database
📋 Initializing database schema...
✅ Database schema initialized
✅ Seeded X Pokémon
✅ Seeded X shop items
✅ Seeded X badges
✅ Database initialization completed!
```

## Dépannage

### Erreur : "password authentication failed"
- Vérifiez votre mot de passe dans `DATABASE_URL`
- Vérifiez que l'utilisateur existe dans PostgreSQL

### Erreur : "database does not exist"
- Créez la base de données : `CREATE DATABASE pokemon_twitch;`

### Erreur : "connection refused"
- Vérifiez que PostgreSQL est démarré
- Vérifiez le port (généralement 5432)
- Vérifiez l'adresse (localhost ou IP)

### Erreur : "role does not exist"
- Créez l'utilisateur ou utilisez un utilisateur existant
- Vérifiez le nom d'utilisateur dans `DATABASE_URL`

## Vérification Rapide

Pour tester votre connexion PostgreSQL directement :

```bash
# Windows (si psql est dans le PATH)
psql -U postgres -d pokemon_twitch

# Ou via pgAdmin
# Connectez-vous et vérifiez que la base pokemon_twitch existe
```


