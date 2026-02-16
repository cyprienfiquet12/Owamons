// Configuration
console.log('[Overlay] app.js chargé — URL:', window.location.href);
const SOCKET_URL = window.location.origin;
const socket = io(SOCKET_URL);

// État de l'application
let currentEvent = null;
let timerInterval = null;

// Éléments DOM
const eventDisplay = document.getElementById('event-display');
const pokemonSpawn = document.getElementById('pokemon-spawn');
const pokemonName = document.getElementById('pokemon-name');
const pokemonSprite = document.getElementById('pokemon-sprite');
const pokemonLevel = document.getElementById('pokemon-level');
const pokemonHP = document.getElementById('pokemon-hp');
const pokemonTypes = document.getElementById('pokemon-types');
const rarityBadge = document.getElementById('rarity-badge');
const timerProgress = document.getElementById('timer-progress');
const timerText = document.getElementById('timer-text');
const voteCapture = document.getElementById('vote-capture');
const voteBattle = document.getElementById('vote-battle');
const voteFlee = document.getElementById('vote-flee');
const captureResult = document.getElementById('capture-result');
const resultCard = document.getElementById('result-card');
const resultIcon = document.getElementById('result-icon');
const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');

// Modes d'affichage
const spawnMode = document.getElementById('spawn-mode');
const captureMode = document.getElementById('capture-mode');
const battleMode = document.getElementById('battle-mode');
const resultMode = document.getElementById('result-mode');

// Éléments capture
const captureViewerName = document.getElementById('capture-viewer-name');
const captureBallSprite = document.getElementById('capture-ball-sprite');
const capturePokemonSprite = document.getElementById('capture-pokemon-sprite');
const captureResultMessage = document.getElementById('capture-result-message');

// Éléments combat
const battleUserPokemonName = document.getElementById('battle-user-pokemon-name');
const battleUserPokemonSprite = document.getElementById('battle-user-pokemon-sprite');
const battleUserHpFill = document.getElementById('battle-user-hp-fill');
const battleUserHpText = document.getElementById('battle-user-hp-text');
const battleUserLevel = document.getElementById('battle-user-level');
const battleWildPokemonName = document.getElementById('battle-wild-pokemon-name');
const battleWildPokemonSprite = document.getElementById('battle-wild-pokemon-sprite');
const battleWildHpFill = document.getElementById('battle-wild-hp-fill');
const battleWildHpText = document.getElementById('battle-wild-hp-text');
const battleWildLevel = document.getElementById('battle-wild-level');
const battleLog = document.getElementById('battle-log');

// Éléments résultat
const resultIconLarge = document.getElementById('result-icon-large');
const resultTitleLarge = document.getElementById('result-title-large');
const resultMessageLarge = document.getElementById('result-message-large');

// Vérifier que tous les éléments DOM existent

// Couleurs par rareté
const RARITY_COLORS = {
  COMMON: { class: 'common', label: 'Commun' },
  RARE: { class: 'rare', label: 'Rare' },
  EPIC: { class: 'epic', label: 'Épique' },
  LEGENDARY: { class: 'legendary', label: 'Légendaire' }
};

// Plage des numéros Pokédex pour le fallback (cri aléatoire si fichier absent)
const POKEDEX_CRY_MIN = 1;
const POKEDEX_CRY_MAX = 1025;

/**
 * Joue un cri aléatoire (fallback quand le fichier du Pokémon n'existe pas)
 * @param {number} excludeId - Numéro à exclure du tirage
 */
function playRandomCryFallback(excludeId) {
  let id = excludeId;
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    id = POKEDEX_CRY_MIN + Math.floor(Math.random() * (POKEDEX_CRY_MAX - POKEDEX_CRY_MIN + 1));
    if (id !== excludeId) break;
  }
  const base = window.location.origin;
  const url = `${base}/assets/pokemon/cries/${id}.ogg`;
  const audio = new Audio(url);
  audio.volume = 0.7;
  audio.onerror = () => {}; // Éviter boucle si le fallback échoue aussi
  audio.play().catch(() => {});
}

/**
 * Joue le son par défaut pour un combat d'arène (/assets/pokemon/default.mp3)
 */
function playArenaDefaultSound() {
  const base = window.location.origin;
  const audio = new Audio(`${base}/assets/pokemon/default.mp3`);
  audio.volume = 0.5;
  audio.play().catch(() => {});
}

/**
 * Joue le cri du Pokémon à l'apparition (fichiers dans /assets/pokemon/cries/{pokedex_id}.ogg).
 * Si le fichier n'existe pas, joue un cri aléatoire.
 * @param {number} pokedexId - Numéro Pokédex du Pokémon
 */
function playPokemonCry(pokedexId) {
  console.log('[Cri Pokémon] playPokemonCry appelé', { pokedexId, type: typeof pokedexId });
  if (pokedexId == null || pokedexId === undefined) {
    console.warn('[Cri Pokémon] pokedex_id manquant, cri ignoré', { pokedexId });
    return;
  }
  const base = window.location.origin;
  const url = `${base}/assets/pokemon/cries/${pokedexId}.ogg`;
  console.log('[Cri Pokémon] Création Audio', { url, origin: base });
  const audio = new Audio(url);
  audio.volume = 0.7;
  let fallbackPlayed = false;
  function tryFallback() {
    if (fallbackPlayed) return;
    fallbackPlayed = true;
    console.warn('[Cri Pokémon] Fichier absent ou erreur, lecture d’un cri aléatoire', url);
    playRandomCryFallback(pokedexId);
  }

  audio.addEventListener('loadstart', () => console.log('[Cri Pokémon] loadstart', url));
  audio.addEventListener('canplay', () => console.log('[Cri Pokémon] canplay', url));
  audio.addEventListener('canplaythrough', () => console.log('[Cri Pokémon] canplaythrough', url));
  audio.addEventListener('playing', () => console.log('[Cri Pokémon] playing (lecture en cours)', url));
  audio.addEventListener('ended', () => console.log('[Cri Pokémon] ended (lecture terminée)', url));
  audio.addEventListener('error', tryFallback);

  audio.play()
    .then(() => console.log('[Cri Pokémon] play() résolu (lecture démarrée)', url))
    .catch((e) => {
      console.warn('[Cri Pokémon] play() rejeté', url, { name: e?.name, message: e?.message });
      tryFallback();
    });
}

// Connexion Socket.io
socket.on('connect', () => {
  socket.emit('get_active_event');
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket.io connection error:', error);
});

socket.on('disconnect', () => {
  // Disconnected from server
});

// Événements Socket.io
socket.on('pokemon_spawn', (data) => {
  // Vérifier que expires_at est présent
  if (!data.expires_at) {
    console.error('❌ Missing expires_at in event data!');
    return;
  }

  // Sauvegarder currentEvent avant resetDisplay pour ne pas le perdre
  const eventData = data;

  displayPokemonSpawn(data);
  
  // Définir currentEvent APRÈS resetDisplay pour qu'il soit disponible pour le timer
  currentEvent = eventData;
  
  startTimer(data);
});

