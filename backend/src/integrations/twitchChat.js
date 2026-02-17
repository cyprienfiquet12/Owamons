import tmi from 'tmi.js';
import dotenv from 'dotenv';
import { query, queryOne, queryResult } from '../database/connection.js';
import { spawnPokemon, getActiveEvent } from '../services/spawnService.js';
import { registerVote, getVoteStats } from '../services/captureService.js';
import { deductCoins, getCoins } from '../services/economyService.js';
import { broadcastSpawn, broadcastVoteUpdate, broadcastCaptureResult } from '../websocket/handlers.js';
import { io } from '../server.js';

dotenv.config();

let client = null;
let isConnected = false;

// Cooldown pour les commandes (en millisecondes)
const COMMAND_COOLDOWN = 5000; // 5 secondes
const userCooldowns = new Map();

// En attente de sélection d'évolution (!evolution puis !1, !2...). userId -> { list, expiresAt }
const EVOLUTION_SELECTION_TTL_MS = 60000; // 60 secondes
const evolutionSelectionPending = new Map();

/**
 * Vérifie et applique le cooldown pour un utilisateur
 * @param {string} userId 
 * @param {string} command 
 * @returns {boolean} True si la commande peut être exécutée
 */
function checkCooldown(userId, command) {
  const key = `${userId}_${command}`;
  const lastUsed = userCooldowns.get(key);

  if (lastUsed && Date.now() - lastUsed < COMMAND_COOLDOWN) {
    return false;
  }

  userCooldowns.set(key, Date.now());
  return true;
}

/**
 * Obtient ou crée un utilisateur
 * @param {string} twitchId 
 * @param {string} username 
 * @returns {Promise<Object>} Utilisateur
 */
async function getOrCreateUser(twitchId, username) {
  let user = await queryOne('SELECT * FROM users WHERE twitch_id = ?', [twitchId || username]);

  if (!user) {
    const result = await queryResult(
      'INSERT INTO users (twitch_id, username, xp, level, poke_coins) VALUES (?, ?, 0, 1, 0) RETURNING id',
      [twitchId || username, username]
    );
    user = await queryOne('SELECT * FROM users WHERE id = ?', [result.rows[0].id]);
  }

  return user;
}

/**
 * Parse une commande depuis le message
 * @param {string} message 
 * @param {number} userId 
 * @returns {Object|null} Commande parsée
 */
function parseCommand(message, userId) {
  const trimmed = message.trim().toLowerCase();
  const parts = trimmed.split(/\s+/);
  
  // !capture [ball_type] ou !vote capture [ball_type] — alias: !cap, !catch
  if (trimmed.startsWith('!capture') || trimmed.startsWith('!vote capture') || trimmed.startsWith('!cap') || trimmed.startsWith('!catch')) {
    const first = parts[0];
    const isCapture = first === '!capture' || first === '!cap' || first === '!catch';
    const ballType = parts.length >= 2 && isCapture ? parts[1] :
                     parts.length >= 3 && first === '!vote' ? parts[2] : null;
    return { type: 'capture', userId, ballType };
  }
  
  // !combat ou !battle — alias: !fight, !bat
  if (trimmed.startsWith('!combat') || trimmed.startsWith('!battle') || trimmed.startsWith('!fight') || trimmed.startsWith('!bat')) {
    return { type: 'battle', userId };
  }
  
  // !fuite ou !flee — alias: !run
  if (trimmed.startsWith('!fuite') || trimmed.startsWith('!flee') || trimmed.startsWith('!run')) {
    return { type: 'flee', userId };
  }
  
  // !soin ou !heal
  if (trimmed.startsWith('!soin') || trimmed.startsWith('!heal')) {
    return { type: 'heal', userId };
  }

  // !evolution / !evolve — alias: !evo
  if (trimmed.startsWith('!evolution') || trimmed.startsWith('!evolve') || trimmed.startsWith('!evo')) {
    return { type: 'evolution', userId };
  }
  
  // !shop list ou !shop <quantity> <item_name> — alias: !buy pour acheter, !boutique
  if (trimmed.startsWith('!shop') || trimmed.startsWith('!buy') || trimmed.startsWith('!boutique')) {
    if (parts.length >= 2) {
      if (parts[1] === 'list') {
        return { type: 'shop', userId, action: 'list' };
      }
      const quantity = parseInt(parts[1]);
      if (!isNaN(quantity) && parts.length >= 3) {
        const itemName = parts.slice(2).join(' ');
        return { type: 'shop', userId, action: 'buy', itemName, quantity };
      }
    }
    if (trimmed.startsWith('!shop') || trimmed.startsWith('!boutique')) {
      return { type: 'shop', userId, action: 'list' };
    }
  }
  
  // !pokedollars / !pokedolars / !coins — alias: !money, !pd, !$
  if (trimmed.startsWith('!pokedollars') || trimmed.startsWith('!pokedolars') || trimmed.startsWith('!coins') || trimmed.startsWith('!money') || trimmed.startsWith('!pd') || trimmed.startsWith('!$')) {
    return { type: 'pokedollars', userId };
  }
  
  // !inventaire / !inventory — alias: !inv, !i
  if (trimmed.startsWith('!inventaire') || trimmed.startsWith('!inventory') || trimmed.startsWith('!inv') || trimmed === '!i' || trimmed.startsWith('!i ')) {
    return { type: 'inventaire', userId };
  }
  
  // !team — alias: !equipe, !eq, !t
  if (trimmed.startsWith('!team') || trimmed.startsWith('!equipe') || trimmed === '!eq' || trimmed.startsWith('!eq ') || trimmed === '!t' || trimmed.startsWith('!t ')) {
    return { type: 'team', userId };
  }
  
  // !badge / !badges — alias: !b (après !buy pour éviter conflit)
  if (trimmed.startsWith('!badge') || trimmed.startsWith('!badges') || trimmed === '!b' || trimmed.startsWith('!b ')) {
    return { type: 'badge', userId };
  }
  
  // !pokéchat [list] — alias: !pokechat, !help, !aide, !pc
  if (trimmed.startsWith('!pokéchat') || trimmed.startsWith('!pokechat') || trimmed.startsWith('!help') || trimmed.startsWith('!aide') || trimmed.startsWith('!pc')) {
    if (parts.length >= 2 && parts[1] === 'list') {
      return { type: 'pokéchat', userId, action: 'list' };
    }
    return { type: 'pokéchat', userId, action: 'info' };
  }
  
  // !system [start|stop] — alias: !sys
  if (trimmed.startsWith('!system') || trimmed.startsWith('!sys')) {
    if (parts.length >= 2) {
      const action = parts[1].toLowerCase();
      if (action === 'start' || action === 'stop') {
        return { type: 'system', userId, action };
      }
    }
    return { type: 'system', userId, action: 'status' };
  }
  
  // !spawn [arena] — alias: !sp (streamer seulement)
  if (trimmed.startsWith('!spawn') || trimmed === '!sp' || trimmed.startsWith('!sp ')) {
    if (parts.length >= 2 && parts[1] === 'arena') {
      return { type: 'spawn_arena', userId };
    }
    return { type: 'spawn', userId };
  }
  
  // !start — alias: !starter, !st
  if (trimmed.startsWith('!start') || trimmed.startsWith('!starter') || trimmed === '!st' || trimmed.startsWith('!st ')) {
    return { type: 'start', userId };
  }
  
  // !1, !2, !3, etc. pour sélectionner un pokémon ou un starter
  if (/^![1-9]\d*$/.test(trimmed)) {
    const index = parseInt(trimmed.substring(1));
    return { type: 'select_pokemon', userId, index };
  }
  
  return null;
}

