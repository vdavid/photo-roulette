import { describe, it, expect } from 'vitest';
import {
	createInitialState,
	isValidTransition,
	allPlayersSubmitted,
	allPlayersVoted,
	allPlayersGuessed,
	getSubmissionCount,
	hasPlayerVoted,
	hasPlayerGuessed,
	addVote,
	addGuess,
	getActivePlayerCount,
	isCurrentTakeAuthor,
	updatePlayer,
} from './state.js';
import type { HotTakesGameState, HotTakesPlayer, Vote, Guess } from './types.js';
import { DEFAULT_HOT_TAKES_SETTINGS } from './types.js';

// Helper to create test state
function createTestState(overrides: Partial<HotTakesGameState> = {}): HotTakesGameState {
	return {
		phase: 'lobby',
		settings: { ...DEFAULT_HOT_TAKES_SETTINGS },
		players: [],
		takes: [],
		currentRound: null,
		takeResults: [],
		playerScores: new Map(),
		...overrides,
	};
}

// Helper to create test player
function createTestPlayer(id: string, overrides: Partial<HotTakesPlayer> = {}): HotTakesPlayer {
	return {
		id,
		name: `Player ${id}`,
		emoji: '🐰',
		isReady: true,
		isSpectator: false,
		takeIds: [],
		isConnected: true,
		...overrides,
	};
}

describe('createInitialState', () => {
	it('should create state with default settings', () => {
		const state = createInitialState();

		expect(state.phase).toBe('lobby');
		expect(state.settings).toEqual(DEFAULT_HOT_TAKES_SETTINGS);
		expect(state.players).toEqual([]);
		expect(state.takes).toEqual([]);
		expect(state.currentRound).toBeNull();
		expect(state.takeResults).toEqual([]);
		expect(state.playerScores.size).toBe(0);
	});

	it('should allow partial settings override', () => {
		const state = createInitialState({ takesPerPlayer: 3 });

		expect(state.settings.takesPerPlayer).toBe(3);
		expect(state.settings.votingTimeSeconds).toBe(DEFAULT_HOT_TAKES_SETTINGS.votingTimeSeconds);
	});
});

describe('isValidTransition', () => {
	it('should allow lobby -> submitting', () => {
		expect(isValidTransition('lobby', 'submitting')).toBe(true);
	});

	it('should allow submitting -> voting', () => {
		expect(isValidTransition('submitting', 'voting')).toBe(true);
	});

	it('should allow voting -> guessing', () => {
		expect(isValidTransition('voting', 'guessing')).toBe(true);
	});

	it('should allow guessing -> reveal', () => {
		expect(isValidTransition('guessing', 'reveal')).toBe(true);
	});

	it('should allow reveal -> voting (next take)', () => {
		expect(isValidTransition('reveal', 'voting')).toBe(true);
	});

	it('should allow reveal -> final (game end)', () => {
		expect(isValidTransition('reveal', 'final')).toBe(true);
	});

	it('should allow final -> lobby (restart)', () => {
		expect(isValidTransition('final', 'lobby')).toBe(true);
	});

	it('should disallow invalid transitions', () => {
		expect(isValidTransition('lobby', 'voting')).toBe(false);
		expect(isValidTransition('voting', 'submitting')).toBe(false);
		expect(isValidTransition('final', 'voting')).toBe(false);
	});
});

describe('allPlayersSubmitted', () => {
	it('should return true when all active players have submitted required takes', () => {
		const state = createTestState({
			settings: { ...DEFAULT_HOT_TAKES_SETTINGS, takesPerPlayer: 2 },
			players: [
				createTestPlayer('p1', { takeIds: ['t1', 't2'] }),
				createTestPlayer('p2', { takeIds: ['t3', 't4'] }),
			],
		});

		expect(allPlayersSubmitted(state)).toBe(true);
	});

	it('should return false when some players have not submitted enough takes', () => {
		const state = createTestState({
			settings: { ...DEFAULT_HOT_TAKES_SETTINGS, takesPerPlayer: 2 },
			players: [
				createTestPlayer('p1', { takeIds: ['t1', 't2'] }),
				createTestPlayer('p2', { takeIds: ['t3'] }), // Only 1 take
			],
		});

		expect(allPlayersSubmitted(state)).toBe(false);
	});

	it('should ignore spectators', () => {
		const state = createTestState({
			settings: { ...DEFAULT_HOT_TAKES_SETTINGS, takesPerPlayer: 2 },
			players: [
				createTestPlayer('p1', { takeIds: ['t1', 't2'] }),
				createTestPlayer('spectator', { isSpectator: true, takeIds: [] }),
			],
		});

		expect(allPlayersSubmitted(state)).toBe(true);
	});

	it('should ignore disconnected players', () => {
		const state = createTestState({
			settings: { ...DEFAULT_HOT_TAKES_SETTINGS, takesPerPlayer: 2 },
			players: [
				createTestPlayer('p1', { takeIds: ['t1', 't2'] }),
				createTestPlayer('disconnected', { isConnected: false, takeIds: [] }),
			],
		});

		expect(allPlayersSubmitted(state)).toBe(true);
	});
});

