import express from 'express';
import { query, queryOne, queryResult } from '../database/connection.js';
import { spawnPokemon, getActiveEvent } from '../services/spawnService.js';
import { registerVote, attemptCapture, getVoteStats } from '../services/captureService.js';
import { deductCoins, getCoins } from '../services/economyService.js';
import { broadcastSpawn, broadcastVoteUpdate, broadcastCaptureResult } from '../websocket/handlers.js';

const router = express.Router();

// Cooldown pour les commandes (en millisecondes)
const COMMAND_COOLDOWN = 5000; // 5 secondes
const userCooldowns = new Map();

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
  let user = await queryOne('SELECT * FROM users WHERE twitch_id = ?', [twitchId]);
  
  if (!user) {
    await query(
      'INSERT INTO users (twitch_id, username, xp, level, poke_coins) VALUES (?, ?, 0, 1, 0)',
      [twitchId, username]
    );
    user = await queryOne('SELECT * FROM users WHERE twitch_id = ?', [twitchId]);
  }
  
  return user;
}

/**
 * Handler pour les webhooks StreamElements
 * POST /webhook/streamelements
 */
router.post('/webhook/streamelements', async (req, res) => {
  try {
    // StreamElements envoie les données dans req.body
    const data = req.body;
    
    // Vérifier le secret si configuré
    if (process.env.STREAMELEMENTS_WEBHOOK_SECRET) {
      const secret = req.headers['x-secret'] || req.query.secret;
      if (secret !== process.env.STREAMELEMENTS_WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    
    // Parser le message (format peut varier selon StreamElements)
    const message = data.message || data.text || '';
    const username = data.username || data.user || '';
    const twitchId = data.userId || data.twitchId || '';
    
    if (!message || !username) {
      return res.status(400).json({ error: 'Missing message or username' });
    }
    
    // Obtenir ou créer l'utilisateur
    const user = await getOrCreateUser(twitchId || username, username);
    
    // Parser la commande
    const command = parseCommand(message, user.id);
    
    if (command) {
      // Exécuter la commande
      await executeCommand(command, user.id, res);
    } else {
      res.json({ success: false, message: 'Unknown command' });
    }
  } catch (error) {
    console.error('Error handling StreamElements webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Parse une commande depuis le message
 * @param {string} message 
 * @param {number} userId 
 * @returns {Object|null} Commande parsée
 */
function parseCommand(message, userId) {
  const trimmed = message.trim().toLowerCase();
  
  // !capture ou !vote capture
  if (trimmed.startsWith('!capture') || trimmed.startsWith('!vote capture')) {
    return { type: 'capture', userId };
  }
  
  // !vote battle ou !battle
  if (trimmed.startsWith('!vote battle') || trimmed.startsWith('!battle')) {
    return { type: 'battle', userId };
  }
  
  // !vote flee ou !flee
  if (trimmed.startsWith('!vote flee') || trimmed.startsWith('!flee')) {
    return { type: 'flee', userId };
  }
  
  // !shop <item> [quantity]
  if (trimmed.startsWith('!shop')) {
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const itemName = parts[1];
      const quantity = parseInt(parts[2]) || 1;
      return { type: 'shop', userId, itemName, quantity };
    }
  }
  
  // !spawn (admin seulement - pour tests)
  if (trimmed.startsWith('!spawn')) {
    return { type: 'spawn', userId };
  }
  
  return null;
}

/**
 * Exécute une commande
 * @param {Object} command 
 * @param {number} userId 
 * @param {Response} res 
 */
async function executeCommand(command, userId, res) {
  try {
    switch (command.type) {
      case 'capture':
        await handleCaptureCommand(userId, res);
        break;
      
      case 'battle':
        await handleBattleCommand(userId, res);
        break;
      
      case 'flee':
        await handleFleeCommand(userId, res);
        break;
      
      case 'shop':
        await handleShopCommand(command.itemName, command.quantity, userId, res);
        break;
      
      case 'spawn':
        await handleSpawnCommand(res);
        break;
      
      default:
        res.json({ success: false, message: 'Unknown command type' });
    }
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Gère la commande !capture
 */
async function handleCaptureCommand(userId, res) {
  if (!checkCooldown(userId, 'capture')) {
    return res.json({ success: false, message: 'Command on cooldown' });
  }
  
  const event = await getActiveEvent();
  
  if (!event) {
    return res.json({ success: false, message: 'No active event' });
  }
  
  // Vérifier si l'utilisateur a déjà voté
  const hasVoted = await queryOne(
    'SELECT * FROM event_votes WHERE event_id = ? AND user_id = ?',
    [event.id, userId]
  );
  
  if (hasVoted) {
    return res.json({ success: false, message: 'You have already voted' });
  }
  
  // Enregistrer le vote
  await registerVote(event.id, userId, 'capture');
  
  // Tenter la capture (utilise automatiquement une Pokéball si disponible)
  const inventory = await query(`
    SELECT ui.*, si.effect_value
    FROM user_inventory ui
    JOIN shop_items si ON ui.item_id = si.id
    WHERE ui.user_id = ? AND si.effect_type = 'CAPTURE_BONUS' AND ui.quantity > 0
    ORDER BY si.effect_value DESC
    LIMIT 1
  `, [userId]);
  
  const ballBonus = inventory.length > 0 ? inventory[0].effect_value : 0;
  
  // Utiliser une ball si disponible
  if (inventory.length > 0) {
    await query(
      'UPDATE user_inventory SET quantity = quantity - 1 WHERE id = ?',
      [inventory[0].id]
    );
  }
  
  const result = await attemptCapture(event.id, userId, ballBonus);
  
  // Diffuser les résultats
  const voteStats = await getVoteStats(event.id);
  
  if (result.success) {
    res.json({
      success: true,
      message: `🎉 Capture réussie! ${result.pokemon.name} a été ajouté à votre équipe!`,
      pokemon: result.pokemon,
      rewards: result.rewards
    });
  } else {
    res.json({
      success: false,
      message: `❌ Échec de la capture. Taux: ${(result.captureRate * 100).toFixed(1)}%`
    });
  }
}

/**
 * Gère la commande !battle
 */
async function handleBattleCommand(userId, res) {
  if (!checkCooldown(userId, 'battle')) {
    return res.json({ success: false, message: 'Command on cooldown' });
  }
  
  const event = await getActiveEvent();
  
  if (!event || event.type !== 'spawn') {
    return res.json({ success: false, message: 'No active spawn event' });
  }
  
  const hasVoted = await queryOne(
    'SELECT * FROM event_votes WHERE event_id = ? AND user_id = ?',
    [event.id, userId]
  );
  
  if (hasVoted) {
    return res.json({ success: false, message: 'You have already voted' });
  }
  
  await registerVote(event.id, userId, 'battle');
  
  res.json({ success: true, message: 'Vote enregistré: Combat' });
}

/**
 * Gère la commande !flee
 */
async function handleFleeCommand(userId, res) {
  if (!checkCooldown(userId, 'flee')) {
    return res.json({ success: false, message: 'Command on cooldown' });
  }
  
  const event = await getActiveEvent();
  
  if (!event) {
    return res.json({ success: false, message: 'No active event' });
  }
  
  const hasVoted = await queryOne(
    'SELECT * FROM event_votes WHERE event_id = ? AND user_id = ?',
    [event.id, userId]
  );
  
  if (hasVoted) {
    return res.json({ success: false, message: 'You have already voted' });
  }
  
  await registerVote(event.id, userId, 'flee');
  
  res.json({ success: true, message: 'Vote enregistré: Fuite' });
}

/**
 * Gère la commande !shop
 */
async function handleShopCommand(itemName, quantity, userId, res) {
  if (!checkCooldown(userId, 'shop')) {
    return res.json({ success: false, message: 'Command on cooldown' });
  }
  
  const item = await queryOne('SELECT * FROM shop_items WHERE LOWER(name) = LOWER(?)', [itemName]);
  
  if (!item) {
    return res.json({ success: false, message: 'Item not found' });
  }
  
  const totalPrice = item.price * quantity;
  const userCoins = await getCoins(userId);
  
  if (userCoins < totalPrice) {
    return res.json({
      success: false,
      message: `Solde insuffisant. Requis: ${totalPrice}, Disponible: ${userCoins}`
    });
  }
  
  await deductCoins(userId, totalPrice);
  
  const existingItem = await queryOne(
    'SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?',
    [userId, item.id]
  );
  
  if (existingItem) {
    await query(
      'UPDATE user_inventory SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?',
      [quantity, userId, item.id]
    );
  } else {
    await query(
      'INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, ?)',
      [userId, item.id, quantity]
    );
  }
  
  res.json({
    success: true,
    message: `Achat réussi: ${quantity}x ${item.name} pour ${totalPrice} Pokécoins`
  });
}

/**
 * Gère la commande !spawn (admin/test)
 */
async function handleSpawnCommand(res) {
  try {
    const event = await spawnPokemon();
    
    res.json({
      success: true,
      message: `Un ${event.pokemon.name} sauvage est apparu!`,
      event
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}

export default router;