/**
 * Gère la commande !capture (vote seulement)
 */
async function handleCaptureCommand(userId, channel, username, ballType = null) {
  if (!checkCooldown(userId, 'capture')) {
    client.say(channel, `@${username}, commande en cooldown. Attendez 5 secondes.`);
    return;
  }

  const event = await getActiveEvent();

  if (!event) {
    // Vérifier s'il y a un événement expiré non nettoyé
    const anyEvent = await queryOne(`
      SELECT ae.*, p.name as pokemon_name
      FROM active_events ae
      LEFT JOIN pokemons p ON ae.pokemon_id = p.id
      WHERE ae.type = 'spawn'
      ORDER BY ae.started_at DESC
      LIMIT 1
    `);
    
    client.say(channel, `@${username}, aucun événement actif.`);
    return;
  }
  
  // Vérifier si c'est un événement d'arène (pas de capture possible)
  if (event.type === 'arena') {
    client.say(channel, `@${username}, vous ne pouvez pas capturer un champion d'arène. Utilisez !combat ou !fuite.`);
    return;
  }

  // Vérifier si l'utilisateur a déjà voté
  const hasVoted = await queryOne(
    'SELECT * FROM event_votes WHERE event_id = ? AND user_id = ?',
    [event.id, userId]
  );

  if (hasVoted) {
    client.say(channel, `@${username}, vous avez déjà voté.`);
    return;
  }

  // Déterminer le type de ball à utiliser
  let finalBallType = 'pokéball'; // Par défaut
  
  if (ballType) {
    // Normaliser le nom de la ball
    const normalizedBallType = ballType.toLowerCase();
    const validBalls = ['pokéball', 'superball', 'hyperball', 'masterball'];
    
    if (validBalls.includes(normalizedBallType)) {
      finalBallType = normalizedBallType;
    } else {
      client.say(channel, `@${username}, type de ball invalide. Utilisation d'une Pokéball.`);
    }
  } else {
    // Si aucune ball spécifiée, vérifier si le viewer a une pokéball
    const pokeball = await queryOne(`
      SELECT ui.* FROM user_inventory ui
      JOIN shop_items si ON ui.item_id = si.id
      WHERE ui.user_id = ? AND LOWER(si.name) = 'pokéball' AND ui.quantity > 0
    `, [userId]);
    
    if (!pokeball) {
      client.say(channel, `@${username}, vous n'avez pas de Pokéball dans votre inventaire.`);
      return;
    }
  }

  // Enregistrer le vote avec le type de ball
  await query(`
    INSERT INTO event_votes (event_id, user_id, vote_type, ball_type)
    VALUES (?, ?, 'capture', ?)
    ON CONFLICT (event_id, user_id) DO NOTHING
  `, [event.id, userId, finalBallType]);

  // Récompenser la participation
  try {
    const { rewardParticipation } = await import('../services/economyService.js');
    await rewardParticipation(userId);
  } catch (error) {
    console.error('Error rewarding participation:', error);
  }

  // Diffuser la mise à jour des votes
  const voteStats = await getVoteStats(event.id);
  if (io) {
    broadcastVoteUpdate(io, event.id);
  }

  client.say(channel, `✅ @${username}, vote enregistré: Capture (${finalBallType})`);
}

/**
 * Gère la commande !combat (vote seulement)
 */
async function handleBattleCommand(userId, channel, username) {
  if (!checkCooldown(userId, 'battle')) {
    client.say(channel, `@${username}, commande en cooldown.`);
    return;
  }

  // Vérifier d'abord les spawns normaux
  let event = await getActiveEvent();
  
  // Si pas de spawn, vérifier les arènes
  if (!event) {
    const { getActiveArenaEvent } = await import('../services/arenaService.js');
    event = await getActiveArenaEvent();
  }

  if (!event) {
    client.say(channel, `@${username}, aucun événement actif.`);
    return;
  }
  
  // Accepter les spawns et les arènes
  if (event.type !== 'spawn' && event.type !== 'arena') {
    client.say(channel, `@${username}, aucun événement actif.`);
    return;
  }

  // Vérifier si l'utilisateur a des Pokémon aptes au combat (non-KO)
  const availablePokemons = await query(`
    SELECT COUNT(*)::int as count
    FROM user_pokemons
    WHERE user_id = $1 AND is_ko = false
  `, [userId]);

  const pokemonCount = availablePokemons[0]?.count || 0;

  if (pokemonCount === 0) {
    client.say(channel, `@${username}, vous n'avez aucun Pokémon apte au combat. Utilisez !soin pour soigner vos Pokémon.`);
    return;
  }

  // Vérifier si c'est une arène et si l'utilisateur possède déjà le badge
  if (event.type === 'arena') {
    // Récupérer le badge_id de l'arène
    const arenaEvent = await queryOne(`
      SELECT a.badge_id
      FROM active_events ae
      JOIN arenas a ON ae.arena_id = a.id
      WHERE ae.id = $1
    `, [event.id]);
    
    if (arenaEvent?.badge_id) {
      const hasBadge = await queryOne(
        'SELECT * FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [userId, arenaEvent.badge_id]
      );
      
      if (hasBadge) {
        client.say(channel, `@${username}, vous possédez déjà le badge de cette arène. Vous ne pouvez pas participer.`);
        return;
      }
    }
  }

  const hasVoted = await queryOne(
    'SELECT * FROM event_votes WHERE event_id = $1 AND user_id = $2',
    [event.id, userId]
  );

  if (hasVoted) {
    client.say(channel, `@${username}, vous avez déjà voté.`);
    return;
  }

  const voteResult = await registerVote(event.id, userId, 'battle');
  
  if (!voteResult.success) {
    if (voteResult.reason === 'already_voted') {
      client.say(channel, `@${username}, vous avez déjà voté.`);
    } else if (voteResult.reason === 'already_has_badge') {
      client.say(channel, `@${username}, vous possédez déjà le badge de cette arène. Vous ne pouvez pas participer.`);
    } else {
      client.say(channel, `@${username}, erreur lors de l'enregistrement du vote.`);
    }
    return;
  }

  if (io) {
    broadcastVoteUpdate(io, event.id);
  }

  client.say(channel, `✅ @${username}, vote enregistré: Combat`);
}

/**
 * Gère la commande !flee
 */
