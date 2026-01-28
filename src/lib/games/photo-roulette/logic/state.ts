/**
 * Game state machine for Photo Roulette
 */

import type {
	GamePhase,
	GameState,
	GameSettings,
	Player,
	Photo,
	PlayerId,
	PlayerScore,
} from './types.js';
import { DEFAULT_GAME_SETTINGS, MIN_PHOTOS_PER_PLAYER } from './constants.js';
import { createPhotoPool, selectRandomPhoto, createRound, completeRound } from './round.js';
import { calculateFinalScores, createEmptyPlayerScore } from './scoring.js';

/** Valid phase transitions */
const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
	landing: ['lobby'],
	lobby: ['playing'],
	playing: ['results'],
	results: ['playing', 'final'],
	final: ['lobby'],
};

/**
 * Check if a phase transition is valid
 */
export function isValidTransition(from: GamePhase, to: GamePhase): boolean {
	return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Create initial game state
 */
export function createInitialState(): GameState {
	return {
		phase: 'landing',
		settings: { ...DEFAULT_GAME_SETTINGS },
		players: [],
		photoPool: { available: [], used: [] },
		currentRound: null,
		roundResults: [],
		playerScores: new Map(),
	};
}

/**
 * Transition to lobby phase (host creates a game)
 */
export function transitionToLobby(state: GameState, hostPlayer: Player): GameState {
	if (!isValidTransition(state.phase, 'lobby')) {
		throw new Error(`Invalid transition from ${state.phase} to lobby`);
	}

	return {
		...state,
		phase: 'lobby',
		players: [{ ...hostPlayer, isHost: true }],
		photoPool: { available: [], used: [] },
		currentRound: null,
		roundResults: [],
		playerScores: new Map(),
	};
}

/**
 * Add a player to the lobby
 */
export function addPlayer(state: GameState, player: Player): GameState {
	if (state.phase !== 'lobby') {
		throw new Error('Can only add players in lobby phase');
	}

	if (state.players.some((p) => p.id === player.id)) {
		throw new Error('Player already exists');
	}

	return {
		...state,
		players: [...state.players, { ...player, isHost: false }],
	};
}

/**
 * Remove a player from the lobby
 */
export function removePlayer(state: GameState, playerId: PlayerId): GameState {
	if (state.phase !== 'lobby') {
		throw new Error('Can only remove players in lobby phase');
	}

	const player = state.players.find((p) => p.id === playerId);
	if (!player) {
		throw new Error('Player not found');
	}

	if (player.isHost) {
		throw new Error('Cannot remove host');
	}

	return {
		...state,
		players: state.players.filter((p) => p.id !== playerId),
	};
}

/**
 * Update player info (name, emoji, photos, ready state, spectator mode)
 */
export function updatePlayer(
	state: GameState,
	playerId: PlayerId,
	updates: Partial<
		Pick<Player, 'name' | 'emoji' | 'photoIds' | 'isReady' | 'isConnected' | 'isSpectator'>
	>
): GameState {
	const playerIndex = state.players.findIndex((p) => p.id === playerId);
	if (playerIndex === -1) {
		throw new Error('Player not found');
	}

	const updatedPlayers = [...state.players];
	updatedPlayers[playerIndex] = {
		...updatedPlayers[playerIndex],
		...updates,
	};

	return {
		...state,
		players: updatedPlayers,
	};
}

/**
 * Update game settings
 */
export function updateSettings(state: GameState, settings: Partial<GameSettings>): GameState {
	if (state.phase !== 'lobby') {
		throw new Error('Can only update settings in lobby phase');
	}

	return {
		...state,
		settings: {
			...state.settings,
			...settings,
		},
	};
}

/**
 * Check if a player is ready to start
 */
export function isPlayerReady(player: Player): boolean {
	// Spectators are ready as soon as they have a name and are connected
	if (player.isSpectator) {
		return player.name.trim().length > 0 && player.isConnected;
	}
	// Regular players need photos
	return (
		player.name.trim().length > 0 &&
		player.photoIds.length >= MIN_PHOTOS_PER_PLAYER &&
		player.isConnected
	);
}

/**
 * Check if all players are ready to start
 */
export function allPlayersReady(state: GameState): boolean {
	return state.players.length > 0 && state.players.every(isPlayerReady);
}

/**
 * Transition to playing phase (start the game)
 */
export function transitionToPlaying(
	state: GameState,
	photos: Photo[],
	startTime: number
): GameState {
	if (!isValidTransition(state.phase, 'playing')) {
		throw new Error(`Invalid transition from ${state.phase} to playing`);
	}

	if (!allPlayersReady(state)) {
		throw new Error('Not all players are ready');
	}

	const photoPool = createPhotoPool(photos);
	const selection = selectRandomPhoto(photoPool);

	if (!selection) {
		throw new Error('No photos available');
	}

	const playerScores = new Map<PlayerId, PlayerScore>();
	for (const player of state.players) {
		playerScores.set(player.id, createEmptyPlayerScore(player.id));
	}

	return {
		...state,
		phase: 'playing',
		photoPool: selection.updatedPool,
		currentRound: createRound(1, selection.photo, startTime),
		roundResults: [],
		playerScores,
	};
}

/**
 * Transition to results phase (round ended)
 */
export function transitionToResults(state: GameState): GameState {
	if (!isValidTransition(state.phase, 'results')) {
		throw new Error(`Invalid transition from ${state.phase} to results`);
	}

	if (!state.currentRound) {
		throw new Error('No current round');
	}

	const playerIds = state.players.map((p) => p.id);
	const roundResult = completeRound(state.currentRound, playerIds);

	// Update player scores
	const updatedScores = calculateFinalScores(playerIds, [...state.roundResults, roundResult]);

	return {
		...state,
		phase: 'results',
		roundResults: [...state.roundResults, roundResult],
		playerScores: updatedScores,
	};
}

/**
 * Start the next round or transition to final
 */
export function advanceFromResults(state: GameState, startTime: number): GameState {
	if (state.phase !== 'results') {
		throw new Error('Can only advance from results phase');
	}

	const completedRounds = state.roundResults.length;
	const totalRounds = state.settings.totalRounds;

	if (completedRounds >= totalRounds) {
		return transitionToFinal(state);
	}

	return startNextRound(state, startTime);
}

/**
 * Start the next round
 */
function startNextRound(state: GameState, startTime: number): GameState {
	if (!isValidTransition(state.phase, 'playing')) {
		throw new Error(`Invalid transition from ${state.phase} to playing`);
	}

	const selection = selectRandomPhoto(state.photoPool);

	if (!selection) {
		throw new Error('No photos available');
	}

	const nextRoundNumber = state.roundResults.length + 1;

	return {
		...state,
		phase: 'playing',
		photoPool: selection.updatedPool,
		currentRound: createRound(nextRoundNumber, selection.photo, startTime),
	};
}

/**
 * Transition to final phase (game over)
 */
export function transitionToFinal(state: GameState): GameState {
	if (!isValidTransition(state.phase, 'final')) {
		throw new Error(`Invalid transition from ${state.phase} to final`);
	}

	return {
		...state,
		phase: 'final',
		currentRound: null,
	};
}

/**
 * Start a rematch (same players, reshuffled photos)
 */
export function startRematch(state: GameState, photos: Photo[], startTime: number): GameState {
	if (state.phase !== 'final') {
		throw new Error('Can only start rematch from final phase');
	}

	// Reset to lobby first, then immediately start playing
	const lobbyState: GameState = {
		...state,
		phase: 'lobby',
		photoPool: { available: [], used: [] },
		currentRound: null,
		roundResults: [],
		playerScores: new Map(),
	};

	return transitionToPlaying(lobbyState, photos, startTime);
}

/**
 * Return to lobby for a new game
 */
export function transitionToNewGame(state: GameState): GameState {
	if (!isValidTransition(state.phase, 'lobby')) {
		throw new Error(`Invalid transition from ${state.phase} to lobby`);
	}

	// Keep players but reset their ready state
	const resetPlayers = state.players.map((p) => ({
		...p,
		photoIds: [],
		isReady: false,
	}));

	return {
		...state,
		phase: 'lobby',
		players: resetPlayers,
		photoPool: { available: [], used: [] },
		currentRound: null,
		roundResults: [],
		playerScores: new Map(),
	};
}

/**
 * Get current round number (1-indexed)
 */
export function getCurrentRoundNumber(state: GameState): number {
	if (state.currentRound) {
		return state.currentRound.roundNumber;
	}
	return state.roundResults.length;
}

/**
 * Check if game is in an active playing state
 */
export function isGameActive(state: GameState): boolean {
	return state.phase === 'playing' || state.phase === 'results';
}