socket.on('arena_spawn', (data) => {
  // Vérifier que expires_at est présent
  if (!data.expires_at) {
    console.error('❌ Missing expires_at in event data!');
    return;
  }
  
  // Sauvegarder currentEvent avant resetDisplay pour ne pas le perdre
  const eventData = data;
  
  displayArenaSpawn(data);
  
  // Définir currentEvent APRÈS resetDisplay pour qu'il soit disponible pour le timer
  currentEvent = eventData;
  
  startTimer(data);
});

socket.on('no_active_event', () => {
  hideEventDisplay();
});

socket.on('vote_update', (data) => {
  updateVoteStats(data.voteStats);
});

// Événement indiquant que les votes sont en cours de traitement
socket.on('votes_processing', (data) => {
  // Les votes sont en cours de traitement, la popup va s'adapter
  // Ne pas cacher la popup, juste désactiver visuellement la section vote
  if (spawnMode) {
    const voteSection = spawnMode.querySelector('.vote-section');
    if (voteSection) {
      voteSection.style.opacity = '0.5';
      voteSection.style.pointerEvents = 'none';
    }
  }
});

// Événement de sélection de ball pour la capture
socket.on('ball_selection', (data) => {
  switchToBallSelectionMode(data);
});

// Événement de tentative de capture (affiche le viewer et la ball)
socket.on('capture_attempt', (data) => {
  animateCaptureAttempt(data);
});

socket.on('capture_success', (data) => {
  showCaptureResultInMode(true, data);
  setTimeout(() => {
    fadeOutEventDisplay();
  }, 5000); // 5 secondes après l'affichage du résultat avant le fade-out
});

socket.on('capture_fail', (data) => {
  showCaptureResultInMode(false, data);
  setTimeout(() => {
    fadeOutEventDisplay();
  }, 5000); // 5 secondes après l'affichage du résultat avant le fade-out
});

// Événement de sélection de pokémon pour le combat
socket.on('battle_selection', (data) => {
  // Le combat commence, on passe en mode combat
  switchToBattleMode(data);
});

// Événement de résultat de combat (avec animation)
socket.on('battle_result', (data) => {
  animateBattleResult(data);
});

// ========== HANDLERS POUR LES COMBATS D'ARÈNE ==========

// Événement de début de combat d'arène
socket.on('arena_battle_start', (data) => {
  // Passer en mode combat
  switchToBattleMode({
    userPokemon: null, // Sera mis à jour au premier round
    wildPokemon: null  // Sera mis à jour au premier round
  });
});

// Événement de round de combat d'arène
socket.on('arena_battle_round', (data) => {
  // Mettre à jour les Pokémon affichés
  if (data.userPokemon) {
    if (battleUserPokemonName) battleUserPokemonName.textContent = data.userPokemon.name;
    if (battleUserPokemonSprite && data.userPokemon.sprite_url) {
      battleUserPokemonSprite.src = data.userPokemon.sprite_url;
      battleUserPokemonSprite.style.display = 'block';
    }
    if (battleUserLevel) battleUserLevel.textContent = `Niv. ${data.userPokemon.level}`;
    
    const userMaxHP = data.userPokemon.max_hp;
    const userCurrentHP = data.userPokemon.current_hp;
    if (battleUserHpText) battleUserHpText.textContent = `${userCurrentHP}/${userMaxHP}`;
    if (battleUserHpFill) {
      battleUserHpFill.style.width = `${(userCurrentHP / userMaxHP) * 100}%`;
      const hpPercent = (userCurrentHP / userMaxHP) * 100;
      battleUserHpFill.classList.remove('low', 'medium');
      if (hpPercent <= 25) {
        battleUserHpFill.classList.add('low');
      } else if (hpPercent <= 50) {
        battleUserHpFill.classList.add('medium');
      }
    }
  }
  
  if (data.arenaPokemon) {
    if (battleWildPokemonName) battleWildPokemonName.textContent = data.arenaPokemon.name;
    if (battleWildPokemonSprite && data.arenaPokemon.sprite_url) {
      battleWildPokemonSprite.src = data.arenaPokemon.sprite_url;
      battleWildPokemonSprite.style.display = 'block';
    }
    if (battleWildLevel) battleWildLevel.textContent = `Niv. ${data.arenaPokemon.level}`;
    
    const wildMaxHP = data.arenaPokemon.max_hp;
    const wildCurrentHP = data.arenaPokemon.current_hp;
    if (battleWildHpText) battleWildHpText.textContent = `${wildCurrentHP}/${wildMaxHP}`;
    if (battleWildHpFill) {
      battleWildHpFill.style.width = `${(wildCurrentHP / wildMaxHP) * 100}%`;
      const hpPercent = (wildCurrentHP / wildMaxHP) * 100;
      battleWildHpFill.classList.remove('low', 'medium');
      if (hpPercent <= 25) {
        battleWildHpFill.classList.add('low');
      } else if (hpPercent <= 50) {
        battleWildHpFill.classList.add('medium');
      }
    }
  }
  
  // Ajouter un log dans le battle log
  if (battleLog) {
    const logEntry = document.createElement('p');
    logEntry.textContent = `Round ${data.round}: ${data.userPokemon?.name || '?'} vs ${data.arenaPokemon?.name || '?'}`;
    battleLog.appendChild(logEntry);
    battleLog.scrollTop = battleLog.scrollHeight;
  }
});

// Événement de résultat d'un round de combat d'arène
socket.on('arena_battle_round_result', (data) => {
  // Animer la barre de HP du perdant
  const isUserLoser = data.loserPokemon === 'user';
  const loserHpBar = isUserLoser ? battleUserHpFill : battleWildHpFill;
  const loserHpText = isUserLoser ? battleUserHpText : battleWildHpText;
  
  if (loserHpBar && loserHpText) {
    const maxHP = isUserLoser ? data.userPokemon.max_hp : data.arenaPokemon.max_hp;
    const finalHP = 0; // Le perdant tombe à 0
    
    // Animer la descente de la barre
    loserHpBar.style.transition = 'width 1.5s ease-out';
    loserHpBar.classList.add('low');
    loserHpBar.style.width = '0%';
    
    // Animer le texte
    const startHP = isUserLoser ? data.userPokemon.current_hp : data.arenaPokemon.current_hp;
    const startTime = Date.now();
    const duration = 1500;
    
    const animateHP = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const hpValue = Math.max(0, Math.floor(startHP * (1 - progress)));
      loserHpText.textContent = `${hpValue}/${maxHP}`;
      
      if (progress < 1) {
        requestAnimationFrame(animateHP);
      } else {
        loserHpText.textContent = `0/${maxHP}`;
      }
    };
    animateHP();
  }
  
  // Mettre à jour le log
  if (battleLog) {
    const logEntry = document.createElement('p');
    const winner = data.userWon ? data.userPokemon.name : data.arenaPokemon.name;
    const loser = data.userWon ? data.arenaPokemon.name : data.userPokemon.name;
    logEntry.textContent = `${winner} gagne ! ${loser} est KO.`;
    logEntry.style.color = data.userWon ? '#4CAF50' : '#F44336';
    battleLog.appendChild(logEntry);
    battleLog.scrollTop = battleLog.scrollHeight;
  }
});

