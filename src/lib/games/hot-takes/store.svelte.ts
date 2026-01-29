/**
 * Hot Takes game store
 * Manages all game state using Svelte 5 runes
 */

import type { PlayerId } from '$lib/common/networking/types.js';
import type { AnimalEmoji } from '$lib/common/types.js';
import type {
	HotTake,
	HotTakesPhase,
	HotTakesSettings,
	HotTakesPlayer,
	Vote,
	Guess,
	TakeResult,
	PlayerScore,
	FinalResults,
	CurrentRound,
} from './logic/types.js';
import { DEFAULT_HOT_TAKES_SETTINGS } from './logic/types.js';
import { allPlayersSubmitted } from './logic/state.js';
import { shuffleTakes, hasMoreTakes, createTakeResult } from './logic/round.js';
import {
	calculateAgreePercent,
	updateScoresForTake,
	initializeScores,
	getRankedPlayers,
} from './logic/scoring.js';
import { MIN_PLAYERS, REVEAL_DISPLAY_MS } from './logic/constants.js';
import { HotTakesHost } from './networking/host.js';
import { HotTakesPlayerNetwork } from './networking/player.js';

// ============================================
// Store State
// ============================================

/** Connection status */
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/** Role in the game */
type Role = 'none' | 'host' | 'player';

// Core state
let phase = $state<HotTakesPhase>('lobby');
let settings = $state<HotTakesSettings>({ ...DEFAULT_HOT_TAKES_SETTINGS });
let players = $state<HotTakesPlayer[]>([]);
let takes = $state<HotTake[]>([]);
let currentRound = $state<CurrentRound | null>(null);
let takeResults = $state<TakeResult[]>([]);
let playerScores = $state<Map<PlayerId, PlayerScore>>(new Map());

// Connection state
let role = $state<Role>('none');
let roomCode = $state<string | null>(null);
let connectionStatus = $state<ConnectionStatus>('disconnected');
let connectionError = $state<string | null>(null);
let myPlayerId = $state<PlayerId | null>(null);
let myName = $state<string>('');
let myEmoji = $state<AnimalEmoji>('🐰');

// Timer state
let timerEndTime = $state<number | null>(null);
let timerIntervalId: ReturnType<typeof setTimeout> | null = null;

// My submitted takes (local tracking)
let mySubmittedTakes = $state<Array<{ id: string; text: string }>>([]);

// Networking
let hostNetwork: HotTakesHost | null = null;
let playerNetwork: HotTakesPlayerNetwork | null = null;

// ============================================
// Derived State
// ============================================

const isHost = $derived(role === 'host');
const isPlayer = $derived(role === 'player');
const isConnected = $derived(connectionStatus === 'connected');
const myPlayer = $derived(players.find((p) => p.id === myPlayerId) ?? null);
const activePlayers = $derived(players.filter((p) => !p.isSpectator && p.isConnected));
const canStartGame = $derived(
	isHost &&
		phase === 'lobby' &&
		activePlayers.length >= MIN_PLAYERS &&
		activePlayers.every((p) => p.isReady)
);

const currentTake = $derived(currentRound?.currentTake ?? null);
const currentTakeFull = $derived(
	currentRound && takes.length > 0 ? (takes[currentRound.takeIndex] ?? null) : null
);

const isMyTake = $derived(currentTakeFull ? currentTakeFull.authorId === myPlayerId : false);

const myScore = $derived(myPlayerId ? (playerScores.get(myPlayerId) ?? null) : null);

const takeProgress = $derived({
	current: currentRound ? currentRound.takeIndex + 1 : 0,
	total: takes.length,
});

const hasSubmittedAllTakes = $derived(mySubmittedTakes.length >= settings.takesPerPlayer);

// ============================================
// Helper Functions
// ============================================

