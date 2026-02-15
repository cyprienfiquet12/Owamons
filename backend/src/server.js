import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, initializeSchema } from './database/connection.js';
import { setupWebSocketHandlers } from './websocket/handlers.js';
import apiRoutes from './routes/api.js';
import streamelementsRoutes from './integrations/streamelements.js';
import wizebotRoutes from './integrations/wizebot.js';
import { connectTwitchChat } from './integrations/twitchChat.js';
import { startAutoSpawn } from './services/autoSpawnService.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../../frontend/overlay')));
// Servir les assets (sprites de balls, etc.)
app.use('/assets', express.static(join(__dirname, '../../frontend/assets')));

// API Routes
app.use('/api', apiRoutes);

// StreamElements Webhook
app.use('/', streamelementsRoutes);

// Wizebot Webhook
app.use('/', wizebotRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io connection handler
io.on('connection', (socket) => {
  setupWebSocketHandlers(socket, io);
});

// Variable pour tracker l'état de la base de données
let dbReady = false;

// Middleware pour vérifier que la DB est prête
app.use('/api', (req, res, next) => {
  if (!dbReady) {
    return res.status(503).json({ 
      error: 'Database not ready yet. Please wait a moment and try again.' 
    });
  }
  next();
});

// Initialize database and start server (async)
async function startServer() {
  try {
    // Initialize database
    await initDatabase();
    
    // Initialize schema only if tables don't exist
    // This prevents errors on restart
    try {
      await initializeSchema();
    } catch (error) {
      // Schema might already exist, which is fine
    }

    // Marquer la DB comme prête
    dbReady = true;
    console.log('✅ Database ready');

    // Connecter au chat Twitch (si configuré)
    if (process.env.TWITCH_ACCESS_TOKEN && process.env.TWITCH_CHANNEL) {
      await connectTwitchChat();
    }

    // Démarrer le spawn automatique (si activé)
    const autoSpawnEnabled = process.env.AUTO_SPAWN_ENABLED !== 'false'; // Activé par défaut
    const minMinutes = parseInt(process.env.AUTO_SPAWN_MIN_MINUTES) || 5; // 5 minutes minimum par défaut
    const maxMinutes = parseInt(process.env.AUTO_SPAWN_MAX_MINUTES) || 15; // 15 minutes maximum par défaut

    if (autoSpawnEnabled) {
      startAutoSpawn(minMinutes, maxMinutes);
    }

    // Démarrer le spawn automatique d'arène (si activé)
    const { startAutoArenaSpawn } = await import('./services/autoArenaService.js');
    const autoArenaSpawnEnabled = process.env.AUTO_ARENA_SPAWN_ENABLED !== 'false'; // Activé par défaut
    const arenaMinMinutes = parseInt(process.env.AUTO_ARENA_SPAWN_MIN_MINUTES) || 45; // 45 minutes minimum par défaut
    const arenaMaxMinutes = parseInt(process.env.AUTO_ARENA_SPAWN_MAX_MINUTES) || 180; // 180 minutes (3h) maximum par défaut

    if (autoArenaSpawnEnabled) {
      startAutoArenaSpawn(arenaMinMinutes, arenaMaxMinutes);
    }

    // Démarrer le nettoyage périodique des événements expirés (pour envoyer les messages chat)
    const { cleanupExpiredEvents } = await import('./services/spawnService.js');
    setInterval(async () => {
      await cleanupExpiredEvents();
    }, 5000); // 5 secondes

    // Démarrer la vérification des timeouts de sélection
    const { checkSelectionTimeouts } = await import('./services/selectionTimeoutService.js');
    setInterval(async () => {
      await checkSelectionTimeouts();
    }, 10000); // 10 secondes

    // Start server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Socket.io ready for connections`);
    });
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

startServer();

export { app, io };