// Événement de résultat final du combat d'arène
socket.on('arena_battle_result', (data) => {
  // Afficher le résultat final
  setTimeout(() => {
    switchToResultMode(data.victory, {
      username: data.username,
      badgeEarned: data.badgeEarned || false
    });
    
    // Fade-out après 20 secondes
    setTimeout(() => {
      fadeOutEventDisplay();
    }, 20000);
  }, 2000); // Attendre 2 secondes après le dernier round
});

// Garder les anciens handlers pour compatibilité (mais ils ne devraient plus être utilisés)
socket.on('battle_victory', (data) => {
  animateBattleResult({ ...data, victory: true, loserPokemon: 'wild', userPokemonHP: 100, wildPokemonHP: 0 });
});

socket.on('battle_defeat', (data) => {
  animateBattleResult({ ...data, victory: false, loserPokemon: 'user', userPokemonHP: 0, wildPokemonHP: 100 });
});

// Événement de fuite
socket.on('flee_result', (data) => {
  // La fuite fait disparaître le pokémon, on cache la popup
  setTimeout(() => {
    fadeOutEventDisplay();
  }, 2000); // 2 secondes avant le fade-out
});

// Événement indiquant qu'il n'y a pas de vote gagnant
socket.on('no_vote_winner', (data) => {
  // Aucun vote gagnant, cacher la popup après un court délai
  setTimeout(() => {
    fadeOutEventDisplay();
  }, 2000); // 2 secondes avant le fade-out
});

// Événement de demande de remplacement (équipe pleine)
socket.on('team_full_replacement', (data) => {
  showTeamReplacement(data);
});

socket.on('battle_end', (data) => {
  showBattleResult(data);
});

socket.on('badge_unlock', (data) => {
  showBadgeUnlock(data);
});

socket.on('error', (data) => {
  console.error('Socket error:', data);
});

// Fonctions d'affichage

/**
 * Réinitialise complètement l'affichage pour éviter les données résiduelles
 */
function resetDisplay() {
  
  // Arrêter tous les timers
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Réinitialiser les votes
  if (voteCapture) voteCapture.textContent = '0';
  if (voteBattle) voteBattle.textContent = '0';
  if (voteFlee) voteFlee.textContent = '0';
  
  // Réinitialiser le timer
  if (timerProgress) {
    timerProgress.style.width = '100%';
    timerProgress.classList.remove('legendary');
  }
  if (timerText) timerText.textContent = '1m30';
  
  // Réinitialiser les sprites
  if (pokemonSprite) {
    pokemonSprite.src = '';
    pokemonSprite.style.display = 'none';
    // Supprimer tout fallback qui pourrait exister
    const fallback = pokemonSprite.parentNode?.querySelector('.pokemon-sprite-fallback');
    if (fallback) {
      fallback.remove();
    }
  }
  
  // Réinitialiser les informations du pokémon
  if (pokemonName) pokemonName.textContent = '';
  if (pokemonLevel) pokemonLevel.textContent = '';
  if (pokemonHP) pokemonHP.textContent = '';
  if (pokemonTypes) pokemonTypes.innerHTML = '';
  if (rarityBadge) {
    rarityBadge.textContent = '';
    rarityBadge.className = 'rarity-badge';
  }
  
  // Réinitialiser les modes
  if (spawnMode) {
    spawnMode.classList.remove('hidden');
    // Réinitialiser l'opacité de la section vote
    const voteSection = spawnMode.querySelector('.vote-section');
    if (voteSection) {
      voteSection.style.opacity = '1';
      voteSection.style.pointerEvents = 'auto';
    }
  }
  if (captureMode) {
    captureMode.classList.add('hidden');
    if (captureViewerName) captureViewerName.textContent = '';
    if (captureBallSprite) {
      captureBallSprite.src = '';
      captureBallSprite.style.display = 'none';
    }
    if (capturePokemonSprite) {
      capturePokemonSprite.src = '';
      capturePokemonSprite.style.display = 'none';
    }
    if (captureResultMessage) {
      captureResultMessage.textContent = '';
      captureResultMessage.className = 'result-message';
    }
  }
  if (battleMode) {
    battleMode.classList.add('hidden');
    // Réinitialiser les pokémon de combat
    if (battleUserPokemonName) battleUserPokemonName.textContent = '';
    if (battleUserPokemonSprite) {
      battleUserPokemonSprite.src = '';
      battleUserPokemonSprite.style.display = 'none';
    }
    if (battleUserHpText) battleUserHpText.textContent = '';
    if (battleUserHpFill) {
      battleUserHpFill.style.width = '100%';
      battleUserHpFill.classList.remove('low', 'medium');
      battleUserHpFill.style.transition = '';
    }
    if (battleUserLevel) battleUserLevel.textContent = '';
    if (battleWildPokemonName) battleWildPokemonName.textContent = '';
    if (battleWildPokemonSprite) {
      battleWildPokemonSprite.src = '';
      battleWildPokemonSprite.style.display = 'none';
    }
    if (battleWildHpText) battleWildHpText.textContent = '';
    if (battleWildHpFill) {
      battleWildHpFill.style.width = '100%';
      battleWildHpFill.classList.remove('low', 'medium');
      battleWildHpFill.style.transition = '';
    }
    if (battleWildLevel) battleWildLevel.textContent = '';
    if (battleLog) battleLog.innerHTML = '';
  }
  if (resultMode) {
    resultMode.classList.add('hidden');
    const resultHeader = document.querySelector('#result-mode .result-header');
    if (resultHeader) {
      resultHeader.classList.remove('victory', 'defeat');
    }
    if (resultIconLarge) resultIconLarge.textContent = '';
    if (resultTitleLarge) resultTitleLarge.textContent = '';
    if (resultMessageLarge) {
      resultMessageLarge.innerHTML = '';
      resultMessageLarge.classList.remove('victory', 'defeat');
    }
  }
  
  // Ne pas réinitialiser currentEvent ici
  // currentEvent sera réinitialisé uniquement quand la popup est cachée
  // (dans hideEventDisplay ou fadeOutEventDisplay)
}