function generatePlayerId(): PlayerId {
	return `player-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateTakeId(): string {
	return `take-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function clearTimer(): void {
	if (timerIntervalId) {
		clearTimeout(timerIntervalId);
		timerIntervalId = null;
	}
	timerEndTime = null;
}

function startTimer(durationSeconds: number): void {
	clearTimer();
	timerEndTime = Date.now() + durationSeconds * 1000;

	// Set up auto-advance when timer expires (host only)
	if (role === 'host') {
		timerIntervalId = setTimeout(() => {
			handleTimerExpiry();
		}, durationSeconds * 1000);
	}
}

function handleTimerExpiry(): void {
	if (!isHost) return;

	if (phase === 'voting') {
		endVotingPhase();
	} else if (phase === 'guessing') {
		endGuessingPhase();
	}
}

function checkPhaseAdvancement(): void {
	if (!isHost || !currentRound) return;

	// Get currently connected active players
	const connectedActivePlayers = players.filter((p) => !p.isSpectator && p.isConnected);

	if (phase === 'voting') {
		const votedPlayerIds = new Set(currentRound.votes.map((v) => v.playerId));
		const allVoted = connectedActivePlayers.every((p) => votedPlayerIds.has(p.id));
		if (allVoted) {
			endVotingPhase();
		}
	} else if (phase === 'guessing') {
		const currentTakeData = takes[currentRound.takeIndex];
		const guessedPlayerIds = new Set(currentRound.guesses.map((g) => g.playerId));
		const playersWhoShouldGuess = connectedActivePlayers.filter(
			(p) => p.id !== currentTakeData?.authorId
		);
		const allGuessed = playersWhoShouldGuess.every((p) => guessedPlayerIds.has(p.id));
		if (allGuessed) {
			endGuessingPhase();
		}
	}
}

// ============================================
// Host Functions
// ============================================

async function hostGame(name: string, emoji: AnimalEmoji): Promise<void> {
	if (role !== 'none') return;

	connectionStatus = 'connecting';
	connectionError = null;
	role = 'host';
	myName = name;
	myEmoji = emoji;
	myPlayerId = generatePlayerId();

	// Create host player
	const hostPlayer: HotTakesPlayer = {
		id: myPlayerId,
		name,
		emoji,
		isReady: true, // Host is always ready
		isSpectator: false,
		takeIds: [],
		isConnected: true,
	};
	players = [hostPlayer];

	// Initialize network
	hostNetwork = new HotTakesHost(myPlayerId);
	setupHostEvents();

	try {
		roomCode = await hostNetwork.createRoom();
		connectionStatus = 'connected';
	} catch (error) {
		connectionStatus = 'error';
		connectionError = (error as Error).message;
		cleanup();
		throw error;
	}
}

function setupHostEvents(): void {
	if (!hostNetwork) return;

	hostNetwork.on('playerJoinRequest', (peerId, name, emoji, accept, reject) => {
		if (phase !== 'lobby') {
			reject('game-in-progress');
			return;
		}

		if (activePlayers.length >= 8) {
			reject('room-full');
			return;
		}

		const newPlayerId = generatePlayerId();
		accept(newPlayerId);

		const newPlayer: HotTakesPlayer = {
			id: newPlayerId,
			name,
			emoji,
			isReady: false,
			isSpectator: false,
			takeIds: [],
			isConnected: true,
		};

		players = [...players, newPlayer];

		// Send join accepted
		hostNetwork!.sendJoinAccepted(peerId, newPlayerId, players, settings, phase);

		// Broadcast player update to all existing players
		hostNetwork!.broadcastPlayerUpdate(newPlayerId, {
			name,
			emoji,
			isReady: false,
			isSpectator: false,
		});
	});

	hostNetwork.on('playerUpdate', (playerId, updates) => {
		players = players.map((p) => (p.id === playerId ? { ...p, ...updates } : p));
		hostNetwork!.broadcastPlayerUpdate(playerId, updates);
	});

	hostNetwork.on('playerDisconnected', (playerId) => {
		players = players.map((p) => (p.id === playerId ? { ...p, isConnected: false } : p));
		hostNetwork!.broadcastPlayerLeft(playerId);

		// Check if we should advance the phase now that a player disconnected
		checkPhaseAdvancement();
	});

	hostNetwork.on('playerReconnected', (playerId) => {
		players = players.map((p) => (p.id === playerId ? { ...p, isConnected: true } : p));
		// Send state sync
		hostNetwork!.sendStateSync(
			playerId,
			phase,
			settings,
			players,
			currentRound,
			takeResults,
			playerScores
		);
	});

	hostNetwork.on('takeSubmitted', (playerId, take) => {
		// Add the take with author
		const fullTake: HotTake = {
			...take,
			authorId: playerId,
		};
		takes = [...takes, fullTake];

		// Update player's take IDs
		players = players.map((p) =>
			p.id === playerId ? { ...p, takeIds: [...p.takeIds, take.id] } : p
		);

		// Check if all players have submitted
		const state = { phase, settings, players, takes, currentRound, takeResults, playerScores };
		if (allPlayersSubmitted(state)) {
			startVotingPhase();
		}
	});

	hostNetwork.on('voteReceived', (vote) => {
		if (!currentRound) return;

		currentRound = {
			...currentRound,
			votes: [...currentRound.votes, vote],
		};

		// Check if all players have voted
		const votedPlayerIds = new Set(currentRound.votes.map((v) => v.playerId));
		const allVoted = activePlayers.every((p) => votedPlayerIds.has(p.id));

		if (allVoted) {
			endVotingPhase();
		}
	});

	hostNetwork.on('guessReceived', (guess) => {
		if (!currentRound) return;

		currentRound = {
			...currentRound,
			guesses: [...currentRound.guesses, guess],
		};

		// Check if all players (except author) have guessed
		const currentTakeData = takes[currentRound.takeIndex];
		const guessedPlayerIds = new Set(currentRound.guesses.map((g) => g.playerId));
		const playersWhoShouldGuess = activePlayers.filter((p) => p.id !== currentTakeData?.authorId);
		const allGuessed = playersWhoShouldGuess.every((p) => guessedPlayerIds.has(p.id));

		if (allGuessed) {
			endGuessingPhase();
		}
	});

	hostNetwork.on('error', (error) => {
		console.error('Host network error:', error);
		connectionError = error.message;
	});
}

function updateSettings(newSettings: Partial<HotTakesSettings>): void {
	if (!isHost || phase !== 'lobby') return;

	settings = { ...settings, ...newSettings };
	hostNetwork?.broadcastSettingsChange(settings);
}

function startGame(): void {
	if (!isHost || !canStartGame) return;

	phase = 'submitting';
	playerScores = initializeScores(players);
	mySubmittedTakes = [];

	hostNetwork?.broadcastGameStarting(players, settings);
}

function startVotingPhase(): void {
	if (!isHost) return;

	// Shuffle takes
	takes = shuffleTakes(takes);

	// Create initial round
	const firstTake = takes[0];
	currentRound = {
		takeIndex: 0,
		currentTake: firstTake ? { id: firstTake.id, text: firstTake.text } : null,
		phaseStartTime: Date.now(),
		votes: [],
		guesses: [],
	};

	phase = 'voting';

	// Broadcast all takes ready
	hostNetwork?.broadcastAllTakesReady(takes.length);

	// Start voting for first take
	if (currentRound.currentTake) {
		hostNetwork?.broadcastVotingStart(
			currentRound.currentTake,
			0,
			takes.length,
			settings.votingTimeSeconds
		);
		startTimer(settings.votingTimeSeconds);
	}
}

function endVotingPhase(): void {
	if (!isHost || !currentRound || !currentRound.currentTake) return;

	clearTimer();

	const votes = currentRound.votes;
	const agreePercent = calculateAgreePercent(votes);
	const takeId = currentRound.currentTake.id;

	hostNetwork?.broadcastVotingEnd(takeId, votes, agreePercent);

	// Move to guessing phase
	phase = 'guessing';
	currentRound = {
		...currentRound,
		phaseStartTime: Date.now(),
	};

	hostNetwork?.broadcastGuessingStart(takeId, votes, agreePercent, settings.guessingTimeSeconds);
	startTimer(settings.guessingTimeSeconds);
}

function endGuessingPhase(): void {
	if (!isHost || !currentRound || !currentRound.currentTake) return;

	clearTimer();

	// Create result
	const state = { phase, settings, players, takes, currentRound, takeResults, playerScores };
	const result = createTakeResult(state);

	if (result) {
		// Update scores
		playerScores = updateScoresForTake(playerScores, result);
		takeResults = [...takeResults, result];

		// Get author info
		const author = players.find((p) => p.id === result.authorId);

		// Move to reveal phase
		phase = 'reveal';
		hostNetwork?.broadcastTakeReveal(
			result,
			author?.name ?? 'Unknown',
			author?.emoji ?? '?',
			playerScores
		);

		// Auto-advance after delay
		setTimeout(() => {
			if (
				hasMoreTakes({ phase, settings, players, takes, currentRound, takeResults, playerScores })
			) {
				advanceToNextTakePhase();
			} else {
				endGame();
			}
		}, REVEAL_DISPLAY_MS);
	}
}

function advanceToNextTakePhase(): void {
	if (!isHost || !currentRound) return;

	const nextIndex = currentRound.takeIndex + 1;
	const nextTake = takes[nextIndex];

	if (!nextTake) {
		endGame();
		return;
	}

	currentRound = {
		takeIndex: nextIndex,
		currentTake: { id: nextTake.id, text: nextTake.text },
		phaseStartTime: Date.now(),
		votes: [],
		guesses: [],
	};

	phase = 'voting';

	hostNetwork?.broadcastVotingStart(
		currentRound.currentTake!,
		nextIndex,
		takes.length,
		settings.votingTimeSeconds
	);
	startTimer(settings.votingTimeSeconds);
}

function endGame(): void {
	if (!isHost) return;

	clearTimer();
	phase = 'final';

	// Calculate final results
	const rankings = getRankedPlayers(players, playerScores);

	// Find special takes
	const sortedByControversy = [...takeResults].sort(
		(a, b) => Math.abs(50 - a.agreePercent) - Math.abs(50 - b.agreePercent)
	);
	const sortedByAgree = [...takeResults].sort((a, b) => b.agreePercent - a.agreePercent);
	const sortedByDisagree = [...takeResults].sort((a, b) => a.agreePercent - b.agreePercent);

	const finalResults: FinalResults = {
		rankings,
		mostControversialTake: sortedByControversy[0] ?? null,
		mostAgreedTake: sortedByAgree[0] ?? null,
		mostDisagreedTake: sortedByDisagree[0] ?? null,
		allResults: takeResults,
	};

	hostNetwork?.broadcastGameEnd(finalResults);
}

// ============================================
// Player Functions
// ============================================

async function joinGame(code: string, name: string, emoji: AnimalEmoji): Promise<void> {
	if (role !== 'none') return;

	connectionStatus = 'connecting';
	connectionError = null;
	role = 'player';
	myName = name;
	myEmoji = emoji;
	roomCode = code;

	playerNetwork = new HotTakesPlayerNetwork();
	setupPlayerEvents();

	try {
		await playerNetwork.joinRoom(code, name, emoji);
	} catch (error) {
		connectionStatus = 'error';
		connectionError = (error as Error).message;
		cleanup();
		throw error;
	}
}

function setupPlayerEvents(): void {
	if (!playerNetwork) return;

	playerNetwork.on('joined', (playerId, allPlayers, gameSettings, gamePhase) => {
		myPlayerId = playerId;
		players = allPlayers;
		settings = gameSettings;
		phase = gamePhase;
		connectionStatus = 'connected';
	});

	playerNetwork.on('joinRejected', (reason) => {
		connectionStatus = 'error';
		// Save the error before cleanup clears it
		const errorMessage = reason === 'game-in-progress'
			? 'Cannot join - game already in progress'
			: reason === 'room-full'
				? 'Cannot join - room is full'
				: reason;
		cleanup();
		connectionError = errorMessage;
	});

	playerNetwork.on('disconnected', () => {
		connectionStatus = 'reconnecting';
	});

	playerNetwork.on('reconnected', () => {
		connectionStatus = 'connected';
	});

	playerNetwork.on('kicked', (reason) => {
		connectionError = reason ?? 'You were kicked from the game';
		cleanup();
	});

	playerNetwork.on('playerUpdate', (playerId, updates) => {
		players = players.map((p) => (p.id === playerId ? { ...p, ...updates } : p));
	});

	playerNetwork.on('playerLeft', (playerId) => {
		players = players.map((p) => (p.id === playerId ? { ...p, isConnected: false } : p));
	});

	playerNetwork.on('playerReconnected', (playerId) => {
		players = players.map((p) => (p.id === playerId ? { ...p, isConnected: true } : p));
	});

	playerNetwork.on('settingsChanged', (newSettings) => {
		settings = newSettings;
	});

	playerNetwork.on('gameStarting', (allPlayers, gameSettings) => {
		players = allPlayers;
		settings = gameSettings;
		phase = 'submitting';
		mySubmittedTakes = [];
	});

	playerNetwork.on('allTakesReady', (_totalTakes) => {
		// Takes are ready, waiting for voting to start
	});

	playerNetwork.on('votingStart', (take, takeIndex, totalTakes, startTime, votingTimeSeconds) => {
		currentRound = {
			takeIndex,
			currentTake: take,
			phaseStartTime: startTime,
			votes: [],
			guesses: [],
		};
		phase = 'voting';
		startTimer(votingTimeSeconds);
	});

	playerNetwork.on('votingEnd', (_takeId, votes, _agreePercent) => {
		if (currentRound) {
			currentRound = { ...currentRound, votes };
		}
	});

	playerNetwork.on(
		'guessingStart',
		(_takeId, votes, _agreePercent, startTime, guessingTimeSeconds) => {
			if (currentRound) {
				currentRound = { ...currentRound, votes, phaseStartTime: startTime };
			}
			phase = 'guessing';
			startTimer(guessingTimeSeconds);
		}
	);

	playerNetwork.on('takeReveal', (result, _authorName, _authorEmoji, scores) => {
		clearTimer();
		phase = 'reveal';
		takeResults = [...takeResults, result];
		playerScores = scores;
	});

	playerNetwork.on('gameEnd', (_finalResults) => {
		clearTimer();
		phase = 'final';
	});

	playerNetwork.on(
		'stateSync',
		(syncPhase, syncSettings, syncPlayers, syncRound, syncResults, syncScores) => {
			phase = syncPhase;
			settings = syncSettings;
			players = syncPlayers;
			currentRound = syncRound;
			takeResults = syncResults;
			playerScores = syncScores;
		}
	);

	playerNetwork.on('error', (error) => {
		console.error('Player network error:', error);
		connectionError = error.message;
	});
}

function updateMyInfo(
	updates: Partial<Pick<HotTakesPlayer, 'name' | 'emoji' | 'isReady' | 'isSpectator'>>
): void {
	if (isHost) {
		// Host updates locally and broadcasts
		if (myPlayerId) {
			players = players.map((p) => (p.id === myPlayerId ? { ...p, ...updates } : p));
			hostNetwork?.broadcastPlayerUpdate(myPlayerId, updates);
		}
	} else {
		// Player sends update to host
		playerNetwork?.sendPlayerUpdate(updates);
	}

	if (updates.name !== undefined) myName = updates.name;
	if (updates.emoji !== undefined) myEmoji = updates.emoji as AnimalEmoji;
}

function submitTake(text: string): void {
	if (phase !== 'submitting' || hasSubmittedAllTakes) return;

	const take = {
		id: generateTakeId(),
		text: text.trim(),
	};

	mySubmittedTakes = [...mySubmittedTakes, take];

	if (isHost) {
		// Host adds directly
		const fullTake: HotTake = {
			...take,
			authorId: myPlayerId!,
		};
		takes = [...takes, fullTake];
		players = players.map((p) =>
			p.id === myPlayerId ? { ...p, takeIds: [...p.takeIds, take.id] } : p
		);

		// Check if all submitted
		const state = { phase, settings, players, takes, currentRound, takeResults, playerScores };
		if (allPlayersSubmitted(state)) {
			startVotingPhase();
		}
	} else {
		playerNetwork?.sendTake(take);
	}
}

function submitVote(vote: 'agree' | 'disagree'): void {
	if (phase !== 'voting' || !currentRound?.currentTake) return;

	const takeId = currentRound.currentTake.id;

	if (isHost) {
		const voteData: Vote = {
			playerId: myPlayerId!,
			takeId,
			vote,
		};
		currentRound = {
			...currentRound,
			votes: [...currentRound.votes, voteData],
		};

		// Check if all voted
		const votedPlayerIds = new Set(currentRound.votes.map((v) => v.playerId));
		const allVoted = activePlayers.every((p) => votedPlayerIds.has(p.id));

		if (allVoted) {
			endVotingPhase();
		}
	} else {
		playerNetwork?.sendVote(takeId, vote);
	}
}

function submitGuess(guessedAuthorId: PlayerId): void {
	if (phase !== 'guessing' || !currentRound?.currentTake || isMyTake) return;

	const takeId = currentRound.currentTake.id;

	if (isHost) {
		const guessData: Guess = {
			playerId: myPlayerId!,
			takeId,
			guessedAuthorId,
		};
		currentRound = {
			...currentRound,
			guesses: [...currentRound.guesses, guessData],
		};

		// Check if all guessed
		const currentTakeData = takes[currentRound.takeIndex];
		const guessedPlayerIds = new Set(currentRound.guesses.map((g) => g.playerId));
		const playersWhoShouldGuess = activePlayers.filter((p) => p.id !== currentTakeData?.authorId);
		const allGuessed = playersWhoShouldGuess.every((p) => guessedPlayerIds.has(p.id));

		if (allGuessed) {
			endGuessingPhase();
		}
	} else {
		playerNetwork?.sendGuess(takeId, guessedAuthorId);
	}
}

function leaveGame(): void {
	if (isPlayer) {
		playerNetwork?.leaveRoom();
	} else if (isHost) {
		hostNetwork?.closeRoom();
	}
	cleanup();
}

function playAgain(): void {
	if (!isHost) return;

	// Reset game state but keep players
	phase = 'lobby';
	takes = [];
	currentRound = null;
	takeResults = [];
	playerScores = new Map();
	mySubmittedTakes = [];

	// Reset player ready states and take IDs
	players = players.map((p) => ({ ...p, isReady: p.id === myPlayerId, takeIds: [] }));
}

function cleanup(): void {
	clearTimer();
	hostNetwork?.closeRoom();
	playerNetwork?.leaveRoom();
	hostNetwork = null;
	playerNetwork = null;

	// Reset state
	phase = 'lobby';
	settings = { ...DEFAULT_HOT_TAKES_SETTINGS };
	players = [];
	takes = [];
	currentRound = null;
	takeResults = [];
	playerScores = new Map();
	role = 'none';
	roomCode = null;
	connectionStatus = 'disconnected';
	connectionError = null;
	myPlayerId = null;
	mySubmittedTakes = [];
}

// ============================================
// Export Store
// ============================================

export const hotTakesStore = {
	// State getters
	get phase() {
		return phase;
	},
	get settings() {
		return settings;
	},
	get players() {
		return players;
	},
	get takes() {
		return takes;
	},
	get currentRound() {
		return currentRound;
	},
	get takeResults() {
		return takeResults;
	},
	get playerScores() {
		return playerScores;
	},
	get role() {
		return role;
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
	get timerEndTime() {
		return timerEndTime;
	},
	get mySubmittedTakes() {
		return mySubmittedTakes;
	},

	// Derived getters
	get isHost() {
		return isHost;
	},
	get isPlayer() {
		return isPlayer;
	},
	get isConnected() {
		return isConnected;
	},
	get myPlayer() {
		return myPlayer;
	},
	get activePlayers() {
		return activePlayers;
	},
	get canStartGame() {
		return canStartGame;
	},
	get currentTake() {
		return currentTake;
	},
	get currentTakeFull() {
		return currentTakeFull;
	},
	get isMyTake() {
		return isMyTake;
	},
	get myScore() {
		return myScore;
	},
	get takeProgress() {
		return takeProgress;
	},
	get hasSubmittedAllTakes() {
		return hasSubmittedAllTakes;
	},

	// Actions
	hostGame,
	joinGame,
	updateSettings,
	startGame,
	updateMyInfo,
	submitTake,
	submitVote,
	submitGuess,
	leaveGame,
	playAgain,
	cleanup,
};
