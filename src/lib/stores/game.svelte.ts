/**
 * Game state store - orchestrates game logic, networking, and UI
 *
 * This is the central state manager that coordinates between:
 * - Game logic (pure functions from $lib/game)
 * - Networking (PeerJS host/player)
 * - Photos (Google Photos picker)
 */

import { HostNetwork } from '$lib/networking/host.js';
import { PlayerNetwork } from '$lib/networking/player.js';
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
} from '$lib/game/types.js';
import {
	DEFAULT_GAME_SETTINGS,
	ROUND_RESULT_DISPLAY_MS,
	ANIMAL_EMOJIS,
} from '$lib/game/constants.js';
import {
	createInitialState,
	addPlayer,
	updatePlayer,
	updateSettings,
	transitionToLobby,
	transitionToFinal,
	allPlayersReady,
	transitionToNewGame,
} from '$lib/game/state.js';
import {
	createPhotoPool,
	selectRandomPhoto,
	createRound,
	addGuess,
	completeRound,
	allPlayersGuessed,
} from '$lib/game/round.js';
import {
	processPickedPhotos,
	createDataUrl,
	isTestPlayer,
	generateTestPhotos,
	type ProcessedImage,
} from '$lib/photos/index.js';
import { getRankedScores, determineWinner, createEmptyPlayerScore } from '$lib/game/scoring.js';
import { calculateSuperlatives } from '$lib/game/superlatives.js';

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
	let hostNetwork: HostNetwork | null = null;
	let playerNetwork: PlayerNetwork | null = null;
	let roundTimer: ReturnType<typeof setTimeout> | null = null;
	let resultsTimer: ReturnType<typeof setTimeout> | null = null;

	// Logger (can be overridden)
	let log: Logger = defaultLogger;

	// Internal game state (authoritative on host)
	let internalState: GameState = createInitialState();
	let photos: Photo[] = [];

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
	let myGuess = $state<PlayerId | null>(null);
	let guessCount = $state(0);
	let timerStartTime = $state<number | null>(null);
	let timerEndTime = $state<number | null>(null);

	let hasConnectedPhotos = $state(false);
	let photoCount = $state(0);
	let isConnectingPhotos = $state(false);
	let photoError = $state<string | null>(null);

	// Sync state from internal to reactive
	function syncState() {
		phase = internalState.phase;
		settings = internalState.settings;
		players = [...internalState.players];
		currentRound = internalState.currentRound;
		roundResults = [...internalState.roundResults];
		playerScores = new Map(internalState.playerScores);
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
		};

		// Initialize game state - transitionToLobby adds the host player
		internalState = createInitialState();
		internalState = transitionToLobby(internalState, hostPlayer);

		// Create host network
		hostNetwork = new HostNetwork(hostPlayerId);
		setupHostEvents();

		try {
			const code = await hostNetwork.createRoom();
			roomCode = code;
			connectionStatus = 'connected';
			syncState();
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
			internalState = updatePlayer(internalState, playerId, {
				isReady: photoIds.length >= 15,
			});

			// Store photos in pool
			for (const photo of submittedPhotos) {
				if (!photos.find((p) => p.id === photo.id)) {
					photos.push(photo);
				}
			}

			// Update player's photoIds in state
			const player = internalState.players.find((p) => p.id === playerId);
			if (player) {
				player.photoIds = photoIds;
			}

			hostNetwork!.broadcastPlayerUpdate(playerId, { isReady: photoIds.length >= 15 });
			syncState();
		});

		hostNetwork.on('guessReceived', (playerId, guess) => {
			log('debug', 'Guess received', { playerId, guessedOwnerId: guess.guessedOwnerId });

			if (!internalState.currentRound) return;

			internalState.currentRound = addGuess(internalState.currentRound, guess);
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

		playerNetwork = new PlayerNetwork();
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
		});

		playerNetwork.on('roundStart', (roundNumber, imageData, _photoId, startTime) => {
			log('info', 'Round started', { roundNumber });
			currentImageData = imageData;
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
		});

		playerNetwork.on('roundEnd', (result, scores) => {
			log('info', 'Round ended', { roundNumber: result.roundNumber });
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
			log('debug', 'State sync received');
			if (state.phase) phase = state.phase;
			if (state.settings) settings = state.settings;
			if (state.players) players = state.players;
			if (state.playerScores) playerScores = state.playerScores;
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

	async function connectPhotos(
		pickerFn: () => Promise<{ photos: Array<{ id: string; baseUrl: string }> }>
	) {
		log('info', 'Connecting photos');
		isConnectingPhotos = true;
		photoError = null;

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
			photos = pickedPhotos;

			log('info', 'Photos processed', { count: pickedPhotos.length });

			if (isHost && myPlayerId) {
				// Update host's own photos
				const player = internalState.players.find((p) => p.id === myPlayerId);
				if (player) {
					player.photoIds = pickedPhotos.map((p) => p.id);
					player.isReady = pickedPhotos.length >= 15;
				}
				syncState();
			} else if (playerNetwork && myPlayerId) {
				// Send to host (with imageData included)
				playerNetwork.sendPhotos(pickedPhotos);
			}
		} catch (error) {
			photoError = error instanceof Error ? error.message : 'Failed to connect photos';
			log('error', 'Failed to connect photos', { error });
		} finally {
			isConnectingPhotos = false;
		}
	}

	function startGame() {
		if (!isHost) return;
		if (!allPlayersReady(internalState)) {
			log('warn', 'Cannot start game - not all players ready');
			return;
		}

		log('info', 'Starting game');

		// Create photo pool from all players' photos
		internalState.photoPool = createPhotoPool(photos);

		// Initialize player scores
		for (const player of internalState.players) {
			internalState.playerScores.set(player.id, createEmptyPlayerScore(player.id));
		}

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

		// Select photo
		const selection = selectRandomPhoto(internalState.photoPool);
		if (!selection) {
			log('error', 'No photos available');
			return;
		}

		internalState.photoPool = selection.updatedPool;
		const photo = selection.photo;

		// Ensure photo has imageData
		if (!photo.imageData) {
			log('error', 'Photo missing imageData', { photoId: photo.id });
			return;
		}

		// Create round
		const startTime = Date.now();
		const round = createRound(internalState.roundResults.length + 1, photo, startTime);
		internalState.currentRound = round;

		// Set local state - use imageData instead of URL
		currentImageData = photo.imageData;
		currentRound = round;
		timerStartTime = round.startTime;
		timerEndTime = round.startTime + internalState.settings.timerSeconds * 1000;
		myGuess = null;
		guessCount = 0;

		// Broadcast round start with imageData
		hostNetwork?.broadcastRoundStart(round.roundNumber, photo.imageData, photo.id, round.startTime);

		syncState();

		// Start timer
		if (roundTimer) clearTimeout(roundTimer);
		roundTimer = setTimeout(() => {
			endRound();
		}, internalState.settings.timerSeconds * 1000);
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
				internalState.currentRound = addGuess(internalState.currentRound, guess);
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
			}, ROUND_RESULT_DISPLAY_MS);
		} else {
			// Schedule next round
			resultsTimer = setTimeout(() => {
				internalState.phase = 'playing';
				startNextRoundInternal();
			}, ROUND_RESULT_DISPLAY_MS);
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

		finalResults = null;
		roundResults = [];
		playerScores = new Map();

		hostNetwork?.broadcastGameStarting(internalState.players, internalState.settings);
		startNextRoundInternal();
	}

	function newGame() {
		if (!isHost) return;

		log('info', 'Starting new game');

		internalState = transitionToNewGame(internalState);
		finalResults = null;
		roundResults = [];
		playerScores = new Map();
		currentRound = null;
		currentImageData = null;

		syncState();
	}

	function leaveGame() {
		log('info', 'Leaving game');

		if (roundTimer) clearTimeout(roundTimer);
		if (resultsTimer) clearTimeout(resultsTimer);

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

		// Derived
		get canStartGame() {
			return isHost && players.length >= 2 && allPlayersReady(internalState);
		},
		get myPlayer() {
			return players.find((p) => p.id === myPlayerId) || null;
		},

		// Actions
		hostGame,
		joinGame,
		updateMyInfo,
		updateGameSettings,
		connectPhotos,
		startGame,
		submitGuess,
		rematch,
		newGame,
		leaveGame,
		setLogger,
	};
}

// Export singleton store
export const gameStore = createGameStore();
