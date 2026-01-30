/**
 * Game state store - orchestrates game logic, networking, and UI
 *
 * This is the central state manager that coordinates between:
 * - Game logic (pure functions from $lib/game)
 * - Networking (PeerJS host/player)
 * - Photos (Google Photos picker)
 */

import { PhotoRouletteHost } from './networking/host.js';
import { PhotoRoulettePlayer } from './networking/player.js';
import {
	type GameState,
	type GamePhase,
	type GameSettings,
	type Player,
	type PlayerId,
	type Photo,
	type Guess,
	type RoundResult,
	type FinalResults,
	type PlayerScore,
} from './logic/types.js';
import {
	DEFAULT_GAME_SETTINGS,
	ROUND_RESULT_DISPLAY_MS,
	ROUND_SYNC_BUFFER_MS,
	ANIMAL_EMOJIS,
	MIN_PHOTOS_PER_PLAYER,
} from './logic/constants.js';
import {
	createInitialState,
	addPlayer,
	updatePlayer,
	updateSettings,
	transitionToLobby,
	transitionToFinal,
	allPlayersReady,
} from './logic/state.js';
import {
	createPhotoPool,
	selectFairPhoto,
	createRound,
	updateGuess,
	completeRound,
	allPlayersGuessed,
} from './logic/round.js';
import {
	processPickedPhotos,
	createDataUrl,
	isTestPlayer,
	generateTestPhotos,
	type ProcessedImage,
} from './photos/index.js';
import { getRankedScores, determineWinner, createEmptyPlayerScore } from './logic/scoring.js';
import { calculateSuperlatives } from './logic/superlatives.js';
import { setRandomSeed } from './logic/random.js';
import { saveSession, loadSession, clearSession, type PersistedSession } from './persistence.js';

/**
 * Get the round result display duration.
 * Can be overridden via window.__TEST_RESULT_DISPLAY_MS__ for faster E2E tests.
 */
function getResultDisplayMs(): number {
	if (typeof window !== 'undefined') {
		const testOverride = (window as unknown as { __TEST_RESULT_DISPLAY_MS__?: number })
			.__TEST_RESULT_DISPLAY_MS__;
		if (testOverride !== undefined && testOverride > 0) {
			return testOverride;
		}
	}
	return ROUND_RESULT_DISPLAY_MS;
}

/** Log levels */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Logger function type */
type Logger = (level: LogLevel, message: string, data?: unknown) => void;

/** Simple console logger */
const defaultLogger: Logger = (level, message, data) => {
	const timestamp = new Date().toISOString();
	const prefix = `[${timestamp}] [GAME] [${level.toUpperCase()}]`;
	if (data !== undefined) {
		console[level](`${prefix} ${message}`, data);
	} else {
		console[level](`${prefix} ${message}`);
	}
};

/** Store state */
interface GameStore {
	// Connection state
	isHost: boolean;
	roomCode: string | null;
	connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
	connectionError: string | null;

	// Player state
	myPlayerId: PlayerId | null;
	myName: string;
	myEmoji: string;

	// Game state
	phase: GamePhase;
	settings: GameSettings;
	players: Player[];
	currentRound: GameState['currentRound'];
	roundResults: RoundResult[];
	playerScores: Map<PlayerId, PlayerScore>;
	finalResults: FinalResults | null;

	// Round state
	currentImageData: string | null;
	myGuess: PlayerId | null;
	guessCount: number;
	timerStartTime: number | null;
	timerEndTime: number | null;

	// Photo state
	hasConnectedPhotos: boolean;
	photoCount: number;
	isConnectingPhotos: boolean;
	photoError: string | null;
}