function displayArenaSpawn(event) {
  // Réinitialiser l'affichage avant d'afficher le nouveau spawn
  resetDisplay();
  
  const arena = event.arena;
  
  // Vérifier que les éléments DOM existent
  if (!eventDisplay) {
    console.error('❌ eventDisplay element not found!');
    return;
  }
  if (!pokemonSpawn) {
    console.error('❌ pokemonSpawn element not found!');
    return;
  }

  // Jouer le son d'arène par défaut
  playArenaDefaultSound();

  // Afficher le nom avec le sprite du badge si disponible
  if (arena.badge && arena.badge.sprite_url) {
    // Créer un conteneur pour le nom avec le badge
    pokemonName.innerHTML = '';
    const badgeImg = document.createElement('img');
    badgeImg.src = arena.badge.sprite_url;
    badgeImg.alt = arena.badge.name || 'Badge';
    badgeImg.className = 'arena-badge-icon';
    badgeImg.style.width = '24px';
    badgeImg.style.height = '24px';
    badgeImg.style.verticalAlign = 'middle';
    badgeImg.style.marginRight = '8px';
    badgeImg.style.display = 'inline-block';
    
    badgeImg.onerror = function() {
      console.error('Failed to load badge sprite:', arena.badge.sprite_url);
      pokemonName.textContent = `${arena.name} défie les dresseurs!`;
    };
    
    badgeImg.onload = function() {
      // Badge sprite loaded
    };
    
    pokemonName.appendChild(badgeImg);
    const nameText = document.createTextNode(`${arena.name} défie les dresseurs!`);
    pokemonName.appendChild(nameText);
  } else {
    pokemonName.textContent = `${arena.name} défie les dresseurs!`;
  }
  
  // Gérer le sprite du champion
  if (arena.sprite_url) {
    pokemonSprite.src = arena.sprite_url;
    pokemonSprite.alt = arena.name;
    
    pokemonSprite.onerror = function() {
      console.error('Failed to load arena sprite:', arena.sprite_url);
      pokemonSprite.style.display = 'none';
    };
    
    pokemonSprite.onload = function() {
      pokemonSprite.style.display = 'block';
    };
  } else {
    console.warn('No sprite_url for arena:', arena.name);
    pokemonSprite.style.display = 'none';
  }
  
  // Afficher le type de l'arène au lieu du niveau
  if (pokemonLevel) {
    pokemonLevel.textContent = `Type: ${arena.type}`;
  }
  
  // Afficher le nombre de Pokémon dans l'équipe au lieu des HP
  if (pokemonHP) {
    pokemonHP.textContent = `Équipe: ${arena.team?.length || 0} Pokémon`;
  }
  
  // Afficher le type de l'arène avec sprite
  if (pokemonTypes) {
    pokemonTypes.innerHTML = '';
    
    if (arena.type_sprite_url) {
      const typeElement = document.createElement('div');
      typeElement.className = 'type-badge';
      
      const typeImg = document.createElement('img');
      typeImg.src = arena.type_sprite_url;
      typeImg.alt = arena.type;
      typeImg.className = 'type-sprite';
      typeImg.title = arena.type;
      
      typeImg.onerror = function() {
        console.error(`❌ Failed to load type sprite: ${arena.type_sprite_url} for type ${arena.type}`);
        typeImg.style.display = 'none';
      };
      
      typeImg.onload = function() {
        // Type sprite loaded
      };
      
      typeElement.appendChild(typeImg);
      pokemonTypes.appendChild(typeElement);
    } else {
      // Fallback : afficher juste le nom du type
      const typeElement = document.createElement('div');
      typeElement.className = 'type-badge';
      typeElement.textContent = arena.type;
      pokemonTypes.appendChild(typeElement);
    }
  }
  
  // Afficher le badge de l'arène au lieu du badge de rareté
  if (rarityBadge) {
    rarityBadge.innerHTML = ''; // Vider le contenu
    rarityBadge.className = 'rarity-badge arena';
    
    if (arena.badge && arena.badge.sprite_url) {
      const badgeImg = document.createElement('img');
      badgeImg.src = arena.badge.sprite_url;
      badgeImg.alt = arena.badge.name || 'Badge Arène';
      badgeImg.className = 'arena-badge-sprite';
      badgeImg.style.width = '100%';
      badgeImg.style.height = '100%';
      badgeImg.style.objectFit = 'contain';
      
      badgeImg.onerror = function() {
        console.error('Failed to load badge sprite:', arena.badge.sprite_url);
        rarityBadge.textContent = 'Arène';
      };
      
      badgeImg.onload = function() {
        // Badge sprite loaded
      };
      
      rarityBadge.appendChild(badgeImg);
    } else {
      rarityBadge.textContent = 'Arène';
    }
  }
  
  // Masquer le vote "capture" pour les arènes
  const captureVoteElement = voteCapture?.parentElement;
  if (captureVoteElement) {
    captureVoteElement.style.display = 'none';
  }
  
  // Stats de vote (seulement combat et fuite)
  if (event.voteStats) {
    updateVoteStats(event.voteStats);
  }
  
  // Afficher les éléments et passer en mode spawn
  eventDisplay.classList.remove('hidden');
  pokemonSpawn.classList.remove('hidden');
  switchToSpawnMode();
  
  // Forcer l'affichage au cas où
  eventDisplay.style.display = 'block';
  pokemonSpawn.style.display = 'block';
}

function displayPokemonSpawn(event) {
  // Réinitialiser l'affichage avant d'afficher le nouveau spawn
  resetDisplay();
  
  const pokemon = event.pokemon;
  
  // Vérifier que les éléments DOM existent
  if (!eventDisplay) {
    console.error('❌ eventDisplay element not found!');
    return;
  }
  if (!pokemonSpawn) {
    console.error('❌ pokemonSpawn element not found!');
    return;
  }

  // Jouer le cri du Pokémon à l'apparition
  playPokemonCry(pokemon.pokedex_id);

  pokemonName.textContent = `Un ${pokemon.name} sauvage apparaît!`;
  
  // Réafficher le vote "capture" pour les spawns normaux
  const captureVoteElement = voteCapture?.parentElement;
  if (captureVoteElement) {
    captureVoteElement.style.display = '';
  }
  
  // Gérer le sprite avec fallback
  if (pokemon.sprite_url) {
    pokemonSprite.src = pokemon.sprite_url;
    pokemonSprite.alt = pokemon.name;
    
    // Gestion des erreurs de chargement d'image
    pokemonSprite.onerror = function() {
      console.error('Failed to load sprite:', pokemon.sprite_url);
      // Cacher le sprite en cas d'erreur
      pokemonSprite.style.display = 'none';
    };
    
    pokemonSprite.onload = function() {
      pokemonSprite.style.display = 'block';
    };
  } else {
    console.warn('No sprite_url for Pokémon:', pokemon.name);
    pokemonSprite.style.display = 'none';
  }
  
  pokemonLevel.textContent = event.level;
  pokemonHP.textContent = `${event.current_hp}/${Math.floor(pokemon.base_hp * (1 + (event.level - 1) * 0.1))}`;
  
  // Types avec sprites uniquement (pas de texte)
  if (pokemonTypes) {
    pokemonTypes.innerHTML = ''; // Vider le contenu
    
    if (pokemon.types && Array.isArray(pokemon.types) && pokemon.types.length > 0) {
      // Utiliser les types depuis la table types (avec sprites uniquement)
      pokemon.types.forEach((type) => {
        // Ne créer un élément que si le sprite est disponible
        if (type.sprite_url) {
          const typeElement = document.createElement('div');
          typeElement.className = 'type-badge';
          
          const typeImg = document.createElement('img');
          typeImg.src = type.sprite_url;
          typeImg.alt = type.name;
          typeImg.className = 'type-sprite';
          typeImg.title = type.name;
          
          // Gestion des erreurs de chargement
          typeImg.onerror = function() {
            console.error(`❌ Failed to load type sprite: ${type.sprite_url} for type ${type.name}`);
            typeImg.style.display = 'none';
          };
          
          typeImg.onload = function() {
            // Type sprite loaded
          };
          
          typeElement.appendChild(typeImg);
          pokemonTypes.appendChild(typeElement);
        } else {
          console.warn(`⚠️ Type ${type.name} has no sprite_url`);
        }
      });
    } else {
      console.warn('⚠️ No types available for pokemon:', pokemon.name);
    }
    // Si pas de types ou pas de sprites, ne rien afficher (pas de fallback texte)
  }
  
  // Rareté
  const rarity = RARITY_COLORS[pokemon.rarity] || RARITY_COLORS.COMMON;
  rarityBadge.textContent = rarity.label;
  rarityBadge.className = `rarity-badge ${rarity.class}`;
  
  // Stats de vote
  if (event.voteStats) {
    updateVoteStats(event.voteStats);
  }
  
  // Afficher les éléments et passer en mode spawn
  eventDisplay.classList.remove('hidden');
  pokemonSpawn.classList.remove('hidden');
  switchToSpawnMode();
  
  // Forcer l'affichage au cas où
  eventDisplay.style.display = 'block';
  pokemonSpawn.style.display = 'block';
}

