# 🎮 Système de Commandes - Documentation Complète

## Vue d'ensemble

Le système fonctionne maintenant avec un **système de vote** : les commandes ne font que voter, et à la fin du timer, le vote gagnant est exécuté avec un viewer tiré au sort.

## Commandes Disponibles

### !capture [ball_type]

**Fonction** : Vote pour capturer le pokémon sauvage

**Paramètres** :
- `ball_type` (optionnel) : Type de ball à utiliser
  - `pokéball` (par défaut si non spécifié et que le viewer en possède)
  - `superball`
  - `hyperball`
  - `masterball`

**Comportement** :
1. Enregistre un vote pour "capture"
2. Stocke le type de ball choisi (ou pokéball par défaut)
3. À la fin du timer, si "capture" gagne :
   - Un viewer est tiré au sort parmi les votants
   - Le viewer tente la capture avec la ball spécifiée
   - L'overlay affiche le viewer, la ball utilisée, et le résultat

**Exemples** :
- `!capture` → Vote avec pokéball (si disponible)
- `!capture superball` → Vote avec superball
- `!capture masterball` → Vote avec masterball

### !combat

**Fonction** : Vote pour combattre le pokémon sauvage

**Comportement** :
1. Enregistre un vote pour "battle"
2. À la fin du timer, si "battle" gagne :
   - Un viewer est tiré au sort parmi les votants
   - Le viewer doit choisir un pokémon parmi les siens (non-KO)
   - Le viewer envoie `!1`, `!2`, etc. pour choisir
   - Un combat en 3 rounds est simulé
   - Si victoire : +100 Pokédollars
   - Si défaite : Le pokémon est mis KO (ne peut plus combattre jusqu'à soin)

**Exemples** :
- `!combat` → Vote pour combattre

### !fuite

**Fonction** : Vote pour faire fuir le pokémon sauvage

**Comportement** :
1. Enregistre un vote pour "flee"
2. À la fin du timer, si "flee" gagne :
   - Le pokémon disparaît immédiatement
   - Un nouveau pokémon peut spawner

**Exemples** :
- `!fuite` → Vote pour fuir

### !soin

**Fonction** : Soigne tous les pokémon KO du viewer

**Comportement** :
1. Soigne immédiatement tous les pokémon KO du viewer qui lance la commande
2. Restaure leurs HP à leur maximum
3. Les pokémon peuvent à nouveau combattre

**Exemples** :
- `!soin` → Soigne tous les pokémon KO

### !spawn

**Fonction** : Spawne un nouveau pokémon (streamer seulement)

**Comportement** :
1. Vérifie que c'est le streamer (pas les mods)
2. Spawne un nouveau pokémon immédiatement
3. Si un pokémon est déjà actif, la commande échoue

**Exemples** :
- `!spawn` → Spawne un pokémon (streamer seulement)

### !1, !2, !3, etc.

**Fonction** : Sélectionne un pokémon par son index

**Comportement** :
- Utilisé pour choisir un pokémon lors d'un combat ou d'un remplacement
- `!1` = premier pokémon de la liste
- `!2` = deuxième pokémon, etc.

**Exemples** :
- `!1` → Sélectionne le premier pokémon de la liste

## Système de Vote

### Déroulement

1. **Phase de vote** (30 secondes, 45 pour légendaires) :
   - Les viewers votent avec `!capture`, `!combat`, ou `!fuite`
   - Les votes sont comptabilisés en temps réel
   - L'overlay affiche les statistiques de vote

2. **Fin du timer** :
   - Le vote gagnant est déterminé (celui avec le plus de votes)
   - En cas d'égalité, aucun vote ne gagne (le pokémon disparaît)
   - Un viewer est tiré au sort parmi les votants du vote gagnant

3. **Exécution de l'action** :
   - **Capture** : Le viewer tente la capture avec sa ball
   - **Combat** : Le viewer choisit un pokémon, puis combat
   - **Fuite** : Le pokémon disparaît

## Gestion des Pokédollars

- **Capture réussie** : +100 Pokédollars
- **Victoire au combat** : +100 Pokédollars
- **Participation (vote)** : +2 Pokédollars (optionnel)

## Gestion des Pokémons

### Équipe

- **Taille maximale** : 6 pokémon
- Si équipe pleine lors d'une capture :
  - Le viewer doit choisir quel pokémon remplacer (`!1`, `!2`, etc.)
  - Le pokémon remplacé est perdu (supprimé)

### État KO

- Un pokémon KO ne peut plus combattre
- Utilisez `!soin` pour soigner tous vos pokémon KO
- Les pokémon KO sont restaurés avec leurs HP maximum

## Types de Balls

| Ball | Prix | Bonus Capture | Description |
|------|------|---------------|-------------|
| Pokéball | 5 | +5% | Ball de base |
| Superball | 15 | +10% | Ball améliorée |
| Hyperball | 40 | +20% | Ball très efficace |
| Masterball | 100 | +100% | Capture garantie |

## Overlay

L'overlay affiche maintenant :
- **Tentative de capture** : Viewer + type de ball + pokémon cible
- **Résultat de capture** : Succès/échec avec le nom du viewer
- **Sélection de combat** : Viewer + liste des pokémon disponibles
- **Résultat de combat** : Victoire/défaite avec le pokémon utilisé
- **Remplacement** : Liste des pokémon à remplacer

## Migration de la Base de Données

Pour appliquer les changements de schéma, exécutez :

```bash
cd backend
node src/database/migrate.js
```

Ou manuellement via PostgreSQL :

```sql
-- Ajouter sprite_url aux shop_items
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS sprite_url TEXT;

-- Ajouter is_ko aux user_pokemons
ALTER TABLE user_pokemons ADD COLUMN IF NOT EXISTS is_ko BOOLEAN DEFAULT FALSE;

-- Ajouter ball_type aux event_votes
ALTER TABLE event_votes ADD COLUMN IF NOT EXISTS ball_type VARCHAR(50);

-- Ajouter winning_vote et selected_user_id aux active_events
ALTER TABLE active_events ADD COLUMN IF NOT EXISTS winning_vote VARCHAR(20);
ALTER TABLE active_events ADD COLUMN IF NOT EXISTS selected_user_id INTEGER REFERENCES users(id);
ALTER TABLE active_events ADD COLUMN IF NOT EXISTS processing_state VARCHAR(50) DEFAULT 'voting';
```

## Notes Importantes

1. **!spawn** : Seulement le streamer peut l'utiliser (pas les mods)
2. **Équipe pleine** : Le viewer doit répondre rapidement avec `!1`, `!2`, etc.
3. **Pokémon KO** : Utilisez `!soin` pour les soigner avant de pouvoir les utiliser en combat
4. **Vote unique** : Chaque viewer ne peut voter qu'une fois par événement
5. **Cooldown** : 5 secondes entre chaque commande pour éviter le spam