function createGameStore() {
	// Private networking instances
	let hostNetwork: PhotoRouletteHost | null = null;
	let playerNetwork: PhotoRoulettePlayer | null = null;
	let roundTimer: ReturnType<typeof setTimeout> | null = null;
	let resultsTimer: ReturnType<typeof setTimeout> | null = null;
	let roundStartSyncTimer: ReturnType<typeof setTimeout> | null = null;

	// Logger (can be overridden)
	let log: Logger = defaultLogger;

	// Internal game state (authoritative on host)
	let internalState: GameState = createInitialState();
	let photos: Photo[] = [];
	// Track how many times each player's photo has been featured (for fair distribution)
	let featureCounts: Map<PlayerId, number> = new Map();

	// Reactive store state
	let isHost = $state(false);
	let roomCode = $state<string | null>(null);
	let connectionStatus = $state<GameStore['connectionStatus']>('disconnected');
	let connectionError = $state<string | null>(null);

	let myPlayerId = $state<PlayerId | null>(null);
	let myName = $state('');
	let myEmoji = $state(ANIMAL_EMOJIS[Math.floor(Math.random() * ANIMAL_EMOJIS.length)]);

	let phase = $state<GamePhase>('landing');
	let settings = $state<GameSettings>({ ...DEFAULT_GAME_SETTINGS });
	let players = $state<Player[]>([]);
	let currentRound = $state<GameState['currentRound']>(null);
	let roundResults = $state<RoundResult[]>([]);
	let playerScores = $state<Map<PlayerId, PlayerScore>>(new Map());
	let finalResults = $state<FinalResults | null>(null);

	let currentImageData = $state<string | null>(null);
	let resultsPhotoData = $state<string | null>(null); // Photo shown on results screen
	let myGuess = $state<PlayerId | null>(null);
	let guessCount = $state(0);
	let timerStartTime = $state<number | null>(null);
	let timerEndTime = $state<number | null>(null);

	let hasConnectedPhotos = $state(false);
	let photoCount = $state(0);
	let isConnectingPhotos = $state(false);
	let photoError = $state<string | null>(null);
	let photoLoadingProgress = $state<{ loaded: number; total: number } | null>(null);

	// Track photos shown during the game (for final screen thumbnails)
	let gamePhotoUrls = $state<Map<string, string>>(new Map()); // photoId -> data URL

	// Sync state from internal to reactive
	function syncState() {
		phase = internalState.phase;
		settings = internalState.settings;
		players = [...internalState.players];
		currentRound = internalState.currentRound;
		roundResults = [...internalState.roundResults];
		playerScores = new Map(internalState.playerScores);
	}

	// Persist session state to sessionStorage for recovery after refresh
	function persistSession() {
		if (!myPlayerId || !roomCode) return;

		saveSession({
			isHost,
			roomCode,
			myPlayerId,
			myName,
			myEmoji,
			phase,
			settings,
			players,
			hasConnectedPhotos,
			photoCount,
		});
	}

	// Check for and return any persisted session
	function getPersistedSession(): PersistedSession | null {
		return loadSession();
	}

	// Restore state from a persisted session (for UI to decide whether to offer reconnect)
	async function restoreAsPlayer(session: PersistedSession): Promise<boolean> {
		if (session.isHost) {
			log('warn', 'Cannot restore host session as player');
			return false;
		}

		log('info', 'Attempting to restore player session', { roomCode: session.roomCode });

		// Restore basic state
		isHost = false;
		myName = session.myName;
		myEmoji = session.myEmoji;
		roomCode = session.roomCode;
		myPlayerId = session.myPlayerId;
		hasConnectedPhotos = session.hasConnectedPhotos;
		photoCount = session.photoCount;
		connectionStatus = 'connecting';

		// Try to reconnect
		playerNetwork = new PhotoRoulettePlayer();
		setupPlayerEvents();

		try {
			await playerNetwork.rejoinRoom(
				session.roomCode,
				session.myPlayerId,
				session.myName,
				session.myEmoji
			);
			return true;
		} catch (error) {
			log('error', 'Failed to restore session', { error });
			connectionStatus = 'error';
			connectionError = 'Failed to reconnect. The game may have ended.';
			clearSession();
			return false;
		}
	}

	// Clear persisted session (called when intentionally leaving)
	function clearPersistedSession() {
		clearSession();
	}

	// === Host Functions ===

	async function hostGame(name: string, emoji: string): Promise<string> {
		log('info', 'Hosting game', { name, emoji });

		isHost = true;
		myName = name;
		myEmoji = emoji;
		connectionStatus = 'connecting';

		const hostPlayerId = crypto.randomUUID();
		myPlayerId = hostPlayerId;

		// Create host player
		const hostPlayer: Player = {
			id: hostPlayerId,
			name,
			emoji,
			photoIds: [],
			isHost: true,
			isReady: false,
			isConnected: true,
			isSpectator: false,
		};

		// Initialize game state - transitionToLobby adds the host player
		internalState = createInitialState();
		internalState = transitionToLobby(internalState, hostPlayer);

		// Create host network
		hostNetwork = new PhotoRouletteHost(hostPlayerId);
		setupHostEvents();

		try {
			const code = await hostNetwork.createRoom();
			roomCode = code;
			connectionStatus = 'connected';
			syncState();
			persistSession();
			log('info', 'Room created', { roomCode: code });
			return code;
		} catch (error) {
			connectionStatus = 'error';
			connectionError = error instanceof Error ? error.message : 'Failed to create room';
			log('error', 'Failed to create room', { error });
			throw error;
		}
	}

	function setupHostEvents() {
		if (!hostNetwork) return;

		hostNetwork.on('playerJoinRequest', (peerId, name, emoji, accept, reject) => {
			log('info', 'Player join request', { peerId, name, emoji });

			// Check if game already started
			if (internalState.phase !== 'lobby') {
				reject('game-in-progress');
				return;
			}

			// Check player limit
			if (internalState.players.length >= 8) {
				reject('game-full');
				return;
			}

			// Create player
			const playerId = crypto.randomUUID();
			const newPlayer: Player = {
				id: playerId,
				name,
				emoji,
				photoIds: [],
				isHost: false,
				isReady: false,
				isConnected: true,
				isSpectator: false,
			};

			internalState = addPlayer(internalState, newPlayer);
			accept(playerId);

			// Send acceptance with current state
			hostNetwork!.sendJoinAccepted(
				peerId,
				playerId,
				internalState.players,
				internalState.settings,
				internalState.phase
			);

			// Broadcast new player to all existing players
			hostNetwork!.broadcastPlayerUpdate(playerId, {
				name,
				emoji,
				isReady: false,
				isSpectator: false,
				photoIds: [],
			});

			syncState();
			log('info', 'Player joined', { playerId, name });
		});

		hostNetwork.on('playerUpdate', (playerId, updates) => {
			log('debug', 'Player update', { playerId, updates });
			internalState = updatePlayer(internalState, playerId, updates);
			hostNetwork!.broadcastPlayerUpdate(playerId, updates);
			syncState();
		});

		hostNetwork.on('photosSubmitted', (playerId, submittedPhotos) => {
			log('info', 'Photos submitted', { playerId, count: submittedPhotos.length });

			// Update player's photo IDs
			const photoIds = submittedPhotos.map((p) => p.id);

			// Store photos in pool
			for (const photo of submittedPhotos) {
				if (!photos.find((p) => p.id === photo.id)) {
					photos.push(photo);
				}
			}

			// Update player's photoIds and ready state in internal state
			const player = internalState.players.find((p) => p.id === playerId);
			if (player) {
				player.photoIds = photoIds;
				player.isReady = photoIds.length >= MIN_PHOTOS_PER_PLAYER;
			}

			// Broadcast both photoIds and isReady so all clients get updated
			hostNetwork!.broadcastPlayerUpdate(playerId, {
				photoIds,
				isReady: photoIds.length >= MIN_PHOTOS_PER_PLAYER,
			});
			syncState();
		});

		hostNetwork.on('guessReceived', (playerId, guess) => {
			log('debug', 'Guess received', { playerId, guessedOwnerId: guess.guessedOwnerId });

			if (!internalState.currentRound) return;

			internalState.currentRound = updateGuess(internalState.currentRound, guess);
			guessCount = internalState.currentRound.guesses.length;

			// Check if all players have guessed
			const playerIds = internalState.players.map((p) => p.id);
			if (allPlayersGuessed(internalState.currentRound, playerIds)) {
				endRound();
			}
		});

		hostNetwork.on('playerDisconnected', (playerId) => {
			log('warn', 'Player disconnected', { playerId });
			const player = internalState.players.find((p) => p.id === playerId);
			if (player) {
				player.isConnected = false;
				syncState();
			}
		});

		hostNetwork.on('playerReconnected', (playerId) => {
			log('info', 'Player reconnected', { playerId });
			const player = internalState.players.find((p) => p.id === playerId);
			if (player) {
				player.isConnected = true;
				// Send full state sync to reconnected player
				hostNetwork!.sendStateSync(playerId, internalState);
				syncState();
			}
		});

		hostNetwork.on('error', (error) => {
			log('error', 'Host network error', { error: error.message });
		});
	}

	// === Player (Client) Functions ===

	async function joinGame(code: string, name: string, emoji: string): Promise<void> {
		log('info', 'Joining game', { code, name, emoji });

		isHost = false;
		myName = name;
		myEmoji = emoji;
		roomCode = code;
		connectionStatus = 'connecting';

		playerNetwork = new PhotoRoulettePlayer();
		setupPlayerEvents();

		try {
			await playerNetwork.joinRoom(code, name, emoji);
		} catch (error) {
			connectionStatus = 'error';
			connectionError = error instanceof Error ? error.message : 'Failed to join room';
			log('error', 'Failed to join room', { error });
			throw error;
		}
	}

	function setupPlayerEvents() {
		if (!playerNetwork) return;

		playerNetwork.on('joined', (playerId, playerList, gameSettings, gamePhase) => {
			log('info', 'Joined game', { playerId, playerCount: playerList.length });
			myPlayerId = playerId;
			connectionStatus = 'connected';
			phase = gamePhase;
			settings = gameSettings;
			players = playerList;
			persistSession();
		});

		playerNetwork.on('joinRejected', (reason) => {
			log('warn', 'Join rejected', { reason });
			connectionStatus = 'error';
			connectionError =
				reason === 'game-full'
					? 'Room is full'
					: reason === 'game-in-progress'
						? 'Game already started'
						: reason === 'name-taken'
							? 'Name already taken'
							: 'Failed to join';
		});

		playerNetwork.on('playerUpdate', (playerId, updates) => {
			log('debug', 'Player update received', { playerId, updates });
			const player = players.find((p) => p.id === playerId);
			if (player) {
				Object.assign(player, updates);
				players = [...players];
			} else {
				// New player joined - add them to the list
				const newPlayer: Player = {
					id: playerId,
					name: updates.name ?? 'Unknown',
					emoji: updates.emoji ?? '🐰',
					photoIds: updates.photoIds ?? [],
					isHost: false,
					isReady: updates.isReady ?? false,
					isConnected: true,
					isSpectator: updates.isSpectator ?? false,
				};
				players = [...players, newPlayer];
			}
		});

		playerNetwork.on('playerLeft', (playerId) => {
			log('info', 'Player left', { playerId });
			const playerIndex = players.findIndex((p) => p.id === playerId);
			if (playerIndex !== -1) {
				players.splice(playerIndex, 1);
				players = [...players];
			}
		});

		playerNetwork.on('settingsChanged', (newSettings) => {
			log('debug', 'Settings changed', { settings: newSettings });
			settings = newSettings;
		});

		playerNetwork.on('gameStarting', (playerList, gameSettings) => {
			log('info', 'Game starting');
			phase = 'playing';
			players = playerList;
			settings = gameSettings;
			// Reset for new game / rematch
			roundResults = [];
			playerScores = new Map();
			finalResults = null;
			gamePhotoUrls = new Map();
		});

		playerNetwork.on('roundStart', (roundNumber, imageData, _photoId, startTime) => {
			log('info', 'Round start received', { roundNumber, startTime });

			// Calculate delay until target start time (startTime is the synchronized target)
			const now = Date.now();
			const delay = Math.max(0, startTime - now);

			// Schedule the round to start at the target time
			if (roundStartSyncTimer) clearTimeout(roundStartSyncTimer);
			roundStartSyncTimer = setTimeout(() => {
				log('info', 'Round starting', { roundNumber });
				phase = 'playing';
				resultsPhotoData = null; // Clear previous round's photo
				currentImageData = imageData;
				// Save photo for final screen thumbnails
				gamePhotoUrls.set(_photoId, createDataUrl(imageData));
				timerStartTime = startTime;
				timerEndTime = startTime + settings.timerSeconds * 1000;
				myGuess = null;
				guessCount = 0;
				currentRound = {
					roundNumber,
					photoId: _photoId,
					photoOwnerId: '', // Not known to players
					guesses: [],
					startTime,
				};
			}, delay);
		});

		playerNetwork.on('roundEnd', (result, scores) => {
			log('info', 'Round ended', { roundNumber: result.roundNumber });
			resultsPhotoData = currentImageData; // Save for results display
			phase = 'results';
			roundResults = [...roundResults, result];
			playerScores = scores;
			currentRound = null;
			currentImageData = null;
		});

		playerNetwork.on('gameEnd', (results) => {
			log('info', 'Game ended', { winnerId: results.winnerId });
			phase = 'final';
			finalResults = results;
		});

		playerNetwork.on('stateSync', (state) => {
			log('info', 'State sync received', { phase: state.phase });
			if (state.phase) phase = state.phase;
			if (state.settings) settings = state.settings;
			if (state.players) players = state.players;
			if (state.playerScores) playerScores = state.playerScores;
			// State sync means we're connected (used after reconnection)
			if (connectionStatus === 'connecting') {
				connectionStatus = 'connected';
			}
		});

		playerNetwork.on('disconnected', () => {
			log('warn', 'Disconnected from host');
			connectionStatus = 'disconnected';
		});

		playerNetwork.on('reconnected', () => {
			log('info', 'Reconnected to host');
			connectionStatus = 'connected';
		});

		playerNetwork.on('kicked', (reason) => {
			log('warn', 'Kicked from game', { reason });
			connectionStatus = 'disconnected';
			connectionError = reason || 'Kicked from game';
		});

		playerNetwork.on('error', (error) => {
			log('error', 'Player network error', { error: error.message });
		});
	}

	// === Game Actions ===

	function updateMyInfo(name: string, emoji: string) {
		myName = name;
		myEmoji = emoji;

		if (isHost && myPlayerId) {
			internalState = updatePlayer(internalState, myPlayerId, { name, emoji });
			syncState();
		} else if (playerNetwork) {
			playerNetwork.sendPlayerUpdate({ name, emoji });
		}
	}

	function updateGameSettings(newSettings: GameSettings) {
		if (!isHost) return;

		internalState = updateSettings(internalState, newSettings);
		hostNetwork?.broadcastSettingsChange(newSettings);
		syncState();
	}

	function setSpectatorMode(spectator: boolean) {
		if (!myPlayerId) return;

		log('info', 'Setting spectator mode', { isSpectator: spectator });

		if (isHost) {
			const player = internalState.players.find((p) => p.id === myPlayerId);
			if (player) {
				player.isSpectator = spectator;
				// Clear photos if becoming spectator
				if (spectator) {
					player.photoIds = [];
					photos = photos.filter((p) => p.ownerId !== myPlayerId);
				}
				// Recalculate ready state
				player.isReady =
					player.name.trim().length > 0 &&
					player.isConnected &&
					(spectator || player.photoIds.length >= MIN_PHOTOS_PER_PLAYER);
			}
			hostNetwork?.broadcastPlayerUpdate(myPlayerId, { isSpectator: spectator });
			syncState();
		} else if (playerNetwork) {
			playerNetwork.sendPlayerUpdate({ isSpectator: spectator });
		}

		// Update local photo state if becoming spectator
		if (spectator) {
			hasConnectedPhotos = false;
			photoCount = 0;
		}
	}

	async function connectPhotos(
		pickerFn: () => Promise<{ photos: Array<{ id: string; baseUrl: string }> }>
	) {
		log('info', 'Connecting photos');
		isConnectingPhotos = true;
		photoError = null;
		photoLoadingProgress = null;

		try {
			let processedImages: ProcessedImage[];

			// Check if this is a test player (name like "AAA", "BBB", etc.)
			if (isTestPlayer(myName)) {
				log('info', 'Test player detected, generating test photos', { name: myName });
				processedImages = generateTestPhotos(myName, 15);
			} else {
				// Step 1: Pick photos from Google Photos
				const result = await pickerFn();
				log('info', 'Photos picked', { count: result.photos.length });

				// Set initial progress
				photoLoadingProgress = { loaded: 0, total: result.photos.length };

				// Step 2: Process photos - fetch with OAuth, resize, compress to base64
				processedImages = await processPickedPhotos(
					result.photos.map((p) => ({
						id: p.id,
						baseUrl: p.baseUrl,
						mimeType: 'image/jpeg',
					})),
					undefined, // Use stored token
					(current, total, message) => {
						log('debug', message);
						photoLoadingProgress = { loaded: current, total };
					}
				);
			}

			// Step 3: Create Photo objects with imageData
			const pickedPhotos: Photo[] = processedImages.map((img: ProcessedImage) => ({
				id: img.id,
				ownerId: myPlayerId!,
				baseUrl: '', // No longer used, but keep for type compatibility
				imageData: img.imageData,
			}));

			photoCount = pickedPhotos.length;
			hasConnectedPhotos = true;

			// Add photos to pool (same logic as peer photo submission)
			// First remove any existing photos from this player
			photos = photos.filter((p) => p.ownerId !== myPlayerId);
			// Then add the new photos
			for (const photo of pickedPhotos) {
				if (!photos.find((p) => p.id === photo.id)) {
					photos.push(photo);
				}
			}

			log('info', 'Photos processed', { count: pickedPhotos.length });

			if (isHost && myPlayerId) {
				// Update host's own photos
				const player = internalState.players.find((p) => p.id === myPlayerId);
				if (player) {
					player.photoIds = pickedPhotos.map((p) => p.id);
					player.isReady = pickedPhotos.length >= MIN_PHOTOS_PER_PLAYER;
				}
				syncState();
				persistSession();
			} else if (playerNetwork && myPlayerId) {
				// Send to host (with imageData included)
				playerNetwork.sendPhotos(pickedPhotos);
				persistSession();
			}
		} catch (error) {
			photoError = error instanceof Error ? error.message : 'Failed to connect photos';
			log('error', 'Failed to connect photos', { error });
		} finally {
			isConnectingPhotos = false;
			photoLoadingProgress = null;
		}
	}

	function startGame() {
		if (!isHost) return;
		if (!allPlayersReady(internalState)) {
			log('warn', 'Cannot start game - not all players ready');
			return;
		}

		log('info', 'Starting game');

		// Check for test seed (injected by E2E tests for deterministic behavior)
		if (typeof window !== 'undefined') {
			const testSeed = (window as unknown as { __TEST_RANDOM_SEED__?: number })
				.__TEST_RANDOM_SEED__;
			if (testSeed !== undefined) {
				log('info', 'Using test random seed', { seed: testSeed });
				setRandomSeed(testSeed);
			}
		}

		// Create photo pool from all players' photos
		internalState.photoPool = createPhotoPool(photos);

		// Initialize player scores
		for (const player of internalState.players) {
			internalState.playerScores.set(player.id, createEmptyPlayerScore(player.id));
		}

		// Initialize feature counts for fair photo distribution (only non-spectators have photos)
		featureCounts = new Map();
		for (const player of internalState.players) {
			if (!player.isSpectator) {
				featureCounts.set(player.id, 0);
			}
		}

		// Clear game photos from previous game
		gamePhotoUrls = new Map();

		// Transition to playing
		internalState.phase = 'playing';

		// Broadcast game starting
		hostNetwork?.broadcastGameStarting(internalState.players, internalState.settings);

		// Start first round
		startNextRoundInternal();
	}

	function startNextRoundInternal() {
		if (!isHost) return;

		log('info', 'Starting next round');

		// Select photo fairly (equal distribution among players)
		const selection = selectFairPhoto(internalState.photoPool, featureCounts);
		if (!selection) {
			log('error', 'No photos available');
			return;
		}

		internalState.photoPool = selection.updatedPool;
		const photo = selection.photo;

		// Update feature count for this player
		const currentCount = featureCounts.get(photo.ownerId) || 0;
		featureCounts.set(photo.ownerId, currentCount + 1);
		log('debug', 'Feature counts updated', { ownerId: photo.ownerId, count: currentCount + 1 });

		// Ensure photo has imageData
		if (!photo.imageData) {
			log('error', 'Photo missing imageData', { photoId: photo.id });
			return;
		}

		// Compute synchronized start time (in the future to account for network latency)
		const targetStartTime = Date.now() + ROUND_SYNC_BUFFER_MS;
		const roundNumber = internalState.roundResults.length + 1;

		// Broadcast round start FIRST so peers receive it before we start locally
		hostNetwork?.broadcastRoundStart(roundNumber, photo.imageData, photo.id, targetStartTime);

		// Schedule the round to start at the target time for host too
		if (roundStartSyncTimer) clearTimeout(roundStartSyncTimer);
		roundStartSyncTimer = setTimeout(() => {
			// Create round with the target start time
			const round = createRound(roundNumber, photo, targetStartTime);
			internalState.currentRound = round;

			// Set local state - use imageData instead of URL
			resultsPhotoData = null; // Clear previous round's photo
			currentImageData = photo.imageData ?? null;
			// Save photo for final screen thumbnails
			if (photo.imageData) {
				gamePhotoUrls.set(photo.id, createDataUrl(photo.imageData));
			}
			currentRound = round;
			timerStartTime = round.startTime;
			timerEndTime = round.startTime + internalState.settings.timerSeconds * 1000;
			myGuess = null;
			guessCount = 0;

			syncState();

			// Start the round end timer based on the target end time
			if (roundTimer) clearTimeout(roundTimer);
			const timeUntilEnd = timerEndTime - Date.now();
			roundTimer = setTimeout(() => {
				endRound();
			}, timeUntilEnd);
		}, ROUND_SYNC_BUFFER_MS);
	}

	function submitGuess(guessedOwnerId: PlayerId) {
		if (!myPlayerId) return;

		log('debug', 'Submitting guess', { guessedOwnerId });
		myGuess = guessedOwnerId;

		const guess: Guess = {
			playerId: myPlayerId,
			guessedOwnerId,
			timestamp: Date.now(),
		};

		if (isHost) {
			if (internalState.currentRound) {
				internalState.currentRound = updateGuess(internalState.currentRound, guess);
				guessCount = internalState.currentRound.guesses.length;

				const playerIds = internalState.players.map((p) => p.id);
				if (allPlayersGuessed(internalState.currentRound, playerIds)) {
					endRound();
				}
			}
		} else if (playerNetwork) {
			playerNetwork.sendGuess(guessedOwnerId);
		}
	}

	function endRound() {
		if (!isHost || !internalState.currentRound) return;

		log('info', 'Ending round');

		// Clear timer
		if (roundTimer) {
			clearTimeout(roundTimer);
			roundTimer = null;
		}

		// Complete the round
		const playerIds = internalState.players.map((p) => p.id);
		const result = completeRound(internalState.currentRound, playerIds);
		internalState.roundResults.push(result);

		// Update scores
		for (const score of result.scores) {
			const existing = internalState.playerScores.get(score.playerId);
			if (existing) {
				existing.totalPoints += score.points;
				existing.correctGuesses += score.correctGuess ? 1 : 0;
				existing.fastestGuesses += score.isFastest ? 1 : 0;
				existing.timesFeatured += score.isFeatured ? 1 : 0;
			} else {
				internalState.playerScores.set(score.playerId, {
					playerId: score.playerId,
					totalPoints: score.points,
					correctGuesses: score.correctGuess ? 1 : 0,
					fastestGuesses: score.isFastest ? 1 : 0,
					timesFeatured: score.isFeatured ? 1 : 0,
				});
			}
		}

		// Save photo for results display before clearing
		resultsPhotoData = currentImageData;

		// Transition to results
		internalState.phase = 'results';
		internalState.currentRound = null;

		// Broadcast round end
		hostNetwork?.broadcastRoundEnd(result, internalState.playerScores);

		syncState();

		// Check if game is over
		if (internalState.roundResults.length >= internalState.settings.totalRounds) {
			// Schedule final results
			resultsTimer = setTimeout(() => {
				showFinalResults();
			}, getResultDisplayMs());
		} else {
			// Schedule next round
			resultsTimer = setTimeout(() => {
				internalState.phase = 'playing';
				startNextRoundInternal();
			}, getResultDisplayMs());
		}
	}

	function showFinalResults() {
		if (!isHost) return;

		log('info', 'Showing final results');

		// Calculate final results
		const rankings = getRankedScores(internalState.playerScores);
		const winnerId = determineWinner(internalState.playerScores);

		// Build player names map for superlatives
		const playerIds = internalState.players.map((p) => p.id);
		const playerNames = new Map<PlayerId, string>();
		for (const player of internalState.players) {
			playerNames.set(player.id, player.name);
		}

		const superlatives = calculateSuperlatives(playerIds, internalState.roundResults, playerNames);

		const results: FinalResults = {
			rankings,
			superlatives,
			winnerId: winnerId || '',
		};

		finalResults = results;
		internalState = transitionToFinal(internalState);

		// Broadcast game end
		hostNetwork?.broadcastGameEnd(results);

		syncState();
	}

	function rematch() {
		if (!isHost) return;

		log('info', 'Starting rematch');

		// Reset for new game with same photos
		internalState.roundResults = [];
		internalState.playerScores = new Map();
		internalState.photoPool = createPhotoPool(photos);
		internalState.phase = 'playing';

		// Reinitialize player scores
		for (const player of internalState.players) {
			internalState.playerScores.set(player.id, createEmptyPlayerScore(player.id));
		}

		// Reset feature counts for fair distribution (only non-spectators have photos)
		featureCounts = new Map();
		for (const player of internalState.players) {
			if (!player.isSpectator) {
				featureCounts.set(player.id, 0);
			}
		}

		// Clear game photos for new game
		gamePhotoUrls = new Map();

		finalResults = null;
		roundResults = [];
		playerScores = new Map();

		hostNetwork?.broadcastGameStarting(internalState.players, internalState.settings);
		startNextRoundInternal();
	}

	async function newGame() {
		if (!isHost) return;

		log('info', 'Starting new game - kicking all players and creating new room');

		// Kick all non-host players
		for (const player of internalState.players) {
			if (!player.isHost) {
				hostNetwork?.kickPlayer(player.id, 'Host started a new game');
			}
		}

		// Close the old room
		hostNetwork?.closeRoom();
		hostNetwork = null;

		// Reset all state
		internalState = createInitialState();
		finalResults = null;
		roundResults = [];
		playerScores = new Map();
		currentRound = null;
		currentImageData = null;
		resultsPhotoData = null;
		photos = [];
		featureCounts = new Map();
		gamePhotoUrls = new Map();
		hasConnectedPhotos = false;
		photoCount = 0;

		// Create a new host player (keep the same name/emoji)
		const hostPlayerId = crypto.randomUUID();
		myPlayerId = hostPlayerId;

		const hostPlayer: Player = {
			id: hostPlayerId,
			name: myName,
			emoji: myEmoji,
			photoIds: [],
			isHost: true,
			isReady: false,
			isConnected: true,
			isSpectator: false,
		};

		internalState = transitionToLobby(internalState, hostPlayer);

		// Create new host network with new room code
		hostNetwork = new PhotoRouletteHost(hostPlayerId);
		setupHostEvents();

		try {
			const code = await hostNetwork.createRoom();
			roomCode = code;
			connectionStatus = 'connected';
			syncState();
			log('info', 'New room created', { roomCode: code });
		} catch (error) {
			connectionStatus = 'error';
			connectionError = error instanceof Error ? error.message : 'Failed to create room';
			log('error', 'Failed to create new room', { error });
		}
	}

	function leaveGame() {
		log('info', 'Leaving game');

		// Clear persisted session when intentionally leaving
		clearSession();

		if (roundTimer) clearTimeout(roundTimer);
		if (resultsTimer) clearTimeout(resultsTimer);
		if (roundStartSyncTimer) clearTimeout(roundStartSyncTimer);

		if (hostNetwork) {
			hostNetwork.closeRoom();
			hostNetwork = null;
		}

		if (playerNetwork) {
			playerNetwork.leaveRoom();
			playerNetwork = null;
		}

		// Reset all state
		isHost = false;
		roomCode = null;
		connectionStatus = 'disconnected';
		connectionError = null;
		myPlayerId = null;
		phase = 'landing';
		players = [];
		currentRound = null;
		roundResults = [];
		playerScores = new Map();
		finalResults = null;
		currentImageData = null;
		resultsPhotoData = null;
		gamePhotoUrls = new Map();
		myGuess = null;
		guessCount = 0;
		timerStartTime = null;
		timerEndTime = null;
		hasConnectedPhotos = false;
		photoCount = 0;
		photos = [];

		internalState = createInitialState();
	}

	function setLogger(logger: Logger) {
		log = logger;
	}

	return {
		// Getters (reactive)
		get isHost() {
			return isHost;
		},
		get roomCode() {
			return roomCode;
		},
		get connectionStatus() {
			return connectionStatus;
		},
		get connectionError() {
			return connectionError;
		},
		get myPlayerId() {
			return myPlayerId;
		},
		get myName() {
			return myName;
		},
		get myEmoji() {
			return myEmoji;
		},
		get phase() {
			return phase;
		},
		get settings() {
			return settings;
		},
		get players() {
			return players;
		},
		get currentRound() {
			return currentRound;
		},
		get roundResults() {
			return roundResults;
		},
		get gamePhotoUrls() {
			return gamePhotoUrls;
		},
		get playerScores() {
			return playerScores;
		},
		get finalResults() {
			return finalResults;
		},
		get currentPhotoUrl() {
			// Return as data URL for use in <img src="">
			return currentImageData ? createDataUrl(currentImageData) : null;
		},
		get resultsPhotoUrl() {
			// Return as data URL for results screen
			return resultsPhotoData ? createDataUrl(resultsPhotoData) : null;
		},
		get myGuess() {
			return myGuess;
		},
		get guessCount() {
			return guessCount;
		},
		get timerStartTime() {
			return timerStartTime;
		},
		get timerEndTime() {
			return timerEndTime;
		},
		get hasConnectedPhotos() {
			return hasConnectedPhotos;
		},
		get photoCount() {
			return photoCount;
		},
		get isConnectingPhotos() {
			return isConnectingPhotos;
		},
		get photoError() {
			return photoError;
		},
		get photoLoadingProgress() {
			return photoLoadingProgress;
		},

		// Derived - use reactive `players` state, not `internalState.players`
		get canStartGame() {
			// Need at least 2 non-spectator players with photos
			const playersWithPhotos = players.filter(
				(p) => !p.isSpectator && p.photoIds.length >= MIN_PHOTOS_PER_PLAYER
			);
			// Inline allPlayersReady check using reactive players
			const allReady =
				players.length > 0 &&
				players.every((p) => {
					if (p.isSpectator) {
						return p.name.trim().length > 0 && p.isConnected;
					}
					return (
						p.name.trim().length > 0 && p.photoIds.length >= MIN_PHOTOS_PER_PLAYER && p.isConnected
					);
				});
			return isHost && playersWithPhotos.length >= 2 && allReady;
		},
		get playersWithPhotosCount() {
			return players.filter((p) => !p.isSpectator && p.photoIds.length >= MIN_PHOTOS_PER_PLAYER)
				.length;
		},
		get myPlayer() {
			return players.find((p) => p.id === myPlayerId) || null;
		},

		// Actions
		hostGame,
		joinGame,
		updateMyInfo,
		updateGameSettings,
		setSpectatorMode,
		connectPhotos,
		startGame,
		submitGuess,
		rematch,
		newGame,
		leaveGame,

		// Session persistence
		getPersistedSession,
		restoreAsPlayer,
		clearPersistedSession,

		kickPlayer: (playerId: PlayerId) => {
			if (!isHost) return;
			log('info', 'Kicking player', { playerId });

			// Send kick message and disconnect
			hostNetwork?.kickPlayer(playerId, 'Kicked by host');

			// Remove from internal state
			const playerIndex = internalState.players.findIndex((p) => p.id === playerId);
			if (playerIndex !== -1) {
				internalState.players.splice(playerIndex, 1);
			}

			// Remove their photos from the pool
			photos = photos.filter((p) => p.ownerId !== playerId);

			// Broadcast player left
			hostNetwork?.broadcastPlayerLeft(playerId);

			syncState();
		},
		setLogger,
	};
}

// Export singleton store
export const gameStore = createGameStore();