function updateVoteStats(stats) {
  voteCapture.textContent = stats.capture || 0;
  voteBattle.textContent = stats.battle || 0;
  voteFlee.textContent = stats.flee || 0;
}

function startTimer(event) {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  let expiresAt = new Date(event.expires_at);
  const now = new Date();
  
  // Vérifier si la date est valide
  if (isNaN(expiresAt.getTime())) {
    console.error('❌ Invalid expires_at date:', event.expires_at);
    return;
  }
  
  // Déterminer la durée du timer selon le type d'événement AVANT de calculer initialSeconds
  let isLegendary = false;
  const VOTE_DURATION_SECONDS = 90; // 1m30 pour spawn sauvage et arène
  let total = VOTE_DURATION_SECONDS;
  
  if (event.type === 'arena') {
    total = VOTE_DURATION_SECONDS;
    timerProgress.classList.remove('legendary');
  } else if (event.pokemon) {
    isLegendary = event.pokemon.rarity === 'LEGENDARY';
    total = VOTE_DURATION_SECONDS;
    
    if (isLegendary) {
      timerProgress.classList.add('legendary');
    } else {
      timerProgress.classList.remove('legendary');
    }
  }
  
  // Vérifier si l'événement est déjà expiré
  const initialRemaining = expiresAt - now;
  let initialSeconds = Math.max(0, Math.floor(initialRemaining / 1000));
  
  // S'assurer que initialSeconds ne dépasse pas total (pour commencer à 100%)
  initialSeconds = Math.min(initialSeconds, total);
  
  if (initialSeconds <= 0) {
    // Forcer l'affichage même si expiré (problème de timezone possible)
    const forcedExpiresAt = new Date();
    forcedExpiresAt.setSeconds(forcedExpiresAt.getSeconds() + total);
    expiresAt = forcedExpiresAt;
    initialSeconds = total; // Forcer à la durée totale
  }
  
  // Fonction pour formater le temps restant (ex: 90 → "1m30", 45 → "45s")
  const formatTime = (secs) => {
    if (secs >= 60) {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return s > 0 ? `${m}m${s}` : `${m}m`;
    }
    return `${secs}s`;
  };
  
  // Mettre à jour immédiatement - le pourcentage devrait commencer à 100%
  const initialPercentage = (initialSeconds / total) * 100;
  timerProgress.style.width = `${Math.max(0, Math.min(100, initialPercentage))}%`;
  timerText.textContent = formatTime(initialSeconds);
  
  let updateCount = 0;
  timerInterval = setInterval(() => {
    updateCount++;
    const now = new Date();
    const remaining = Math.max(0, expiresAt - now);
    const seconds = Math.ceil(remaining / 1000);
    
    if (seconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      
      // Notifier le serveur que l'événement a expiré (pour le message chat)
      try {
        if (currentEvent && currentEvent.id) {
          const eventData = {
            eventId: currentEvent.id,
            pokemonName: currentEvent.pokemon?.name,
            arenaName: currentEvent.arena?.name,
            eventType: currentEvent.type
          };
          
          socket.emit('event_expired', eventData);
        } else {
          console.error('❌ Cannot emit event_expired: currentEvent is missing or has no id');
        }
      } catch (error) {
        console.error('❌ ERROR emitting event_expired:', error);
      }
      // Ne pas cacher la popup immédiatement, attendre que le backend traite les votes
      // La popup s'adaptera selon le vote gagnant (capture_attempt, battle_selection, etc.)
      // Cacher seulement la section vote/timer
      if (spawnMode) {
        const voteSection = spawnMode.querySelector('.vote-section');
        if (voteSection) {
          voteSection.style.opacity = '0.5';
          voteSection.style.pointerEvents = 'none';
        }
      }
      return;
    }
    
    // Utiliser la variable total définie dans la portée de startTimer
    const percentage = (seconds / total) * 100;
    
    timerProgress.style.width = `${percentage}%`;
    timerText.textContent = formatTime(seconds);
  }, 100);
}

function hideEventDisplay() {
  // Réinitialiser l'affichage avant de cacher
  resetDisplay();
  
  // Réinitialiser currentEvent après resetDisplay
  currentEvent = null;
  
  eventDisplay.classList.add('hidden');
}

/**
 * Fait disparaître l'affichage avec un fade-out progressif
 */
function fadeOutEventDisplay() {
  
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Ajouter la classe fade-out pour l'animation CSS
  if (eventDisplay) {
    // S'assurer que l'élément est visible avant de commencer l'animation
    eventDisplay.classList.remove('hidden');
    eventDisplay.style.display = 'block';
    eventDisplay.style.opacity = '1';
    
    // Forcer un reflow pour que l'animation démarre
    void eventDisplay.offsetWidth;
    
    // Ajouter la classe fade-out pour déclencher l'animation
    eventDisplay.classList.add('fade-out');
    
    // Après l'animation (1 seconde), cacher complètement et réinitialiser
    setTimeout(() => {
      eventDisplay.classList.add('hidden');
      eventDisplay.classList.remove('fade-out');
      eventDisplay.style.opacity = '';
      eventDisplay.style.display = '';
      // Réinitialiser l'affichage après avoir caché
      resetDisplay();
      // Réinitialiser currentEvent après resetDisplay
      currentEvent = null;
    }, 1000); // Durée de l'animation fadeOut
  }
  
  // Cacher aussi le résultat de capture si visible
  if (captureResult && !captureResult.classList.contains('hidden')) {
    captureResult.style.opacity = '1';
    void captureResult.offsetWidth;
    captureResult.classList.add('fade-out');
    setTimeout(() => {
      captureResult.classList.add('hidden');
      captureResult.classList.remove('fade-out');
      captureResult.style.opacity = '';
    }, 1000);
  }
}

/**
 * Affiche la tentative de capture (viewer + ball)
 */
