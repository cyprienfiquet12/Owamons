# Import des Données Pokémon

Ce guide explique comment importer les données complètes des Pokémon depuis le fichier `Pokemondata.json`.

## Structure des Données

Le fichier `Pokemondata.json` contient pour chaque Pokémon :
- **Informations de base** : `id`, `pokedexId`, `name`, `slug`
- **Images** : `image` (artwork officiel), `sprite` (sprite de combat)
- **Stats complètes** : `HP`, `attack`, `defense`, `special_attack`, `special_defense`, `speed`
- **Types** : `apiTypes` (array avec `name` et `image`)
- **Génération** : `apiGeneration`
- **Résistances/Faiblesses** : `apiResistances` (array avec `name`, `damage_multiplier`, `damage_relation`)
- **Évolutions** : `apiEvolutions` (array avec `name` et `pokedexId`)
- **Pré-évolution** : `apiPreEvolution` (objet avec `name` et `pokedexId`)

## Modifications de la Base de Données

### Table `pokemons` (mise à jour)

Nouvelles colonnes ajoutées :
- `base_defense` : Défense de base
- `base_special_attack` : Attaque spéciale de base
- `base_special_defense` : Défense spéciale de base
- `base_speed` : Vitesse de base
- `generation` : Numéro de génération (1-8+)
- `image_url` : URL de l'artwork officiel
- `slug` : Identifiant textuel unique
- `pre_evolution_pokedex_id` : Pokedex ID de la pré-évolution

### Nouvelle Table `pokemon_resistances`

Stocke les résistances et faiblesses de chaque Pokémon :
- `pokemon_id` : Référence vers `pokemons(id)`
- `type_name` : Nom du type (Normal, Feu, Eau, etc.)
- `damage_multiplier` : Multiplicateur de dégâts (0.25, 0.5, 1, 2, etc.)
- `damage_relation` : Relation (`neutral`, `resistant`, `twice_resistant`, `vulnerable`, `twice_vulnerable`, `immune`)

### Nouvelle Table `pokemon_evolutions`

Stocke les évolutions de chaque Pokémon :
- `pokemon_id` : Référence vers `pokemons(id)` (le Pokémon de base)
- `evolution_pokedex_id` : Pokedex ID de l'évolution
- `evolution_name` : Nom de l'évolution

## Étapes d'Import

### 1. Exécuter la Migration

La migration 004 ajoute les nouvelles colonnes et tables :

```bash
cd backend
npm run migrate
```

### 2. Importer les Données

Le script d'import lit le fichier `Pokemondata.json` et remplit la base de données :

```bash
cd backend
npm run import-pokemon
```

Le script va :
1. Lire le fichier `backend/Pokemondata.json`
2. Pour chaque Pokémon :
   - Insérer/mettre à jour dans `pokemons`
   - Insérer les résistances dans `pokemon_resistances`
   - Insérer les évolutions dans `pokemon_evolutions`
3. Afficher un résumé (imported, updated, errors)

## Fonctionnalités du Script d'Import

### Normalisation des Types

Le script normalise les noms de types français vers anglais :
- `Plante` → `Grass`
- `Électrik` → `Electric`
- `Ténèbres` → `Dark`
- etc.

### Calcul de la Rareté

La rareté est déterminée automatiquement :
- **LEGENDARY** : Pokémon légendaires (généralement dans les dernières positions de chaque génération)
- **EPIC** : Starters et certains Pokémon spéciaux
- **RARE** : Certains Pokémon avec des IDs spéciaux
- **COMMON** : Tous les autres

### Calcul du Taux de Capture

Le taux de capture est calculé basé sur les stats totales du Pokémon :
- Plus les stats sont élevées, plus c'est difficile à capturer
- Normalisé entre 0.1 et 0.9

## Utilisation dans le Code

### Récupérer les Résistances d'un Pokémon

```javascript
const resistances = await query(`
  SELECT type_name, damage_multiplier, damage_relation
  FROM pokemon_resistances
  WHERE pokemon_id = $1
`, [pokemonId]);
```

### Récupérer les Évolutions d'un Pokémon

```javascript
const evolutions = await query(`
  SELECT evolution_pokedex_id, evolution_name
  FROM pokemon_evolutions
  WHERE pokemon_id = $1
`, [pokemonId]);
```

### Récupérer un Pokémon avec Toutes ses Stats

```javascript
const pokemon = await queryOne(`
  SELECT 
    p.*,
    json_agg(
      json_build_object(
        'type_name', pr.type_name,
        'damage_multiplier', pr.damage_multiplier,
        'damage_relation', pr.damage_relation
      )
    ) FILTER (WHERE pr.id IS NOT NULL) as resistances
  FROM pokemons p
  LEFT JOIN pokemon_resistances pr ON p.id = pr.pokemon_id
  WHERE p.pokedex_id = $1
  GROUP BY p.id
`, [pokedexId]);
```

## Notes

- Le script utilise `ON CONFLICT DO UPDATE` pour mettre à jour les Pokémon existants
- Les résistances et évolutions sont également mises à jour si elles existent déjà
- Le script affiche la progression tous les 50 Pokémon
- Les erreurs sont loggées mais n'arrêtent pas l'import