async function handleFleeCommand(userId, channel, username) {
  if (!checkCooldown(userId, 'flee')) {
    client.say(channel, `@${username}, commande en cooldown.`);
    return;
  }

  // Vérifier d'abord les spawns normaux
  let event = await getActiveEvent();
  
  // Si pas de spawn, vérifier les arènes
  if (!event) {
    const { getActiveArenaEvent } = await import('../services/arenaService.js');
    event = await getActiveArenaEvent();
  }

  if (!event) {
    client.say(channel, `@${username}, aucun événement actif.`);
    return;
  }

  // Vérifier si c'est une arène et si l'utilisateur possède déjà le badge
  if (event.type === 'arena') {
    // Récupérer le badge_id de l'arène
    const arenaEvent = await queryOne(`
      SELECT a.badge_id
      FROM active_events ae
      JOIN arenas a ON ae.arena_id = a.id
      WHERE ae.id = ?
    `, [event.id]);
    
    if (arenaEvent?.badge_id) {
      const hasBadge = await queryOne(
        'SELECT * FROM user_badges WHERE user_id = ? AND badge_id = ?',
        [userId, arenaEvent.badge_id]
      );
      
      if (hasBadge) {
        client.say(channel, `@${username}, vous possédez déjà le badge de cette arène. Vous ne pouvez pas participer.`);
        return;
      }
    }
  }

  const hasVoted = await queryOne(
    'SELECT * FROM event_votes WHERE event_id = ? AND user_id = ?',
    [event.id, userId]
  );

  if (hasVoted) {
    client.say(channel, `@${username}, vous avez déjà voté.`);
    return;
  }

  const voteResult = await registerVote(event.id, userId, 'flee');
  
  if (!voteResult.success) {
    if (voteResult.reason === 'already_voted') {
      client.say(channel, `@${username}, vous avez déjà voté.`);
    } else if (voteResult.reason === 'already_has_badge') {
      client.say(channel, `@${username}, vous possédez déjà le badge de cette arène. Vous ne pouvez pas participer.`);
    } else {
      client.say(channel, `@${username}, erreur lors de l'enregistrement du vote.`);
    }
    return;
  }

  if (io) {
    broadcastVoteUpdate(io, event.id);
  }

  client.say(channel, `✅ @${username}, vote enregistré: Fuite`);
}

/**
 * Gère la commande !shop
 */
async function handleShopCommand(command, userId, channel, username) {
  if (!checkCooldown(userId, 'shop')) {
    client.say(channel, `@${username}, commande en cooldown.`);
    return;
  }

  // Gérer !shop list
  if (command.action === 'list') {
    const items = await query('SELECT name, price FROM shop_items ORDER BY price ASC');
    
    if (items.length === 0) {
      client.say(channel, `@${username}, aucun item disponible en boutique.`);
      return;
    }

    // Construire le message avec tous les items
    const itemsList = items.map(item => `${item.name} (${item.price} Pokédollars)`).join(' | ');
    client.say(channel, `🛒 @${username}, Boutique: ${itemsList}`);
    return;
  }

  // Gérer !shop <quantity> <item_name>
  if (command.action === 'buy') {
    const { itemName, quantity } = command;

    if (!itemName || !quantity || quantity <= 0) {
      client.say(channel, `@${username}, syntaxe incorrecte. Utilisez: !shop <quantity> <item_name> ou !shop list`);
      return;
    }

    // Rechercher l'item (insensible à la casse)
    const item = await queryOne('SELECT * FROM shop_items WHERE LOWER(name) = LOWER($1)', [itemName]);

    if (!item) {
      client.say(channel, `@${username}, item "${itemName}" introuvable. Utilisez !shop list pour voir les items disponibles.`);
      return;
    }

    // Calculer le prix total
    const totalPrice = item.price * quantity;

    // Vérifier le solde de l'utilisateur
    const userCoins = await getCoins(userId);

    if (userCoins < totalPrice) {
      client.say(channel, `@${username}, solde insuffisant. Requis: ${totalPrice} Pokédollars, Disponible: ${userCoins} Pokédollars.`);
      return;
    }

    // Débiter les Pokédollars
    await deductCoins(userId, totalPrice);

    // Ajouter ou mettre à jour l'item dans l'inventaire
    const existingItem = await queryOne(
      'SELECT * FROM user_inventory WHERE user_id = $1 AND item_id = $2',
      [userId, item.id]
    );

    if (existingItem) {
      // Mettre à jour la quantité existante
      await query(
        'UPDATE user_inventory SET quantity = quantity + $1 WHERE user_id = $2 AND item_id = $3',
        [quantity, userId, item.id]
      );
    } else {
      // Créer une nouvelle entrée dans l'inventaire
      await query(
        'INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1, $2, $3)',
        [userId, item.id, quantity]
      );
    }

    // Récupérer le nouveau solde
    const newBalance = await getCoins(userId);

    client.say(channel, `✅ @${username}, achat réussi: ${quantity}x ${item.name} pour ${totalPrice} Pokédollars. Solde restant: ${newBalance} Pokédollars.`);
  }
}

/**
 * Gère la commande !pokedollars - Consulter le solde
 */
async function handlePokedollarsCommand(userId, channel, username) {
  if (!checkCooldown(userId, 'pokedollars')) {
    client.say(channel, `@${username}, commande en cooldown.`);
    return;
  }

  const coins = await getCoins(userId);
  client.say(channel, `💰 @${username}, vous avez ${coins} Pokédollars.`);
}

/**
 * Gère la commande !inventaire - Consulter l'inventaire
 */
async function handleInventaireCommand(userId, channel, username) {
  if (!checkCooldown(userId, 'inventaire')) {
    client.say(channel, `@${username}, commande en cooldown.`);
    return;
  }

  // Récupérer l'inventaire avec les noms des items
  const inventory = await query(`
    SELECT ui.quantity, si.name
    FROM user_inventory ui
    JOIN shop_items si ON ui.item_id = si.id
    WHERE ui.user_id = $1
    ORDER BY si.name ASC
  `, [userId]);

  if (inventory.length === 0) {
    client.say(channel, `📦 @${username}, votre inventaire est vide. Utilisez !shop list pour voir les items disponibles.`);
    return;
  }

  // Construire le message avec tous les items
  const itemsList = inventory.map(item => `${item.name} x${item.quantity}`).join(' | ');
  client.say(channel, `📦 @${username}, Inventaire: ${itemsList}`);
}

/**
 * Gère la commande !team - Afficher l'équipe du viewer
 */
async function handleTeamCommand(userId, channel, username) {
  if (!checkCooldown(userId, 'team')) {
    client.say(channel, `@${username}, commande en cooldown.`);
    return;
  }

  // Récupérer les Pokémon du viewer avec leur niveau
  const team = await query(`
    SELECT up.level, p.name as pokemon_name, up.is_ko
    FROM user_pokemons up
    JOIN pokemons p ON up.pokemon_id = p.id
    WHERE up.user_id = $1
    ORDER BY up.level DESC, up.captured_at ASC
  `, [userId]);

  if (team.length === 0) {
    client.say(channel, `⚡ @${username}, vous n'avez aucun Pokémon dans votre équipe. Utilisez !start pour choisir un starter.`);
    return;
  }

  // Construire le message avec tous les Pokémon et leur niveau
  const teamList = team.map(pokemon => {
    const status = pokemon.is_ko ? ' (KO)' : '';
    return `${pokemon.pokemon_name} Nv.${pokemon.level}${status}`;
  }).join(' | ');
  
  client.say(channel, `⚡ @${username}, Équipe (${team.length}/6): ${teamList}`);
}