function showCaptureAttempt(data) {
  const ballName = data.ballType || 'Pokéball';
  const ballSprite = data.ballSprite;
  
  resultCard.className = 'result-card attempt';
  resultIcon.textContent = '🎯';
  resultTitle.textContent = `${data.username} tente une capture!`;
  resultMessage.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
      ${ballSprite ? `<img src="${ballSprite}" alt="${ballName}" style="width: 40px; height: 40px;">` : `🎾`}
      <span>${ballName}</span>
    </div>
    <div style="margin-top: 10px;">vs ${data.pokemon.name}</div>
  `;
  
  captureResult.classList.remove('hidden');
}

/**
 * Affiche le résultat de la capture
 */
function showCaptureResult(success, data) {
  if (success) {
    resultCard.className = 'result-card success';
    resultIcon.textContent = '🎉';
    resultTitle.textContent = `${data.username || 'Capture'} Réussie!`;
    resultMessage.textContent = `${data.pokemon.name} a été ajouté à l'équipe de ${data.username || 'l\'utilisateur'}! +100 Pokédollars`;
  } else {
    resultCard.className = 'result-card fail';
    resultIcon.textContent = '❌';
    resultTitle.textContent = `${data.username || 'Capture'} Échouée`;
    resultMessage.textContent = `${data.username || 'L\'utilisateur'} n'a pas réussi à capturer ${data.pokemon.name}. Taux: ${(data.captureRate * 100).toFixed(1)}%`;
  }
  
  captureResult.classList.remove('hidden');
  
  setTimeout(() => {
    captureResult.classList.add('hidden');
  }, 5000);
}

/**
 * Affiche la demande de sélection de pokémon pour le combat
 */
function showBattleSelection(data) {
  resultCard.className = 'result-card selection';
  resultIcon.textContent = '⚔️';
  resultTitle.textContent = `${data.username} doit choisir un pokémon!`;
  resultMessage.innerHTML = `
    <div>Combattre: ${data.wildPokemon.name} (Niv. ${data.wildPokemon.level})</div>
    <div style="margin-top: 10px; font-size: 0.9em;">
      ${data.userPokemons.map((p, i) => `${i + 1}. ${p.name} (Niv. ${p.level})`).join('<br>')}
    </div>
  `;
  
  captureResult.classList.remove('hidden');
}

/**
 * Affiche le résultat du combat
 */
function showBattleResult(success, data) {
  if (success) {
    resultCard.className = 'result-card success';
    resultIcon.textContent = '🎉';
    resultTitle.textContent = 'Victoire!';
    resultMessage.textContent = `${data.username} a gagné avec ${data.pokemon}! +100 Pokédollars`;
  } else {
    resultCard.className = 'result-card fail';
    resultIcon.textContent = '❌';
    resultTitle.textContent = 'Défaite';
    resultMessage.textContent = `${data.username}, ${data.pokemon} a été mis KO. Utilisez !soin pour le soigner.`;
  }
  
  captureResult.classList.remove('hidden');
}

function showBadgeUnlock(data) {
  const badgeUnlock = document.getElementById('badge-unlock');
  const badgeName = document.getElementById('badge-name');
  
  badgeName.textContent = data.name || 'Badge';
  badgeUnlock.classList.remove('hidden');
  
  setTimeout(() => {
    badgeUnlock.classList.add('hidden');
  }, 5000);
}

/**
 * Fonctions de changement de mode
 */
function switchToSpawnMode() {
  if (spawnMode) spawnMode.classList.remove('hidden');
  if (captureMode) captureMode.classList.add('hidden');
  if (battleMode) battleMode.classList.add('hidden');
  if (resultMode) resultMode.classList.add('hidden');
}

/**
 * Affiche le mode de sélection de ball
 */
function switchToBallSelectionMode(data) {
  if (spawnMode) spawnMode.classList.add('hidden');
  if (captureMode) captureMode.classList.remove('hidden');
  if (battleMode) battleMode.classList.add('hidden');
  if (resultMode) resultMode.classList.add('hidden');
  
  if (captureViewerName) captureViewerName.textContent = `${data.username || 'Viewer'} - Choisissez une ball`;
  if (capturePokemonSprite && data.pokemon && data.pokemon.sprite_url) {
    capturePokemonSprite.src = data.pokemon.sprite_url;
    capturePokemonSprite.style.display = 'block';
    capturePokemonSprite.classList.remove('pokemon-entering-ball', 'pokemon-fleeing');
  }
  // Cacher la ball pour l'instant
  if (captureBallSprite) {
    captureBallSprite.style.display = 'none';
  }
  if (captureResultMessage) {
    captureResultMessage.textContent = `Balls disponibles: ${data.availableBalls.map(b => `${b.index}. ${b.name}`).join(', ')}`;
  }
}

/**
 * Anime la tentative de capture : pokémon entre dans la ball, puis bounce
 */
function animateCaptureAttempt(data) {
  if (spawnMode) spawnMode.classList.add('hidden');
  if (captureMode) captureMode.classList.remove('hidden');
  if (battleMode) battleMode.classList.add('hidden');
  if (resultMode) resultMode.classList.add('hidden');
  
  if (captureViewerName) captureViewerName.textContent = data.username || 'Viewer';
  
  // Afficher le pokémon et la ball IMMÉDIATEMENT et de manière visible
  if (capturePokemonSprite && data.pokemon && data.pokemon.sprite_url) {
    capturePokemonSprite.src = data.pokemon.sprite_url;
    capturePokemonSprite.style.display = 'block';
    capturePokemonSprite.style.opacity = '1';
    capturePokemonSprite.style.visibility = 'visible';
    capturePokemonSprite.classList.remove('pokemon-fleeing', 'pokemon-entering-ball');
  }
  
  // Afficher la ball IMMÉDIATEMENT et de manière visible
  // TOUJOURS utiliser le mapping depuis /frontend/assets/*, jamais sprite_url
  if (captureBallSprite) {
    // Réinitialiser l'image
    captureBallSprite.src = '';
    captureBallSprite.style.display = 'block';
    captureBallSprite.style.opacity = '1';
    captureBallSprite.style.visibility = 'visible';
    captureBallSprite.style.width = '80px';
    captureBallSprite.style.height = '80px';
    captureBallSprite.classList.remove('ball-bouncing');
    
    // Gestionnaires d'événements pour le chargement
    captureBallSprite.onload = function() {
      captureBallSprite.style.display = 'block';
      captureBallSprite.style.opacity = '1';
      captureBallSprite.style.visibility = 'visible';
    };
    
    captureBallSprite.onerror = function() {
      console.error('❌ Failed to load ball sprite');
      // Essayer avec Pokeball par défaut
      const ballName = (data.ballType || 'pokeball').toLowerCase();
      const ballFileMap = {
        'pokéball': 'Pokeball.png',
        'pokeball': 'Pokeball.png',
        'superball': 'Superball.png',
        'hyperball': 'Hyperball.png',
        'masterball': 'Masterball.png'
      };
      const fileName = ballFileMap[ballName] || 'Pokeball.png';
      captureBallSprite.src = `/assets/${fileName}`;
    };
    
    // TOUJOURS mapper le nom de la ball au fichier dans /frontend/assets/*
    const ballName = (data.ballType || 'pokeball').toLowerCase();
    const ballFileMap = {
      'pokéball': 'Pokeball.png',
      'pokeball': 'Pokeball.png',
      'superball': 'Superball.png',
      'hyperball': 'Hyperball.png',
      'masterball': 'Masterball.png'
    };
    const fileName = ballFileMap[ballName] || 'Pokeball.png';
    const ballSpritePath = `/assets/${fileName}`;
    
    captureBallSprite.src = ballSpritePath;
  } else {
    console.warn('⚠️ captureBallSprite element not found');
  }
  
  // Cacher le message de résultat pour l'instant
  if (captureResultMessage) {
    captureResultMessage.textContent = '';
    captureResultMessage.style.display = 'none';
    captureResultMessage.className = 'result-message';
  }
  
  // Animation : pokémon entre dans la ball (1.5 secondes)
  if (capturePokemonSprite) {
    capturePokemonSprite.classList.add('pokemon-entering-ball');
  }
  
  // Après l'animation d'entrée, commencer le bounce de la ball avec rotations aléatoires
  setTimeout(() => {
    if (capturePokemonSprite) {
      capturePokemonSprite.style.display = 'none'; // Cacher le pokémon
    }
    if (captureBallSprite) {
      // S'assurer que la ball est toujours visible avant de commencer le bounce
      captureBallSprite.style.display = 'block';
      captureBallSprite.style.opacity = '1';
      captureBallSprite.style.visibility = 'visible';
      startRandomBallBounce(captureBallSprite); // Commencer le bounce avec rotations aléatoires
    }
  }, 1500);
}