describe('allPlayersVoted', () => {
	it('should return true when all active players have voted', () => {
		const state = createTestState({
			players: [createTestPlayer('p1'), createTestPlayer('p2')],
			currentRound: {
				takeIndex: 0,
				currentTake: { id: 't1', text: 'Test' },
				phaseStartTime: Date.now(),
				votes: [
					{ playerId: 'p1', takeId: 't1', vote: 'agree' },
					{ playerId: 'p2', takeId: 't1', vote: 'disagree' },
				],
				guesses: [],
			},
		});

		expect(allPlayersVoted(state, 't1')).toBe(true);
	});

	it('should return false when some players have not voted', () => {
		const state = createTestState({
			players: [createTestPlayer('p1'), createTestPlayer('p2')],
			currentRound: {
				takeIndex: 0,
				currentTake: { id: 't1', text: 'Test' },
				phaseStartTime: Date.now(),
				votes: [{ playerId: 'p1', takeId: 't1', vote: 'agree' }],
				guesses: [],
			},
		});

		expect(allPlayersVoted(state, 't1')).toBe(false);
	});

	it('should return false when no currentRound', () => {
		const state = createTestState({
			players: [createTestPlayer('p1')],
		});

		expect(allPlayersVoted(state, 't1')).toBe(false);
	});
});

describe('allPlayersGuessed', () => {
	it('should return true when all eligible players have guessed (excluding author)', () => {
		const state = createTestState({
			players: [createTestPlayer('author'), createTestPlayer('p1'), createTestPlayer('p2')],
			takes: [{ id: 't1', text: 'Test', authorId: 'author' }],
			currentRound: {
				takeIndex: 0,
				currentTake: { id: 't1', text: 'Test' },
				phaseStartTime: Date.now(),
				votes: [],
				guesses: [
					{ playerId: 'p1', takeId: 't1', guessedAuthorId: 'author' },
					{ playerId: 'p2', takeId: 't1', guessedAuthorId: 'author' },
				],
			},
		});

		expect(allPlayersGuessed(state, 't1')).toBe(true);
	});

	it('should exclude the author from guessing requirement', () => {
		const state = createTestState({
			players: [createTestPlayer('author'), createTestPlayer('p1')],
			takes: [{ id: 't1', text: 'Test', authorId: 'author' }],
			currentRound: {
				takeIndex: 0,
				currentTake: { id: 't1', text: 'Test' },
				phaseStartTime: Date.now(),
				votes: [],
				guesses: [{ playerId: 'p1', takeId: 't1', guessedAuthorId: 'author' }],
			},
		});

		// Only p1 needs to guess (author excluded)
		expect(allPlayersGuessed(state, 't1')).toBe(true);
	});
});

describe('getSubmissionCount', () => {
	it('should return correct counts', () => {
		const state = createTestState({
			settings: { ...DEFAULT_HOT_TAKES_SETTINGS, takesPerPlayer: 2 },
			players: [
				createTestPlayer('p1', { takeIds: ['t1', 't2'] }), // Complete
				createTestPlayer('p2', { takeIds: ['t3'] }), // Incomplete
				createTestPlayer('p3', { takeIds: [] }), // Not started
			],
		});

		const { submitted, total } = getSubmissionCount(state);
		expect(submitted).toBe(1);
		expect(total).toBe(3);
	});
});