/**
 * Gère la commande !badge - Afficher les badges du viewer
 */
async function handleBadgeCommand(userId, channel, username) {
  if (!checkCooldown(userId, 'badge')) {
    client.say(channel, `@${username}, commande en cooldown.`);
    return;
  }

  // Récupérer les badges du viewer
  const badges = await query(`
    SELECT b.name, b.sprite_url
    FROM user_badges ub
    JOIN badges b ON ub.badge_id = b.id
    WHERE ub.user_id = $1
    ORDER BY ub.earned_at ASC
  `, [userId]);

  if (badges.length === 0) {
    client.say(channel, `🏆 @${username}, vous n'avez aucun badge. Affrontez les champions d'arène pour en obtenir !`);
    return;
  }

  // Construire le message avec tous les badges
  const badgesList = badges.map(badge => badge.name).join(' | ');
  client.say(channel, `🏆 @${username}, Badges (${badges.length}): ${badgesList}`);
}

/**
 * Gère la commande !pokéchat - Afficher les infos du widget ou lister les commandes
 */
async function handlePokéchatCommand(command, userId, channel, username) {
  if (!checkCooldown(userId, 'pokéchat')) {
    client.say(channel, `@${username}, commande en cooldown.`);
    return;
  }

  if (command.action === 'list') {
    // Regrouper toutes les commandes dans un seul message avec un formatage user-friendly (alias entre parenthèses)
    const commandsMessage = `📋 @${username}, Commandes: ` +
      `🎮 VOTES → !capture/!cap [ball] • !combat/!battle/!fight • !fuite/!flee/!run | ` +
      `💰 ÉCONOMIE → !shop/!buy list • !shop <qty> <item> • !pokedollars/!coins/!pd • !inventaire/!inv | ` +
      `⚡ ÉQUIPE → !team/!eq • !start/!starter • !soin/!heal • !evolution/!evo | ` +
      `🏆 BADGES → !badge | ` +
      `🔢 SÉLECTION → !1, !2, !3... | ` +
      `ℹ️ INFO → !pokéchat/!pokechat/!help`;
    
    client.say(channel, commandsMessage);
  } else {
    // !pokéchat seul - expliquer le principe du widget
    const infoMessage = `🎮 @${username}, Pokéchat est un widget interactif Pokémon ! ` +
      `Votez avec !capture, !combat ou !fuite quand un Pokémon sauvage apparaît. ` +
      `Lors des arènes, votez !combat ou !fuite pour affronter les champions. ` +
      `Le gagnant du vote est tiré au sort pour capturer, combattre ou affronter une arène. ` +
      `Construisez votre équipe, achetez des items, remportez des badges et devenez le meilleur dresseur ! ` +
      `Tapez !pokéchat list pour voir toutes les commandes.` +
      `Plus d'informations ici => https://pokechat.owatertv.com ` ;
    
    client.say(channel, infoMessage);
  }
}

/**
 * Gère la commande !system - Démarrer/arrêter le système complet (streamer seulement)
 */
async function handleSystemCommand(command, channel, username) {
  try {
    const { startAutoSpawn, stopAutoSpawn, isAutoSpawnActive } = await import('../services/autoSpawnService.js');
    const { startAutoArenaSpawn, stopAutoArenaSpawn, isAutoArenaSpawnActive } = await import('../services/autoArenaService.js');
    
    if (command.action === 'start') {
      // Démarrer les deux systèmes
      const spawnActive = isAutoSpawnActive();
      const arenaActive = isAutoArenaSpawnActive();
      
      if (spawnActive && arenaActive) {
        client.say(channel, `✅ @${username}, le système est déjà démarré (spawns et arènes actifs).`);
        return;
      }
      
      // Démarrer le spawn automatique
      if (!spawnActive) {
        const minMinutes = parseInt(process.env.AUTO_SPAWN_MIN_INTERVAL) || 2;
        const maxMinutes = parseInt(process.env.AUTO_SPAWN_MAX_INTERVAL) || 5;
        startAutoSpawn(minMinutes, maxMinutes);
      }
      
      // Démarrer le spawn automatique d'arène
      if (!arenaActive) {
        const arenaMinMinutes = parseInt(process.env.AUTO_ARENA_MIN_INTERVAL) || 45;
        const arenaMaxMinutes = parseInt(process.env.AUTO_ARENA_MAX_INTERVAL) || 180;
        startAutoArenaSpawn(arenaMinMinutes, arenaMaxMinutes);
      }
      
      client.say(channel, `✅ @${username}, système démarré ! Spawns automatiques et arènes activés.`);
      
    } else if (command.action === 'stop') {
      // Arrêter les deux systèmes
      const spawnActive = isAutoSpawnActive();
      const arenaActive = isAutoArenaSpawnActive();
      
      if (!spawnActive && !arenaActive) {
        client.say(channel, `✅ @${username}, le système est déjà arrêté.`);
        return;
      }
      
      // Arrêter le spawn automatique
      if (spawnActive) {
        stopAutoSpawn();
      }
      
      // Arrêter le spawn automatique d'arène
      if (arenaActive) {
        stopAutoArenaSpawn();
      }
      
      client.say(channel, `🛑 @${username}, système arrêté ! Spawns automatiques et arènes désactivés.`);
      
    } else {
      // Afficher le statut
      const spawnActive = isAutoSpawnActive();
      const arenaActive = isAutoArenaSpawnActive();
      
      const spawnStatus = spawnActive ? '✅ Actif' : '❌ Inactif';
      const arenaStatus = arenaActive ? '✅ Actif' : '❌ Inactif';
      
      client.say(channel, `📊 @${username}, Statut du système: Spawns ${spawnStatus} | Arènes ${arenaStatus}`);
    }
  } catch (error) {
    console.error('Error handling system command:', error);
    client.say(channel, `❌ Erreur: ${error.message}`);
  }
}

/**
 * Gère la commande !start - Choisir un starter
 */