function switchToCaptureMode(data) {
  // Cette fonction est maintenant remplacée par animateCaptureAttempt
  animateCaptureAttempt(data);
}

/**
 * Démarre une animation de bounce aléatoire pour la ball (rotations de quarts de tour)
 * @param {HTMLElement} ballElement - L'élément image de la ball
 */
function startRandomBallBounce(ballElement) {
  if (!ballElement) return;
  
  // Réinitialiser la rotation
  ballElement.style.transform = 'rotate(0deg)';
  ballElement.classList.add('ball-bouncing');
  
  // Fonction récursive pour créer des rotations aléatoires
  // Les rotations sont limitées entre -90° et 90°
  let currentAngle = 0;
  
  function randomBounce() {
    // Vérifier si le bounce est toujours actif
    if (!ballElement.classList.contains('ball-bouncing')) {
      return;
    }
    
    // Générer un angle aléatoire entre -90° et 90°
    // On peut faire des rotations de -90, -45, 0, 45, ou 90 degrés
    const angleOptions = [-90, -45, 0, 45, 90];
    const randomIndex = Math.floor(Math.random() * angleOptions.length);
    const targetAngle = angleOptions[randomIndex];
    
    // Générer une durée aléatoire entre 0.2s et 0.6s
    const duration = 0.2 + Math.random() * 0.4;
    
    // Générer un délai aléatoire avant la prochaine rotation (0.1s à 0.4s)
    const delay = 0.1 + Math.random() * 0.3;
    
    // Appliquer la rotation avec transition
    ballElement.style.transition = `transform ${duration}s ease-in-out`;
    ballElement.style.transform = `rotate(${targetAngle}deg)`;
    currentAngle = targetAngle;
    
    // Programmer la prochaine rotation
    setTimeout(() => {
      if (ballElement.classList.contains('ball-bouncing')) {
        randomBounce();
      }
    }, (duration * 1000) + (delay * 1000));
  }
  
  // Démarrer la première rotation après un court délai
  setTimeout(() => {
    randomBounce();
  }, 100);
}

function showCaptureResultInMode(success, data) {
  // Arrêter le bounce de la ball et remettre à 0°
  if (captureBallSprite) {
    captureBallSprite.classList.remove('ball-bouncing');
    captureBallSprite.style.transition = 'transform 0.5s ease-out';
    captureBallSprite.style.transform = 'rotate(0deg)';
  }
  
  if (success) {
    // Succès : étoiles jaillissent de la ball
    if (captureBallSprite) {
      createStarsAnimation(captureBallSprite);
    }
    if (captureResultMessage) {
      captureResultMessage.innerHTML = `<strong>🎉 ${data.pokemon.name} a été capturé!</strong><br>+100 Pokédollars`;
      captureResultMessage.className = 'result-message success';
      captureResultMessage.style.display = 'block';
      captureResultMessage.style.opacity = '1';
      captureResultMessage.style.visibility = 'visible';
    }
  } else {
    // Échec : pokémon réapparaît et fuit
    if (capturePokemonSprite && data.pokemon && data.pokemon.sprite_url) {
      capturePokemonSprite.src = data.pokemon.sprite_url;
      capturePokemonSprite.style.display = 'block';
      capturePokemonSprite.classList.add('pokemon-fleeing');
    }
    if (captureResultMessage) {
      captureResultMessage.innerHTML = `<strong>❌ Échec de la capture</strong><br>${data.pokemon.name} s'est enfui!`;
      captureResultMessage.className = 'result-message fail';
      captureResultMessage.style.display = 'block';
      captureResultMessage.style.opacity = '1';
      captureResultMessage.style.visibility = 'visible';
    }
  }
}

/**
 * Crée une animation d'étoiles jaillissant de la ball
 */
function createStarsAnimation(ballElement) {
  const starsContainer = document.getElementById('capture-stars');
  if (!starsContainer) return;
  
  starsContainer.innerHTML = '';
  starsContainer.style.display = 'block';
  
  // Créer 8 étoiles qui jaillissent dans différentes directions
  for (let i = 0; i < 8; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.textContent = '⭐';
    starsContainer.appendChild(star);
    
    const angle = (i / 8) * Math.PI * 2;
    const distance = 60;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    
    star.style.setProperty('--x', `${x}px`);
    star.style.setProperty('--y', `${y}px`);
  }
  
  // Nettoyer après l'animation
  setTimeout(() => {
    starsContainer.innerHTML = '';
    starsContainer.style.display = 'none';
  }, 2000);
}