describe('hasPlayerVoted', () => {
	it('should return true if player has voted on current take', () => {
		const state = createTestState({
			currentRound: {
				takeIndex: 0,
				currentTake: { id: 't1', text: 'Test' },
				phaseStartTime: Date.now(),
				votes: [{ playerId: 'p1', takeId: 't1', vote: 'agree' }],
				guesses: [],
			},
		});

		expect(hasPlayerVoted(state, 'p1')).toBe(true);
		expect(hasPlayerVoted(state, 'p2')).toBe(false);
	});
});

describe('hasPlayerGuessed', () => {
	it('should return true if player has guessed on current take', () => {
		const state = createTestState({
			currentRound: {
				takeIndex: 0,
				currentTake: { id: 't1', text: 'Test' },
				phaseStartTime: Date.now(),
				votes: [],
				guesses: [{ playerId: 'p1', takeId: 't1', guessedAuthorId: 'author' }],
			},
		});

		expect(hasPlayerGuessed(state, 'p1')).toBe(true);
		expect(hasPlayerGuessed(state, 'p2')).toBe(false);
	});
});

describe('addVote', () => {
	it('should add vote to current round', () => {
		const state = createTestState({
			currentRound: {
				takeIndex: 0,
				currentTake: { id: 't1', text: 'Test' },
				phaseStartTime: Date.now(),
				votes: [],
				guesses: [],
			},
		});

		const vote: Vote = { playerId: 'p1', takeId: 't1', vote: 'agree' };
		const newState = addVote(state, vote);

		expect(newState.currentRound!.votes).toHaveLength(1);
		expect(newState.currentRound!.votes[0]).toEqual(vote);
	});

	it('should return unchanged state if no currentRound', () => {
		const state = createTestState();
		const vote: Vote = { playerId: 'p1', takeId: 't1', vote: 'agree' };
		const newState = addVote(state, vote);

		expect(newState).toBe(state);
	});
});

describe('addGuess', () => {
	it('should add guess to current round', () => {
		const state = createTestState({
			currentRound: {
				takeIndex: 0,
				currentTake: { id: 't1', text: 'Test' },
				phaseStartTime: Date.now(),
				votes: [],
				guesses: [],
			},
		});

		const guess: Guess = { playerId: 'p1', takeId: 't1', guessedAuthorId: 'author' };
		const newState = addGuess(state, guess);

		expect(newState.currentRound!.guesses).toHaveLength(1);
		expect(newState.currentRound!.guesses[0]).toEqual(guess);
	});
});

describe('getActivePlayerCount', () => {
	it('should count only non-spectator connected players', () => {
		const state = createTestState({
			players: [
				createTestPlayer('p1'),
				createTestPlayer('p2'),
				createTestPlayer('spectator', { isSpectator: true }),
				createTestPlayer('disconnected', { isConnected: false }),
			],
		});

		expect(getActivePlayerCount(state)).toBe(2);
	});
});

describe('isCurrentTakeAuthor', () => {
	it('should return true for the author of current take', () => {
		const state = createTestState({
			takes: [{ id: 't1', text: 'Test', authorId: 'author' }],
			currentRound: {
				takeIndex: 0,
				currentTake: { id: 't1', text: 'Test' },
				phaseStartTime: Date.now(),
				votes: [],
				guesses: [],
			},
		});

		expect(isCurrentTakeAuthor(state, 'author')).toBe(true);
		expect(isCurrentTakeAuthor(state, 'notAuthor')).toBe(false);
	});

	it('should return false if no current round', () => {
		const state = createTestState();
		expect(isCurrentTakeAuthor(state, 'author')).toBe(false);
	});
});

describe('updatePlayer', () => {
	it('should update specified player', () => {
		const state = createTestState({
			players: [createTestPlayer('p1', { isReady: false }), createTestPlayer('p2')],
		});

		const newState = updatePlayer(state, 'p1', { isReady: true });

		expect(newState.players[0].isReady).toBe(true);
		expect(newState.players[1].isReady).toBe(true); // Unchanged
	});

	it('should not modify other players', () => {
		const state = createTestState({
			players: [createTestPlayer('p1'), createTestPlayer('p2', { name: 'Original' })],
		});

		const newState = updatePlayer(state, 'p1', { name: 'New Name' });

		expect(newState.players[0].name).toBe('New Name');
		expect(newState.players[1].name).toBe('Original');
	});
});