async function handleStartCommand(userId, channel, username) {
  if (!checkCooldown(userId, 'start')) {
    client.say(channel, `@${username}, commande en cooldown.`);
    return;
  }

  // Vérifier si le viewer a déjà des pokémon
  const userPokemons = await query(`
    SELECT COUNT(*)::int as count FROM user_pokemons WHERE user_id = ?
  `, [userId]);

  const pokemonCount = userPokemons[0]?.count || 0;

  if (pokemonCount > 0) {
    client.say(channel, `@${username}, vous avez déjà des pokémon. Vous ne pouvez choisir un starter qu'une seule fois !`);
    return;
  }

  // Récupérer les 3 starters de première génération
  const starters = await query(`
    SELECT * FROM pokemons 
    WHERE pokedex_id IN (1, 4, 7)
    ORDER BY pokedex_id ASC
  `);

  if (starters.length !== 3) {
    client.say(channel, `@${username}, erreur: les starters ne sont pas disponibles.`);
    console.error('Starters not found in database. Expected 3, found:', starters.length);
    return;
  }

  // Afficher les choix
  const starterList = starters.map((s, index) => `${index + 1}. ${s.name}`).join(', ');
  client.say(channel, `@${username}, choisissez votre starter: ${starterList}. Envoyez !1, !2 ou !3`);

  // Enregistrer que ce viewer est en train de choisir un starter
  // La table starter_selections est créée dans le schéma
  await query(`
    INSERT INTO starter_selections (user_id)
    VALUES (?)
    ON CONFLICT (user_id) DO UPDATE SET selected_at = CURRENT_TIMESTAMP
  `, [userId]);

  // Diffuser l'événement pour l'overlay (optionnel)
  if (io) {
    io.emit('starter_selection', {
      userId,
      username,
      starters: starters.map((s, index) => ({
        index: index + 1,
        id: s.id,
        name: s.name,
        type_1: s.type_1,
        type_2: s.type_2,
        sprite_url: s.sprite_url
      }))
    });
  }
}

/**
 * Gère la commande !soin
 */
async function handleHealCommand(userId, channel, username) {
  if (!checkCooldown(userId, 'heal')) {
    client.say(channel, `@${username}, commande en cooldown.`);
    return;
  }

  // Récupérer tous les pokémon KO du viewer
  const koPokemons = await query(`
    SELECT up.*, p.base_hp
    FROM user_pokemons up
    JOIN pokemons p ON up.pokemon_id = p.id
    WHERE up.user_id = ? AND up.is_ko = true
  `, [userId]);

  if (koPokemons.length === 0) {
    client.say(channel, `@${username}, aucun pokémon à soigner.`);
    return;
  }

  // Soigner chaque pokémon (restaurer HP max et retirer KO)
  for (const pokemon of koPokemons) {
    const maxHP = Math.floor(pokemon.base_hp * (1 + (pokemon.level - 1) * 0.1));
    await query(`
      UPDATE user_pokemons 
      SET is_ko = false, current_hp = ?
      WHERE id = ?
    `, [maxHP, pokemon.id]);
  }

  client.say(channel, `💚 @${username}, ${koPokemons.length} pokémon soigné(s) !`);
}

/**
 * Gère la commande !evolution : liste les Pokémon prêts à évoluer et met en attente le choix (!1, !2...).
 */
async function handleEvolutionCommand(userId, channel, username) {
  if (!checkCooldown(userId, 'evolution')) {
    client.say(channel, `@${username}, commande en cooldown. Attendez 5 secondes.`);
    return;
  }

  const { isReadyToEvolve } = await import('../services/experienceService.js');

  const userPokemons = await query(`
    SELECT up.id AS user_pokemon_id, up.level, up.current_hp, p.pokedex_id, p.name, p.evolution_details, p.base_hp
    FROM user_pokemons up
    JOIN pokemons p ON up.pokemon_id = p.id
    WHERE up.user_id = ? AND up.is_ko = false
    ORDER BY up.level DESC, up.captured_at ASC
  `, [userId]);

  const readyToEvolve = [];
  for (const up of userPokemons) {
    if (!isReadyToEvolve(up.evolution_details, up.level)) continue;
    const evolution = await queryOne(
      'SELECT id, name, pokedex_id, base_hp FROM pokemons WHERE pre_evolution_pokedex_id = ? LIMIT 1',
      [up.pokedex_id]
    );
    if (evolution) {
      readyToEvolve.push({
        userPokemonId: up.user_pokemon_id,
        pokemonName: up.name,
        level: up.level,
        evolutionName: evolution.name,
        evolutionId: evolution.id,
        evolutionBaseHp: evolution.base_hp
      });
    }
  }

  if (readyToEvolve.length === 0) {
    client.say(channel, `@${username}, aucun de vos Pokémon n'est prêt à évoluer.`);
    return;
  }

  evolutionSelectionPending.set(userId, {
    list: readyToEvolve,
    expiresAt: Date.now() + EVOLUTION_SELECTION_TTL_MS
  });

  const listStr = readyToEvolve.map((p, i) => `${i + 1}. ${p.pokemonName} (Niv.${p.level}) → ${p.evolutionName}`).join(' | ');
  client.say(channel, `✨ @${username}, Pokémon prêt(s) à évoluer : ${listStr}. Choisissez avec !1, !2, etc.`);
}

/**
 * Applique l'évolution : remplace le Pokémon par son évolution en gardant niveau et XP.
 */
async function handleEvolutionSelection(userId, channel, username, index) {
  const pending = evolutionSelectionPending.get(userId);
  if (!pending) return;
  if (Date.now() > pending.expiresAt) {
    evolutionSelectionPending.delete(userId);
    return;
  }

  const { list } = pending;
  if (index < 1 || index > list.length) {
    client.say(channel, `@${username}, sélection invalide. Choisissez entre !1 et !${list.length}.`);
    return;
  }

  const choice = list[index - 1];
  evolutionSelectionPending.delete(userId);

  const evolution = await queryOne('SELECT id, base_hp FROM pokemons WHERE id = ?', [choice.evolutionId]);
  if (!evolution) {
    client.say(channel, `@${username}, erreur : évolution introuvable.`);
    return;
  }

  const newMaxHp = Math.floor(evolution.base_hp * (1 + (choice.level - 1) * 0.1));
  await query(`
    UPDATE user_pokemons
    SET pokemon_id = ?, current_hp = ?
    WHERE id = ?
  `, [choice.evolutionId, newMaxHp, choice.userPokemonId]);

  client.say(channel, `✨ @${username}, ${choice.pokemonName} a évolué en ${choice.evolutionName} ! (Niv.${choice.level})`);
}

/**
 * Gère la sélection d'un pokémon (!1, !2, etc.)
 * Priorité : 1) Événement en cours (ball/combat/remplacement), 2) Évolution en attente, 3) Starter.
 * Ainsi un même viewer peut avoir un vote en cours et une évolution en attente sans que !1 soit capté par l'évolution.
 */