function switchToBattleMode(data) {
  if (spawnMode) spawnMode.classList.add('hidden');
  if (captureMode) captureMode.classList.add('hidden');
  if (battleMode) battleMode.classList.remove('hidden');
  if (resultMode) resultMode.classList.add('hidden');
  
  // Initialiser les pokémon de combat
  if (data.wildPokemon) {
    if (battleWildPokemonName) battleWildPokemonName.textContent = data.wildPokemon.name;
    if (battleWildPokemonSprite) {
      if (data.wildPokemon.sprite_url) {
        battleWildPokemonSprite.src = data.wildPokemon.sprite_url;
        battleWildPokemonSprite.style.display = 'block';
        battleWildPokemonSprite.onerror = function() {
          console.error('Failed to load wild pokemon sprite:', data.wildPokemon.sprite_url);
          battleWildPokemonSprite.style.display = 'none';
        };
      } else {
        battleWildPokemonSprite.style.display = 'none';
      }
    }
    if (battleWildLevel) battleWildLevel.textContent = data.wildPokemon.level || 1;
    
    const wildMaxHP = data.wildPokemon.max_hp || Math.floor((data.wildPokemon.base_hp || 100) * (1 + ((data.wildPokemon.level || 1) - 1) * 0.1));
    const wildCurrentHP = data.wildPokemon.current_hp || wildMaxHP;
    if (battleWildHpText) battleWildHpText.textContent = `${wildCurrentHP}/${wildMaxHP}`;
    if (battleWildHpFill) {
      battleWildHpFill.style.width = `${(wildCurrentHP / wildMaxHP) * 100}%`;
      // Mettre à jour la classe selon le pourcentage de HP
      const hpPercent = (wildCurrentHP / wildMaxHP) * 100;
      battleWildHpFill.classList.remove('low', 'medium');
      if (hpPercent <= 25) {
        battleWildHpFill.classList.add('low');
      } else if (hpPercent <= 50) {
        battleWildHpFill.classList.add('medium');
      }
    }
  }
  
  // Le pokémon de l'utilisateur sera mis à jour quand il sera sélectionné
  if (data.userPokemon) {
    if (battleUserPokemonName) battleUserPokemonName.textContent = data.userPokemon.name;
    if (battleUserPokemonSprite) {
      if (data.userPokemon.sprite_url) {
        battleUserPokemonSprite.src = data.userPokemon.sprite_url;
        battleUserPokemonSprite.style.display = 'block';
        battleUserPokemonSprite.onerror = function() {
          console.error('Failed to load user pokemon sprite:', data.userPokemon.sprite_url);
          battleUserPokemonSprite.style.display = 'none';
        };
      } else {
        battleUserPokemonSprite.style.display = 'none';
      }
    }
    if (battleUserLevel) battleUserLevel.textContent = data.userPokemon.level || 1;
    
    const userMaxHP = data.userPokemon.max_hp || Math.floor((data.userPokemon.base_hp || 100) * (1 + ((data.userPokemon.level || 1) - 1) * 0.1));
    const userCurrentHP = data.userPokemon.current_hp || userMaxHP;
    if (battleUserHpText) battleUserHpText.textContent = `${userCurrentHP}/${userMaxHP}`;
    if (battleUserHpFill) {
      battleUserHpFill.style.width = `${(userCurrentHP / userMaxHP) * 100}%`;
      // Mettre à jour la classe selon le pourcentage de HP
      const hpPercent = (userCurrentHP / userMaxHP) * 100;
      battleUserHpFill.classList.remove('low', 'medium');
      if (hpPercent <= 25) {
        battleUserHpFill.classList.add('low');
      } else if (hpPercent <= 50) {
        battleUserHpFill.classList.add('medium');
      }
    }
  }
  
  if (battleLog) battleLog.innerHTML = '';
}

// Handler pour mettre à jour le mode combat avec les pokémon sélectionnés
socket.on('battle_start', (data) => {
  switchToBattleMode(data);
});

/**
 * Anime le résultat du combat : fait descendre la barre de HP du perdant puis affiche le résultat
 */
function animateBattleResult(data) {
  // Déterminer quel pokémon a perdu
  const isUserLoser = data.loserPokemon === 'user';
  const loserHpBar = isUserLoser ? battleUserHpFill : battleWildHpFill;
  const loserHpText = isUserLoser ? battleUserHpText : battleWildHpText;
  
  // Récupérer les HP actuels et finaux
  const currentHP = isUserLoser ? data.userPokemonHP : data.wildPokemonHP;
  const finalHP = 0; // Le perdant tombe à 0
  
  // Calculer le pourcentage actuel
  const maxHP = isUserLoser 
    ? (parseInt(battleUserHpText?.textContent.split('/')[1]) || 100)
    : (parseInt(battleWildHpText?.textContent.split('/')[1]) || 100);
  
  const currentPercent = (currentHP / maxHP) * 100;
  
  // Animer la descente de la barre de HP
  if (loserHpBar) {
    // Désactiver la transition pour l'animation manuelle
    loserHpBar.style.transition = 'width 1.5s ease-out';
    
    // Ajouter la classe low pour la couleur rouge
    loserHpBar.classList.add('low');
    
    // Animer jusqu'à 0
    setTimeout(() => {
      loserHpBar.style.width = '0%';
      
      // Mettre à jour le texte pendant l'animation
      if (loserHpText) {
        let animationFrame;
        const startTime = Date.now();
        const duration = 1500; // 1.5 secondes
        
        const animateHP = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const hpValue = Math.max(0, Math.floor(currentHP * (1 - progress)));
          loserHpText.textContent = `${hpValue}/${maxHP}`;
          
          if (progress < 1) {
            animationFrame = requestAnimationFrame(animateHP);
          } else {
            loserHpText.textContent = `0/${maxHP}`;
          }
        };
        animateHP();
      }
    }, 100);
    
    // Après l'animation de la barre, afficher le résultat
    setTimeout(() => {
      switchToResultMode(data.victory, data);
      
      // Fade-out après 20 secondes
      setTimeout(() => {
        fadeOutEventDisplay();
      }, 20000);
    }, 1600); // 1.5s d'animation + 0.1s de marge
  } else {
    // Si les éléments n'existent pas, afficher directement le résultat
    console.warn('⚠️ HP bar elements not found, showing result directly');
    switchToResultMode(data.victory, data);
    setTimeout(() => {
      fadeOutEventDisplay();
    }, 20000);
  }
}

function switchToResultMode(success, data) {
  if (spawnMode) spawnMode.classList.add('hidden');
  if (captureMode) captureMode.classList.add('hidden');
  if (battleMode) battleMode.classList.add('hidden');
  if (resultMode) resultMode.classList.remove('hidden');
  
  // Récupérer les éléments du header
  const resultHeader = document.querySelector('#result-mode .result-header');
  
  // Mettre à jour les classes pour le style
  if (resultHeader) {
    resultHeader.classList.remove('victory', 'defeat');
    resultHeader.classList.add(success ? 'victory' : 'defeat');
  }
  
  if (resultMessageLarge) {
    resultMessageLarge.classList.remove('victory', 'defeat');
    resultMessageLarge.classList.add(success ? 'victory' : 'defeat');
  }
  
  if (resultIconLarge) {
    resultIconLarge.textContent = success ? '🎉' : '💔';
  }
  if (resultTitleLarge) {
    resultTitleLarge.textContent = success ? 'Victoire!' : 'Défaite';
  }
  if (resultMessageLarge) {
    if (success) {
      resultMessageLarge.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #4CAF50;">
          ${data.username} a gagné avec ${data.pokemon}!
        </div>
        <div style="font-size: 14px; color: #FFD700;">
          +100 Pokédollars
        </div>
      `;
    } else {
      resultMessageLarge.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #F44336;">
          ${data.username}, ${data.pokemon} a été mis KO
        </div>
        <div style="font-size: 14px; opacity: 0.9;">
          Utilisez <span style="color: #FFD700; font-weight: bold;">!soin</span> pour le soigner
        </div>
      `;
    }
  }
}

// Nettoyage au déchargement
window.addEventListener('beforeunload', () => {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  socket.disconnect();
});

