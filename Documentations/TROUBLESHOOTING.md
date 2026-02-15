# 🔧 Guide de Dépannage

## Problème : Erreur d'authentification PostgreSQL

### Symptôme
```
password authentication failed for user "postgres"
```

### Causes Possibles

1. **Mot de passe incorrect dans DATABASE_URL**
   - Vérifiez votre fichier `.env`
   - Le format doit être : `postgresql://username:password@host:port/database`
   - Si votre mot de passe contient des caractères spéciaux, ils doivent être encodés en URL

2. **Caractères spéciaux dans le mot de passe**
   - Si votre mot de passe contient `@`, `:`, `/`, `#`, etc., encodez-les :
   - `@` → `%40`
   - `:` → `%3A`
   - `/` → `%2F`
   - `#` → `%23`
   - Espace → `%20` ou `+`

   Exemple :
   ```
   Mot de passe : "mon@pass#123"
   Encodé : "mon%40pass%23123"
   DATABASE_URL=postgresql://postgres:mon%40pass%23123@localhost:5432/pokemon_twitch
   ```

3. **Utilisateur n'existe pas**
   - Vérifiez que l'utilisateur existe dans PostgreSQL
   - Créez-le si nécessaire : `CREATE USER postgres WITH PASSWORD 'votre_mot_de_passe';`

4. **Permissions insuffisantes**
   - L'utilisateur doit avoir les droits sur la base de données
   - `GRANT ALL PRIVILEGES ON DATABASE pokemon_twitch TO postgres;`

### Solutions

#### Solution 1 : Vérifier le mot de passe

1. Testez la connexion directement avec psql :
   ```bash
   psql -U postgres -d pokemon_twitch
   ```
   Si ça fonctionne, le problème vient du format de DATABASE_URL.

2. Vérifiez votre `.env` :
   ```env
   DATABASE_URL=postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/pokemon_twitch
   ```

#### Solution 2 : Encoder les caractères spéciaux

Si votre mot de passe contient des caractères spéciaux, utilisez un encodeur URL :
- En ligne : https://www.urlencoder.org/
- En PowerShell :
  ```powershell
  [System.Web.HttpUtility]::UrlEncode("votre mot de passe")
  ```

#### Solution 3 : Créer un nouvel utilisateur avec un mot de passe simple

```sql
-- Se connecter en tant que superutilisateur
psql -U postgres

-- Créer un nouvel utilisateur
CREATE USER pokemon_user WITH PASSWORD 'motdepasse123';

-- Donner les droits
GRANT ALL PRIVILEGES ON DATABASE pokemon_twitch TO pokemon_user;

-- Utiliser cet utilisateur dans DATABASE_URL
DATABASE_URL=postgresql://pokemon_user:motdepasse123@localhost:5432/pokemon_twitch
```

#### Solution 4 : Vérifier pg_hba.conf

Si vous avez toujours des problèmes, vérifiez le fichier de configuration PostgreSQL `pg_hba.conf` :

1. Trouvez le fichier (généralement dans le dossier de données PostgreSQL)
2. Vérifiez que la méthode d'authentification est `md5` ou `scram-sha-256` pour localhost
3. Redémarrez PostgreSQL après modification

### Test de Connexion

Pour tester votre DATABASE_URL, créez un fichier `test-connection.js` :

```javascript
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function test() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Connection successful!', result.rows[0]);
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
  }
}

test();
```

Exécutez : `node test-connection.js`

## Autres Problèmes Courants

### Le serveur démarre mais les routes retournent 503

Cela signifie que la base de données n'est pas encore initialisée. Attendez quelques secondes et réessayez.

### Les requêtes fonctionnent mais sont lentes

- Vérifiez que les index sont créés (ils le sont automatiquement dans le schéma)
- Vérifiez la charge de votre serveur PostgreSQL
- Augmentez `max` dans la configuration du pool si nécessaire

### Erreur "relation does not exist"

La base de données n'a pas été initialisée. Exécutez :
```bash
cd backend
node src/database/init.js
```