async function handleSelectPokemonCommand(userId, channel, username, index) {
  // 1) Événement en attente de sélection (priorité : time-out possible)
  const event = await queryOne(`
    SELECT * FROM active_events 
    WHERE selected_user_id = ? 
    AND processing_state IN ('ball_selection', 'battle_selection', 'waiting_replacement')
    AND status = 'active'
    ORDER BY started_at DESC
    LIMIT 1
  `, [userId]);

  if (event) {
    if (event.processing_state === 'ball_selection') {
      await handleBallSelection(event.id, userId, channel, username, index);
    } else if (event.processing_state === 'battle_selection') {
      await handleBattlePokemonSelection(event.id, userId, channel, username, index);
    } else if (event.processing_state === 'waiting_replacement') {
      await handleReplacementSelection(event.id, userId, channel, username, index);
    }
    return;
  }

  // 2) En attente de choix d'évolution (!evolution puis !1, !2...)
  const evolutionPending = evolutionSelectionPending.get(userId);
  if (evolutionPending && Date.now() <= evolutionPending.expiresAt) {
    await handleEvolutionSelection(userId, channel, username, index);
    return;
  }
  if (evolutionPending) evolutionSelectionPending.delete(userId);

  // 3) Sélection de starter
  const starterSelection = await queryOne(`
    SELECT * FROM starter_selections WHERE user_id = ?
  `, [userId]);

  if (starterSelection) {
    await handleStarterSelection(userId, channel, username, index);
  }
}

/**
 * Gère la sélection d'une ball pour la capture
 */
async function handleBallSelection(eventId, userId, channel, username, index) {
  // Récupérer les balls disponibles dans l'inventaire du viewer
  const availableBalls = await query(`
    SELECT ui.quantity, si.id as item_id, si.name, si.sprite_url, si.effect_value
    FROM user_inventory ui
    JOIN shop_items si ON ui.item_id = si.id
    WHERE ui.user_id = $1 
      AND si.effect_type = 'CAPTURE_BONUS'
      AND ui.quantity > 0
    ORDER BY si.price ASC
  `, [userId]);

  if (index < 1 || index > availableBalls.length) {
    client.say(channel, `@${username}, sélection invalide. Choisissez entre !1 et !${availableBalls.length}.`);
    return;
  }

  const selectedBall = availableBalls[index - 1];
  const ballType = selectedBall.name;
  const ballBonus = selectedBall.effect_value;

  // Mettre à jour l'événement pour indiquer que la capture est en cours
  await query('UPDATE active_events SET processing_state = $1 WHERE id = $2',
    ['capture_in_progress', eventId]);

  // Récupérer l'événement et le pokémon
  const event = await queryOne(`
    SELECT ae.*, p.*, p.id as pokemon_db_id
    FROM active_events ae
    LEFT JOIN pokemons p ON ae.pokemon_id = p.id
    WHERE ae.id = $1
  `, [eventId]);

  if (!event) {
    client.say(channel, `@${username}, événement introuvable.`);
    return;
  }

  const pokemon = {
    id: event.pokemon_db_id,
    pokedex_id: event.pokedex_id,
    name: event.name,
    base_hp: event.base_hp,
    rarity: event.rarity,
    capture_rate: event.capture_rate,
    sprite_url: event.sprite_url
  };

  // Diffuser l'événement de capture avec la ball sélectionnée
  if (io) {
    const { broadcastCaptureAttempt } = await import('../websocket/handlers.js');
    broadcastCaptureAttempt(io, {
      eventId,
      userId,
      username,
      pokemon,
      ballType: ballType.toLowerCase(),
      ballSprite: selectedBall.sprite_url,
      ballBonus
    });
  }

  // Attendre que l'animation du pokémon entrant dans la ball soit terminée (1.5s)
  // et que le bounce commence, puis calculer le résultat
  // Le résultat sera affiché 3 secondes après le début du bounce
  setTimeout(async () => {
    const { attemptCaptureForVoter } = await import('../services/voteProcessingService.js');
    await attemptCaptureForVoter(eventId, userId, ballType, ballBonus);
  }, 1500); // 1.5 secondes pour que le pokémon entre dans la ball, puis le bounce commence
}

/**
 * Gère la sélection d'un starter
 */
async function handleStarterSelection(userId, channel, username, index) {
  // Récupérer les starters
  const starters = await query(`
    SELECT * FROM pokemons 
    WHERE pokedex_id IN (1, 4, 7)
    ORDER BY pokedex_id ASC
  `);

  if (index < 1 || index > starters.length) {
    client.say(channel, `@${username}, sélection invalide. Choisissez entre !1, !2 ou !3.`);
    return;
  }

  const selectedStarter = starters[index - 1];

  // Vérifier à nouveau que le viewer n'a pas de pokémon (sécurité)
  const userPokemons = await query(`
    SELECT COUNT(*)::int as count FROM user_pokemons WHERE user_id = ?
  `, [userId]);

  const pokemonCount = userPokemons[0]?.count || 0;

  if (pokemonCount > 0) {
    // Supprimer la sélection en cours
    await query('DELETE FROM starter_selections WHERE user_id = ?', [userId]);
    client.say(channel, `@${username}, vous avez déjà des pokémon. Vous ne pouvez choisir un starter qu'une seule fois !`);
    return;
  }

  // Ajouter le starter à l'équipe du viewer (niveau 5 pour un starter)
  const starterLevel = 5;
  const currentHP = Math.floor(selectedStarter.base_hp * (1 + (starterLevel - 1) * 0.1));

  await query(`
    INSERT INTO user_pokemons (user_id, pokemon_id, level, xp, current_hp, is_ko)
    VALUES (?, ?, ?, 0, ?, false)
  `, [userId, selectedStarter.id, starterLevel, currentHP]);

  const { addToUserPokedex } = await import('../services/pokedexService.js');
  await addToUserPokedex(userId, selectedStarter.id, starterLevel);

  // Supprimer la sélection en cours
  await query('DELETE FROM starter_selections WHERE user_id = ?', [userId]);

  // Récompenser avec quelques pokédollars de départ
  const { addCoins } = await import('../services/economyService.js');
  await addCoins(userId, 50);

  client.say(channel, `🎉 @${username} a choisi ${selectedStarter.name} comme starter ! Niveau ${starterLevel}, +50 Pokédollars de départ !`);

  // Diffuser l'événement pour l'overlay (optionnel)
  if (io) {
    io.emit('starter_selected', {
      userId,
      username,
      starter: {
        id: selectedStarter.id,
        name: selectedStarter.name,
        level: starterLevel,
        sprite_url: selectedStarter.sprite_url
      }
    });
  }
}

/**
 * Gère la sélection d'un pokémon pour le combat
 */
