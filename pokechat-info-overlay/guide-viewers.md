# Guide Pokéchat – Widget et commandes

Ce texte peut être intégré tel quel à une page de ton site (section « Comment jouer », « Commandes », FAQ, etc.). Tu peux le copier-coller dans ton CMS ou le convertir en HTML selon ton thème.

---

## Le widget d’informations (overlay)

Le **widget Pokéchat** est un encart affiché en overlay sur le stream (souvent en bas à gauche). Il rappelle aux viewers les étapes pour commencer et les commandes principales.

**Fonctionnement :**
- Plusieurs **messages défilent** automatiquement (par exemple : choisir un starter, acheter des Pokéballs, participer aux votes, où trouver l’aide).
- Le **logo Pokéchat** reste visible à gauche ; à droite, le texte change toutes les quelques secondes.
- Aucune action n’est requise : c’est un rappel visuel pour les nouveaux viewers.

Tu peux l’ajouter comme **source Navigateur** dans OBS en pointant vers le fichier `index.html` du dossier du widget, avec fond transparent si besoin.

---

## Commandes en chat – Résumé

Toutes les commandes s’utilisent dans le **chat Twitch** du stream. Un délai (cooldown) peut s’appliquer entre deux utilisations de la même commande.

---

### Démarrer

| Commande | Utilité |
|----------|--------|
| **!start** | Choisir ton premier Pokémon (starter). Le bot te propose 3 choix ; réponds avec **!1**, **!2** ou **!3** pour sélectionner. |
| **!1**, **!2**, **!3** | Après **!start**, permet de choisir le starter correspondant (1, 2 ou 3). |

---

### Votes lors des événements (spawn / arène)

Quand un Pokémon sauvage apparaît à l’écran (ou un champion d’arène), tu peux voter pour décider de la suite :

| Commande | Utilité |
|----------|--------|
| **!capture** ou **!capture [type de ball]** | Voter pour tenter de capturer le Pokémon. Sans précision, une Pokéball est utilisée si tu en as une. Tu peux préciser : **pokéball**, **superball**, **hyperball**, **masterball**. |
| **!combat** ou **!battle** | Voter pour affronter le Pokémon (ou le champion d’arène). Un de tes Pokémon sera utilisé pour le combat. |
| **!fuite** ou **!flee** | Voter pour ne pas capturer ni combattre (fuir l’événement). |

Lors d’une **capture**, si tu as plusieurs balls dans ton inventaire, le bot peut te demander laquelle utiliser ; dans ce cas, réponds avec **!1**, **!2**, etc. selon la liste affichée.

---

### Économie et boutique

| Commande | Utilité |
|----------|--------|
| **!shop list** | Afficher la liste des objets en vente et leurs prix (en Pokédollars). |
| **!shop [nombre] [nom de l’objet]** | Acheter un objet. Exemple : **!shop 5 pokéball** pour acheter 5 Pokéballs. |
| **!pokedollars** ou **!coins** | Voir ton solde de Pokédollars. |
| **!inventaire** ou **!inventory** | Voir le contenu de ton inventaire (balls, objets, etc.). |

---

### Équipe et Pokémon

| Commande | Utilité |
|----------|--------|
| **!team** | Afficher les Pokémon de ton équipe. |
| **!soin** ou **!heal** | Soigner tous les Pokémon de ton équipe (remettre les PV au maximum). |
| **!evolution** ou **!evolve** | Voir la liste de tes Pokémon prêts à évoluer. Ensuite, choisis lequel faire évoluer avec **!1**, **!2**, etc. |

Les commandes **!1**, **!2**, **!3**, etc. servent aussi à :
- Choisir un starter après **!start** ;
- Choisir une ball lors d’une capture ;
- Choisir un Pokémon à faire évoluer après **!evolution** ;
- Choisir un Pokémon pour le combat ou le remplacement quand le bot te le demande.

---

### Badges et classement

| Commande | Utilité |
|----------|--------|
| **!badge** ou **!badges** | Afficher les badges que tu as débloqués (arènes, défis, etc.). |

En participant aux **!capture** et **!combat** (et en gagnant des combats), tu peux progresser et apparaître dans le **classement** affiché par le stream.

---

### Aide et informations

| Commande | Utilité |
|----------|--------|
| **!pokéchat** | Message d’accueil et explication rapide du système (votes, arènes, etc.). |
| **!pokéchat list** | Afficher la liste de toutes les commandes disponibles dans le chat. |

---

## En résumé pour les nouveaux viewers

1. **Choisir un starter** : écris **!start** dans le chat, puis **!1**, **!2** ou **!3** pour choisir ton premier Pokémon.
2. **Acheter des Pokéballs** : **!shop list** pour voir la boutique, puis **!shop 1 pokéball** (ou un autre nombre / objet) pour acheter.
3. **Participer** : quand un Pokémon apparaît à l’écran, utilise **!capture**, **!combat** ou **!fuite** pour voter. Lors des arènes, **!combat** ou **!fuite** pour affronter ou fuir le champion.
4. **Plus d’infos** : **!pokéchat** pour un rappel, **!pokéchat list** pour toutes les commandes.

Le **widget overlay** reprend ces étapes sous forme de slides pour que tout le monde puisse suivre même sans avoir lu ce guide.
