import express from 'express';
import { query, queryOne } from '../database/connection.js';
import { getUserStats, deductCoins, getCoins } from '../services/economyService.js';
import { getActiveEvent, spawnPokemon } from '../services/spawnService.js';
import { getVoteStats } from '../services/captureService.js';
import { broadcastSpawn } from '../websocket/handlers.js';
import { startAutoSpawn, stopAutoSpawn, isAutoSpawnActive, getAutoSpawnConfig } from '../services/autoSpawnService.js';
import { io } from '../server.js';

const router = express.Router();

/**
 * GET /api/user/:id
 * Obtient les informations d'un utilisateur
 */
router.get('/user/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Obtenir les statistiques
    const stats = await getUserStats(userId);
    
    // Obtenir les Pokémon de l'utilisateur
    const pokemons = await query(`
      SELECT up.*, p.name, p.pokedex_id, p.type_1, p.type_2, p.sprite_url, p.rarity
      FROM user_pokemons up
      JOIN pokemons p ON up.pokemon_id = p.id
      WHERE up.user_id = ?
      ORDER BY up.captured_at DESC
    `, [userId]);
    
    // Obtenir les badges
    const badges = await query(`
      SELECT b.*, ub.earned_at
      FROM user_badges ub
      JOIN badges b ON ub.badge_id = b.id
      WHERE ub.user_id = ?
      ORDER BY ub.earned_at DESC
    `, [userId]);
    
    res.json({
      user: {
        id: user.id,
        twitch_id: user.twitch_id,
        username: user.username,
        ...stats
      },
      pokemons,
      badges
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user/by-twitch/:twitchId
 * Obtient un utilisateur par son Twitch ID
 */
router.get('/user/by-twitch/:twitchId', async (req, res) => {
  try {
    const twitchId = req.params.twitchId;
    const user = await queryOne('SELECT * FROM users WHERE twitch_id = ?', [twitchId]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error getting user by Twitch ID:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/inventory/:userId
 * Obtient l'inventaire d'un utilisateur
 */
router.get('/inventory/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    const inventory = await query(`
      SELECT ui.*, si.name, si.price, si.effect_type, si.effect_value, si.description
      FROM user_inventory ui
      JOIN shop_items si ON ui.item_id = si.id
      WHERE ui.user_id = ?
      ORDER BY si.name
    `, [userId]);
    
    res.json(inventory);
  } catch (error) {
    console.error('Error getting inventory:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/shop
 * Achat d'un item en boutique
 * Body: { userId, itemName, quantity }
 */
router.post('/shop', async (req, res) => {
  try {
    const { userId, itemName, quantity = 1 } = req.body;
    
    if (!userId || !itemName) {
      return res.status(400).json({ error: 'Missing userId or itemName' });
    }
    
    // Obtenir l'item
    const item = await queryOne('SELECT * FROM shop_items WHERE name = ?', [itemName]);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Calculer le prix total
    const totalPrice = item.price * quantity;
    
    // Vérifier le solde
    const userCoins = await getCoins(userId);
    
    if (userCoins < totalPrice) {
      return res.status(400).json({ 
        error: 'Insufficient coins',
        required: totalPrice,
        available: userCoins
      });
    }
    
    // Déduire les coins
    await deductCoins(userId, totalPrice);
    
    // Ajouter à l'inventaire
    const existingItem = await queryOne(
      'SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?',
      [userId, item.id]
    );
    
    if (existingItem) {
      // Mettre à jour la quantité
      await query(
        'UPDATE user_inventory SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?',
        [quantity, userId, item.id]
      );
    } else {
      // Créer une nouvelle entrée
      await query(
        'INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, ?)',
        [userId, item.id, quantity]
      );
    }
    
    res.json({
      success: true,
      item: {
        name: item.name,
        quantity: quantity,
        totalPrice
      },
      newBalance: await getCoins(userId)
    });
  } catch (error) {
    console.error('Error purchasing item:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/shop/items
 * Liste tous les items disponibles en boutique
 */
router.get('/shop/items', async (req, res) => {
  try {
    const items = await query('SELECT * FROM shop_items ORDER BY price');
    res.json(items);
  } catch (error) {
    console.error('Error getting shop items:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/event/active
 * Obtient l'événement actif
 */
router.get('/event/active', async (req, res) => {
  try {
    const event = await getActiveEvent();
    
    if (!event) {
      return res.json({ event: null });
    }
    
    const voteStats = await getVoteStats(event.id);
    
    res.json({
      event: {
        ...event,
        voteStats
      }
    });
  } catch (error) {
    console.error('Error getting active event:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/pokemon/:id
 * Obtient les informations d'un Pokémon
 */
router.get('/pokemon/:id', async (req, res) => {
  try {
    const pokemonId = parseInt(req.params.id);
    const pokemon = await queryOne('SELECT * FROM pokemons WHERE id = ?', [pokemonId]);
    
    if (!pokemon) {
      return res.status(404).json({ error: 'Pokemon not found' });
    }
    
    res.json(pokemon);
  } catch (error) {
    console.error('Error getting pokemon:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/pokemon
 * Liste tous les Pokémon disponibles
 */
router.get('/pokemon', async (req, res) => {
  try {
    const { rarity } = req.query;
    
    let queryStr = 'SELECT * FROM pokemons';
    let params = [];
    
    if (rarity) {
      queryStr += ' WHERE rarity = ?';
      params.push(rarity);
    }
    
    queryStr += ' ORDER BY pokedex_id';
    
    const pokemons = await query(queryStr, params);
    res.json(pokemons);
  } catch (error) {
    console.error('Error getting pokemons:', error);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    
    // Si c'est une erreur d'authentification, donner plus de détails
    if (error.code === '28P01' || error.message.includes('password authentication failed')) {
      return res.status(500).json({ 
        error: 'Database authentication failed. Please check your DATABASE_URL in .env file.',
        hint: 'Verify username and password in DATABASE_URL format: postgresql://user:password@host:port/database'
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/spawn
 * Spawn un nouveau Pokémon (pour tests)
 */
router.post('/spawn', async (req, res) => {
  try {
    const { level } = req.body;
    
    const event = await spawnPokemon(level || null);
    
    // Diffuser l'événement via Socket.io
    if (io) {
      await broadcastSpawn(io, event);
    }
    
    res.json({
      success: true,
      message: `Un ${event.pokemon.name} sauvage est apparu!`,
      event: {
        id: event.id,
        pokemon: event.pokemon,
        level: event.level,
        voteDuration: event.voteDuration
      }
    });
  } catch (error) {
    console.error('Error spawning pokemon:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * GET /api/auto-spawn/status
 * Obtient le statut du spawn automatique
 */
router.get('/auto-spawn/status', (req, res) => {
  const config = getAutoSpawnConfig();
  res.json({
    enabled: isAutoSpawnActive(),
    minMinutes: config?.minMinutes || null,
    maxMinutes: config?.maxMinutes || null,
    interval: config ? `${config.minMinutes}-${config.maxMinutes} minutes (random)` : null
  });
});

/**
 * POST /api/auto-spawn/start
 * Démarre le spawn automatique
 */
router.post('/auto-spawn/start', (req, res) => {
  const { minMinutes, maxMinutes } = req.body;
  const min = minMinutes || parseInt(process.env.AUTO_SPAWN_MIN_MINUTES) || 5;
  const max = maxMinutes || parseInt(process.env.AUTO_SPAWN_MAX_MINUTES) || 15;
  
  startAutoSpawn(min, max);
  
  res.json({
    success: true,
    message: `Auto-spawn started (random interval: ${min}-${max} minutes)`,
    minMinutes: min,
    maxMinutes: max
  });
});

/**
 * POST /api/auto-spawn/stop
 * Arrête le spawn automatique
 */
router.post('/auto-spawn/stop', (req, res) => {
  stopAutoSpawn();
  
  res.json({
    success: true,
    message: 'Auto-spawn stopped'
  });
});

export default router;
