# 🎲 Configuration du Spawn Automatique

## Problème Actuel

Par défaut, aucun événement n'est déclenché automatiquement. Vous devez soit :
- Utiliser `!spawn` dans le chat (modérateurs seulement)
- Utiliser `POST /api/spawn` via l'API

## Solution : Spawn Automatique

Le système peut maintenant spawner des Pokémon automatiquement à intervalles réguliers !

## Configuration

### 1. Activer le Spawn Automatique

Ouvrez votre fichier `.env` et ajoutez :

```env
AUTO_SPAWN_ENABLED=true
AUTO_SPAWN_MIN_MINUTES=5
AUTO_SPAWN_MAX_MINUTES=15
```

**Explication** :
- `AUTO_SPAWN_ENABLED=true` : Active le spawn automatique (défaut: true)
- `AUTO_SPAWN_MIN_MINUTES=5` : Délai minimum entre les spawns (5 minutes)
- `AUTO_SPAWN_MAX_MINUTES=15` : Délai maximum entre les spawns (15 minutes)
- **Le délai est aléatoire** entre ces deux valeurs à chaque spawn

### 2. Redémarrer le Serveur

```bash
# Arrêtez le serveur (Ctrl+C)
npm run dev
```

Vous devriez voir dans les logs :
```
🎲 Auto-spawn enabled (random interval: 5-15 minutes)
🔄 Starting auto-spawn system (random interval: 5-15 minutes)
🎲 Auto-spawning a Pokémon...
✅ Auto-spawned: Pikachu (COMMON)
⏰ Next spawn scheduled in 8 minutes (480 seconds)
```

### 3. Vérifier le Fonctionnement

- Un Pokémon devrait spawner immédiatement au démarrage
- Puis un nouveau Pokémon après un délai **aléatoire** entre 5 et 15 minutes
- L'overlay devrait s'afficher automatiquement à chaque spawn
- Chaque délai est différent (aléatoire dans la plage configurée)

## Configuration Avancée

### Intervalles Recommandés

| Type de Stream | Plage Min-Max | Description |
|----------------|---------------|-------------|
| Rapide/Actif | 2-5 minutes | Beaucoup d'action |
| Normal | 5-15 minutes | Équilibre (recommandé) |
| Lent/Relax | 10-20 minutes | Plus de temps pour chaque événement |

### Désactiver le Spawn Automatique

Si vous voulez contrôler manuellement les spawns :

```env
AUTO_SPAWN_ENABLED=false
```

Puis utilisez `!spawn` dans le chat ou `POST /api/spawn` via l'API.

## API Endpoints pour Contrôler le Spawn

### Vérifier le Statut

```bash
GET http://localhost:3000/api/auto-spawn/status
```

Réponse :
```json
{
  "enabled": true,
  "minMinutes": 5,
  "maxMinutes": 15,
  "interval": "5-15 minutes (random)"
}
```

### Démarrer le Spawn Automatique

```bash
POST http://localhost:3000/api/auto-spawn/start
Content-Type: application/json

{
  "minMinutes": 5,
  "maxMinutes": 15
}
```

### Arrêter le Spawn Automatique

```bash
POST http://localhost:3000/api/auto-spawn/stop
```

## Comportement

### Logique du Spawn Automatique

1. **Au démarrage** : Un Pokémon spawn immédiatement
2. **Puis** : Un nouveau Pokémon après un délai **aléatoire** entre `AUTO_SPAWN_MIN_MINUTES` et `AUTO_SPAWN_MAX_MINUTES`
3. **Délai aléatoire** : Chaque spawn utilise un délai différent, choisi aléatoirement dans la plage
4. **Si un événement est actif** : Le spawn attend 30 secondes puis réessaie
5. **Respect des cooldowns** : Les légendaires respectent leur cooldown (1 heure)

### Exemple de Timeline (avec délai aléatoire 5-15 min)

```
00:00 - Serveur démarre → Pikachu spawn
08:23 - Charmander spawn (délai aléatoire: 8 min 23 sec)
19:45 - Squirtle spawn (délai aléatoire: 11 min 22 sec)
32:10 - Bulbasaur spawn (délai aléatoire: 12 min 25 sec)
...
```

**Note** : Les délais sont aléatoires, donc les timings exacts varient à chaque fois. Si un événement est actif quand un spawn est prévu, le système attend 30 secondes puis réessaie.

## Dépannage

### Le spawn automatique ne démarre pas

1. Vérifiez que `AUTO_SPAWN_ENABLED=true` dans `.env`
2. Vérifiez les logs du serveur au démarrage
3. Vérifiez que la base de données contient des Pokémon : `GET /api/pokemon`

### Les spawns sont trop fréquents/rares

Ajustez `AUTO_SPAWN_MIN_MINUTES` et `AUTO_SPAWN_MAX_MINUTES` dans `.env` :
- Réduire les valeurs = plus fréquent (min: 1 minute)
- Augmenter les valeurs = moins fréquent (max: 60 minutes)
- Exemple pour plus d'action : `AUTO_SPAWN_MIN_MINUTES=3` et `AUTO_SPAWN_MAX_MINUTES=8`

### Le spawn automatique s'arrête

- Vérifiez les logs pour les erreurs
- Vérifiez que la base de données est accessible
- Redémarrez le serveur si nécessaire

## Prochaines Étapes

Une fois le spawn automatique configuré :

1. ✅ Testez que les Pokémon spawnent automatiquement
2. ✅ Vérifiez que l'overlay s'affiche à chaque spawn
3. ✅ Ajustez l'intervalle selon vos préférences
4. ✅ Prêt pour un stream en direct ! 🎉