async function handleBattlePokemonSelection(eventId, userId, channel, username, index) {
  // Récupérer les pokémon non-KO du viewer
  const userPokemons = await query(`
    SELECT up.*, p.name as pokemon_name, p.type_1, p.type_2, p.base_hp, p.base_attack, p.sprite_url
    FROM user_pokemons up
    JOIN pokemons p ON up.pokemon_id = p.id
    WHERE up.user_id = ? AND up.is_ko = false
    ORDER BY up.level DESC, up.captured_at ASC
  `, [userId]);

  if (index < 1 || index > userPokemons.length) {
    client.say(channel, `@${username}, sélection invalide. Choisissez entre !1 et !${userPokemons.length}.`);
    return;
  }

  const selectedPokemon = userPokemons[index - 1];

  // Récupérer le pokémon sauvage (experience_growth pour le calcul d'XP)
  const event = await queryOne(`
    SELECT ae.*, p.*, p.id as pokemon_db_id, p.sprite_url, p.base_hp, p.experience_growth
    FROM active_events ae
    LEFT JOIN pokemons p ON ae.pokemon_id = p.id
    WHERE ae.id = ?
  `, [eventId]);

  // Simuler le combat entre le pokémon du viewer et le pokémon sauvage
  const { simulateBattleBetweenPokemon } = await import('../services/battleService.js');
  const battleResult = await simulateBattleBetweenPokemon(
    selectedPokemon.pokemon_id,
    selectedPokemon.level,
    event.pokemon_db_id,
    event.level
  );

  // Calculer les HP pour l'affichage
  const userMaxHP = Math.floor(selectedPokemon.base_hp * (1 + (selectedPokemon.level - 1) * 0.1));
  const wildMaxHP = Math.floor(event.base_hp * (1 + (event.level - 1) * 0.1));
  
  // Mettre à jour le mode combat avec les pokémon sélectionnés
  if (io) {
    io.emit('battle_start', {
      eventId,
      userPokemon: {
        id: selectedPokemon.pokemon_id,
        name: selectedPokemon.pokemon_name,
        level: selectedPokemon.level,
        sprite_url: selectedPokemon.sprite_url,
        base_hp: selectedPokemon.base_hp,
        current_hp: selectedPokemon.current_hp || userMaxHP,
        max_hp: userMaxHP
      },
      wildPokemon: {
        id: event.pokemon_db_id,
        name: event.name,
        level: event.level,
        sprite_url: event.sprite_url,
        base_hp: event.base_hp,
        current_hp: event.current_hp || wildMaxHP,
        max_hp: wildMaxHP
      }
    });
  }

  // Attendre un peu avant d'envoyer le résultat pour permettre l'animation
  setTimeout(async () => {
    // Utiliser les HP finaux du résultat du combat
    const finalUserHP = battleResult.finalHP?.user || 0;
    const finalWildHP = battleResult.finalHP?.wild || 0;
    
    if (battleResult.victory) {
      // Victoire
      const { addCoins } = await import('../services/economyService.js');
      await addCoins(userId, 100);
      client.say(channel, `🎉 @${username} a gagné le combat avec ${selectedPokemon.pokemon_name}! +100 Pokédollars`);

      // Gain d'XP : EXP = (1 * b * N) / 7 (b = exp de base du Pokémon vaincu, N = son niveau)
      const { addExperience, computeExpGain } = await import('../services/experienceService.js');
      const wildLevel = event.level || 1;
      const expGained = computeExpGain(wildLevel, event.experience_growth);
      const xpResult = await addExperience(selectedPokemon.id, expGained);
      if (xpResult.levelsGained > 0) {
        client.say(channel, `📈 @${username}, ${xpResult.pokemonName} monte au niveau ${xpResult.newLevel} !`);
        if (xpResult.readyToEvolve) {
          client.say(channel, `✨ @${username}, ${xpResult.pokemonName} est prêt à évoluer !`);
        }
      } else if (xpResult.readyToEvolve) {
        client.say(channel, `✨ @${username}, ${xpResult.pokemonName} est prêt à évoluer !`);
      }

      // Mettre à jour les HP du pokémon de l'utilisateur avec les HP finaux
      await query(`
        UPDATE user_pokemons 
        SET current_hp = ?, is_ko = false
        WHERE id = ?
      `, [finalUserHP, selectedPokemon.id]);

      // Diffuser le résultat avec les données pour l'animation (inclure nouveau niveau si level up)
      if (io) {
        io.emit('battle_result', {
          eventId,
          userId,
          username,
          pokemon: selectedPokemon.pokemon_name,
          victory: true,
          loserPokemon: 'wild',
          userPokemonHP: finalUserHP,
          wildPokemonHP: finalWildHP,
          levelUp: xpResult.levelsGained > 0 ? { newLevel: xpResult.newLevel, readyToEvolve: xpResult.readyToEvolve } : null
        });
      }
    } else {
      // Défaite - pokémon KO
      await query('UPDATE user_pokemons SET is_ko = true, current_hp = 0 WHERE id = ?', [selectedPokemon.id]);
      client.say(channel, `❌ @${username}, ${selectedPokemon.pokemon_name} a été mis KO. Utilisez !soin pour le soigner.`);
      
      // Diffuser le résultat avec les données pour l'animation
      if (io) {
        io.emit('battle_result', {
          eventId,
          userId,
          username,
          pokemon: selectedPokemon.pokemon_name,
          victory: false,
          loserPokemon: 'user', // Le pokémon de l'utilisateur a perdu
          userPokemonHP: finalUserHP,
          wildPokemonHP: finalWildHP
        });
      }
    }
  }, 2000); // Attendre 2 secondes pour que le pokémon apparaisse

  // Marquer l'événement comme complété
  await query('UPDATE active_events SET status = ?, processing_state = ? WHERE id = ?',
    ['completed', 'completed', eventId]);
}

/**
 * Gère la sélection d'un pokémon à remplacer
 */
async function handleReplacementSelection(eventId, userId, channel, username, index) {
  // Récupérer les pokémon du viewer
  const userPokemons = await query(`
    SELECT up.*, p.name as pokemon_name
    FROM user_pokemons up
    JOIN pokemons p ON up.pokemon_id = p.id
    WHERE up.user_id = ?
    ORDER BY up.captured_at ASC
  `, [userId]);

  if (index < 1 || index > userPokemons.length) {
    client.say(channel, `@${username}, sélection invalide. Choisissez entre !1 et !${userPokemons.length}.`);
    return;
  }

  const pokemonToReplace = userPokemons[index - 1];

  // Récupérer l'événement pour obtenir le pokémon capturé
  const event = await queryOne(`
    SELECT * FROM active_events WHERE id = ?
  `, [eventId]);

  // Supprimer le pokémon remplacé
  await query('DELETE FROM user_pokemons WHERE id = ?', [pokemonToReplace.id]);
  
  client.say(channel, `@${username}, ${pokemonToReplace.pokemon_name} a été remplacé.`);

  // Récupérer le pokémon pour calculer les HP
  const pokemon = await queryOne('SELECT * FROM pokemons WHERE id = ?', [event.pokemon_id]);
  
  // Ajouter le nouveau pokémon
  const pokemonLevel = event.level || 1;
  const currentHP = Math.floor(pokemon.base_hp * (1 + (pokemonLevel - 1) * 0.1));
  
  await query(`
    INSERT INTO user_pokemons (user_id, pokemon_id, level, xp, current_hp, is_ko)
    VALUES (?, ?, ?, 0, ?, false)
  `, [userId, event.pokemon_id, pokemonLevel, currentHP]);

  const { addToUserPokedex } = await import('../services/pokedexService.js');
  await addToUserPokedex(userId, event.pokemon_id, pokemonLevel);

  // Récompenser avec 100 pokédollars
  const { addCoins } = await import('../services/economyService.js');
  await addCoins(userId, 100);

  client.say(channel, `🎉 @${username} a capturé ${pokemon.name}! +100 Pokédollars`);

  // Marquer l'événement comme complété
  await query('UPDATE active_events SET status = ?, processing_state = ? WHERE id = ?',
    ['completed', 'completed', eventId]);

  // Diffuser le résultat
  if (io) {
    io.emit('capture_success', {
      eventId,
      userId,
      username,
      pokemon: {
        ...pokemon,
        level: pokemonLevel
      }
    });
  }
}

/**
 * Gère la commande !spawn (streamer seulement)
 */
async function handleSpawnCommand(channel) {
  try {
    const event = await spawnPokemon();

    if (io) {
      await broadcastSpawn(io, event);
    }

    client.say(channel, `Un ${event.pokemon.name} sauvage est apparu! Utilisez !capture, !combat ou !fuite`);
  } catch (error) {
    client.say(channel, `Erreur: ${error.message}`);
  }
}

/**
 * Gère la commande !spawn arena (streamer seulement)
 */
async function handleArenaSpawnCommand(channel) {
  try {
    const { spawnArena } = await import('../services/arenaService.js');
    const { broadcastArenaSpawn } = await import('../websocket/handlers.js');
    
    const arenaEvent = await spawnArena();

    if (io) {
      await broadcastArenaSpawn(io, arenaEvent);
    }

    client.say(channel, `🏟️ Un champion d'arène ${arenaEvent.arena.type} apparaît ! ${arenaEvent.arena.name} défie les dresseurs ! Utilisez !combat ou !fuite`);
  } catch (error) {
    console.error('Error spawning arena:', error);
    client.say(channel, `Erreur: ${error.message}`);
  }
}

/**
 * Initialise et connecte le client Twitch IRC
 */
export async function connectTwitchChat() {
  const channel = process.env.TWITCH_CHANNEL;
  const username = process.env.TWITCH_BOT_USERNAME || process.env.TWITCH_CHANNEL;
  const oauth = process.env.TWITCH_ACCESS_TOKEN;

  if (!channel || !oauth) {
    console.warn('⚠️  Twitch chat not configured. Set TWITCH_CHANNEL and TWITCH_ACCESS_TOKEN in .env');
    return null;
  }

  // S'assurer que le token commence par "oauth:"
  const oauthToken = oauth.startsWith('oauth:') ? oauth : `oauth:${oauth}`;

  const opts = {
    identity: {
      username: username,
      password: oauthToken
    },
    channels: [channel]
  };

  client = new tmi.client(opts);

  // Événements du client
  client.on('message', async (channel, tags, message, self) => {
    // Ignorer les messages du bot lui-même
    if (self) return;

    const username = tags.username;
    const userId = tags['user-id'];
    const displayName = tags['display-name'] || username;

    // Obtenir ou créer l'utilisateur
    const user = await getOrCreateUser(userId, displayName);

    // Parser la commande
    const command = parseCommand(message, user.id);

    if (command) {
      try {
        switch (command.type) {
          case 'capture':
            await handleCaptureCommand(user.id, channel, displayName, command.ballType);
            break;
          
          case 'battle':
            await handleBattleCommand(user.id, channel, displayName);
            break;
          
          case 'flee':
            await handleFleeCommand(user.id, channel, displayName);
            break;
          
          case 'heal':
            await handleHealCommand(user.id, channel, displayName);
            break;
          
          case 'pokedollars':
            await handlePokedollarsCommand(user.id, channel, displayName);
            break;
          
          case 'inventaire':
            await handleInventaireCommand(user.id, channel, displayName);
            break;
          
          case 'team':
            await handleTeamCommand(user.id, channel, displayName);
            break;
          
          case 'badge':
            await handleBadgeCommand(user.id, channel, displayName);
            break;
          
          case 'pokéchat':
            await handlePokéchatCommand(command, user.id, channel, displayName);
            break;
          
          case 'system':
            // Vérifier si c'est le streamer (seulement le streamer, pas les mods)
            const isBroadcasterSystem = tags.badges?.broadcaster === '1' || tags['user-id'] === tags['room-id'];
            if (isBroadcasterSystem) {
              await handleSystemCommand(command, channel, displayName);
            } else {
              client.say(channel, `@${displayName}, cette commande est réservée au streamer.`);
            }
            break;
          
          case 'shop':
            await handleShopCommand(command, user.id, channel, displayName);
            break;
          
          case 'spawn':
            // Vérifier si c'est le streamer (seulement le streamer, pas les mods)
            const isBroadcaster = tags.badges?.broadcaster === '1' || tags['user-id'] === tags['room-id'];
            if (isBroadcaster) {
              await handleSpawnCommand(channel);
            } else {
              // Ne rien dire pour ne pas spammer le chat
            }
            break;
          
          case 'spawn_arena':
            // Vérifier si c'est le streamer (seulement le streamer, pas les mods)
            const isBroadcasterArena = tags.badges?.broadcaster === '1' || tags['user-id'] === tags['room-id'];
            if (isBroadcasterArena) {
              await handleArenaSpawnCommand(channel);
            } else {
              // Ne rien dire pour ne pas spammer le chat
            }
            break;
          
          case 'start':
            await handleStartCommand(user.id, channel, displayName);
            break;

          case 'evolution':
            await handleEvolutionCommand(user.id, channel, displayName);
            break;
          
          case 'select_pokemon':
            await handleSelectPokemonCommand(user.id, channel, displayName, command.index);
            break;
        }
      } catch (error) {
        console.error('Error handling command:', error);
        client.say(channel, `Erreur lors du traitement de la commande.`);
      }
    }
  });

  client.on('connected', () => {
    isConnected = true;
  });

  client.on('disconnected', () => {
    isConnected = false;
  });

  // Connexion
  try {
    await client.connect();
    return client;
  } catch (error) {
    console.error('❌ Error connecting to Twitch chat:', error);
    return null;
  }
}

/**
 * Déconnecte le client Twitch
 */
export function disconnectTwitchChat() {
  if (client && isConnected) {
    client.disconnect();
    isConnected = false;
  }
}

/**
 * Envoie un message dans le chat Twitch
 * @param {string} message - Message à envoyer
 * @returns {Promise<boolean>} True si le message a été envoyé
 */
export async function sendChatMessage(message) {
  if (!client || !isConnected) {
    console.warn('⚠️  Cannot send chat message: Twitch client not connected');
    console.warn('⚠️  Client exists:', !!client);
    console.warn('⚠️  Is connected:', isConnected);
    return false;
  }

  const channel = process.env.TWITCH_CHANNEL;
  if (!channel) {
    console.warn('⚠️  Cannot send chat message: TWITCH_CHANNEL not set');
    return false;
  }

  try {
    // Format du channel pour tmi.js : doit commencer par #
    const channelName = channel.startsWith('#') ? channel : `#${channel}`;
    await client.say(channelName, message);
    return true;
  } catch (error) {
    console.error('❌ Error sending chat message:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Error stack:', error.stack);
    return false;
  }
}

/**
 * Vérifie si le client est connecté
 */
export function isTwitchChatConnected() {
  return isConnected;
}

