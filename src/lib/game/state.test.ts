import { describe, it, expect } from 'vitest';
import {
	isValidTransition,
	createInitialState,
	transitionToLobby,
	addPlayer,
	removePlayer,
	updatePlayer,
	updateSettings,
	isPlayerReady,
	allPlayersReady,
	transitionToPlaying,
	transitionToResults,
	advanceFromResults,
	transitionToFinal,
	startRematch,
	transitionToNewGame,
	getCurrentRoundNumber,
	isGameActive,
} from './state.js';
import type { Player, Photo } from './types.js';
import { MIN_PHOTOS_PER_PLAYER } from './constants.js';

const createTestPlayer = (overrides: Partial<Player> = {}): Player => ({
	id: 'player1',
	name: 'Test Player',
	emoji: '🐰',
	photoIds: Array(MIN_PHOTOS_PER_PLAYER).fill('photo'),
	isHost: false,
	isReady: true,
	isConnected: true,
	isSpectator: false,
	...overrides,
});

const createTestPhotos = (count: number, ownerId: string): Photo[] =>
	Array(count)
		.fill(null)
		.map((_, i) => ({
			id: `photo${i}`,
			ownerId,
			baseUrl: `url${i}`,
		}));

describe('isValidTransition', () => {
	it('allows landing to lobby', () => {
		expect(isValidTransition('landing', 'lobby')).toBe(true);
	});

	it('allows lobby to playing', () => {
		expect(isValidTransition('lobby', 'playing')).toBe(true);
	});

	it('allows playing to results', () => {
		expect(isValidTransition('playing', 'results')).toBe(true);
	});

	it('allows results to playing (next round)', () => {
		expect(isValidTransition('results', 'playing')).toBe(true);
	});

	it('allows results to final', () => {
		expect(isValidTransition('results', 'final')).toBe(true);
	});

	it('allows final to lobby (new game)', () => {
		expect(isValidTransition('final', 'lobby')).toBe(true);
	});

	it('rejects invalid transitions', () => {
		expect(isValidTransition('landing', 'playing')).toBe(false);
		expect(isValidTransition('lobby', 'results')).toBe(false);
		expect(isValidTransition('playing', 'final')).toBe(false);
		expect(isValidTransition('final', 'playing')).toBe(false);
	});
});

describe('createInitialState', () => {
	it('creates state with landing phase', () => {
		const state = createInitialState();
		expect(state.phase).toBe('landing');
	});

	it('creates state with default settings', () => {
		const state = createInitialState();
		expect(state.settings.totalRounds).toBe(12);
		expect(state.settings.timerSeconds).toBe(20);
	});

	it('creates state with empty players', () => {
		const state = createInitialState();
		expect(state.players).toEqual([]);
	});
});

describe('transitionToLobby', () => {
	it('transitions from landing to lobby', () => {
		const state = createInitialState();
		const host = createTestPlayer({ id: 'host', isHost: true });

		const newState = transitionToLobby(state, host);

		expect(newState.phase).toBe('lobby');
		expect(newState.players).toHaveLength(1);
		expect(newState.players[0].isHost).toBe(true);
	});

	it('throws on invalid transition', () => {
		const state = { ...createInitialState(), phase: 'playing' as const };
		const host = createTestPlayer();

		expect(() => transitionToLobby(state, host)).toThrow();
	});
});

describe('addPlayer', () => {
	it('adds player to lobby', () => {
		const state = {
			...createInitialState(),
			phase: 'lobby' as const,
			players: [createTestPlayer({ id: 'host', isHost: true })],
		};
		const player = createTestPlayer({ id: 'player2' });

		const newState = addPlayer(state, player);

		expect(newState.players).toHaveLength(2);
		expect(newState.players[1].id).toBe('player2');
		expect(newState.players[1].isHost).toBe(false);
	});

	it('throws when not in lobby', () => {
		const state = {
			...createInitialState(),
			phase: 'playing' as const,
		};
		const player = createTestPlayer();

		expect(() => addPlayer(state, player)).toThrow('Can only add players in lobby phase');
	});

	it('throws for duplicate player', () => {
		const state = {
			...createInitialState(),
			phase: 'lobby' as const,
			players: [createTestPlayer({ id: 'player1' })],
		};
		const player = createTestPlayer({ id: 'player1' });

		expect(() => addPlayer(state, player)).toThrow('Player already exists');
	});
});

describe('removePlayer', () => {
	it('removes player from lobby', () => {
		const state = {
			...createInitialState(),
			phase: 'lobby' as const,
			players: [
				createTestPlayer({ id: 'host', isHost: true }),
				createTestPlayer({ id: 'player2' }),
			],
		};

		const newState = removePlayer(state, 'player2');

		expect(newState.players).toHaveLength(1);
		expect(newState.players[0].id).toBe('host');
	});

	it('throws when not in lobby', () => {
		const state = {
			...createInitialState(),
			phase: 'playing' as const,
			players: [createTestPlayer()],
		};

		expect(() => removePlayer(state, 'player1')).toThrow();
	});

	it('throws when removing host', () => {
		const state = {
			...createInitialState(),
			phase: 'lobby' as const,
			players: [createTestPlayer({ id: 'host', isHost: true })],
		};

		expect(() => removePlayer(state, 'host')).toThrow('Cannot remove host');
	});

	it('throws for non-existent player', () => {
		const state = {
			...createInitialState(),
			phase: 'lobby' as const,
			players: [createTestPlayer({ id: 'host', isHost: true })],
		};

		expect(() => removePlayer(state, 'unknown')).toThrow('Player not found');
	});
});

describe('updatePlayer', () => {
	it('updates player name', () => {
		const state = {
			...createInitialState(),
			players: [createTestPlayer({ id: 'player1', name: 'Old Name' })],
		};

		const newState = updatePlayer(state, 'player1', { name: 'New Name' });

		expect(newState.players[0].name).toBe('New Name');
	});

	it('updates multiple fields', () => {
		const state = {
			...createInitialState(),
			players: [createTestPlayer({ id: 'player1' })],
		};

		const newState = updatePlayer(state, 'player1', {
			name: 'New Name',
			emoji: '🦊',
			isReady: true,
		});

		expect(newState.players[0].name).toBe('New Name');
		expect(newState.players[0].emoji).toBe('🦊');
		expect(newState.players[0].isReady).toBe(true);
	});

	it('throws for non-existent player', () => {
		const state = createInitialState();

		expect(() => updatePlayer(state, 'unknown', { name: 'Test' })).toThrow('Player not found');
	});
});

describe('updateSettings', () => {
	it('updates settings in lobby', () => {
		const state = {
			...createInitialState(),
			phase: 'lobby' as const,
		};

		const newState = updateSettings(state, { totalRounds: 20, timerSeconds: 15 });

		expect(newState.settings.totalRounds).toBe(20);
		expect(newState.settings.timerSeconds).toBe(15);
	});

	it('partially updates settings', () => {
		const state = {
			...createInitialState(),
			phase: 'lobby' as const,
		};

		const newState = updateSettings(state, { totalRounds: 8 });

		expect(newState.settings.totalRounds).toBe(8);
		expect(newState.settings.timerSeconds).toBe(20); // unchanged
	});

	it('throws when not in lobby', () => {
		const state = {
			...createInitialState(),
			phase: 'playing' as const,
		};

		expect(() => updateSettings(state, { totalRounds: 20 })).toThrow();
	});
});

describe('isPlayerReady', () => {
	it('returns true for valid player', () => {
		const player = createTestPlayer();
		expect(isPlayerReady(player)).toBe(true);
	});

	it('returns false for empty name', () => {
		const player = createTestPlayer({ name: '' });
		expect(isPlayerReady(player)).toBe(false);
	});

	it('returns false for whitespace-only name', () => {
		const player = createTestPlayer({ name: '   ' });
		expect(isPlayerReady(player)).toBe(false);
	});

	it('returns false for insufficient photos', () => {
		const player = createTestPlayer({ photoIds: ['photo1', 'photo2'] });
		expect(isPlayerReady(player)).toBe(false);
	});

	it('returns false for disconnected player', () => {
		const player = createTestPlayer({ isConnected: false });
		expect(isPlayerReady(player)).toBe(false);
	});
});

describe('allPlayersReady', () => {
	it('returns true when all players ready', () => {
		const state = {
			...createInitialState(),
			players: [createTestPlayer({ id: 'p1' }), createTestPlayer({ id: 'p2' })],
		};

		expect(allPlayersReady(state)).toBe(true);
	});

	it('returns false when any player not ready', () => {
		const state = {
			...createInitialState(),
			players: [createTestPlayer({ id: 'p1' }), createTestPlayer({ id: 'p2', name: '' })],
		};

		expect(allPlayersReady(state)).toBe(false);
	});

	it('returns false for empty players', () => {
		const state = createInitialState();
		expect(allPlayersReady(state)).toBe(false);
	});
});

describe('transitionToPlaying', () => {
	it('transitions from lobby to playing', () => {
		const state = {
			...createInitialState(),
			phase: 'lobby' as const,
			players: [createTestPlayer({ id: 'p1', isHost: true }), createTestPlayer({ id: 'p2' })],
		};
		const photos = createTestPhotos(20, 'p1');

		const newState = transitionToPlaying(state, photos, 1000);

		expect(newState.phase).toBe('playing');
		expect(newState.currentRound).not.toBeNull();
		expect(newState.currentRound?.roundNumber).toBe(1);
		expect(newState.playerScores.size).toBe(2);
	});

	it('throws when players not ready', () => {
		const state = {
			...createInitialState(),
			phase: 'lobby' as const,
			players: [createTestPlayer({ id: 'p1', name: '' })],
		};
		const photos = createTestPhotos(20, 'p1');

		expect(() => transitionToPlaying(state, photos, 1000)).toThrow();
	});

	it('throws with no photos', () => {
		const state = {
			...createInitialState(),
			phase: 'lobby' as const,
			players: [createTestPlayer({ id: 'p1', isHost: true })],
		};

		expect(() => transitionToPlaying(state, [], 1000)).toThrow();
	});
});

describe('transitionToResults', () => {
	it('transitions from playing to results', () => {
		const state = {
			...createInitialState(),
			phase: 'playing' as const,
			players: [createTestPlayer({ id: 'p1' })],
			currentRound: {
				roundNumber: 1,
				photoId: 'photo1',
				photoOwnerId: 'p1',
				guesses: [],
				startTime: 1000,
			},
		};

		const newState = transitionToResults(state);

		expect(newState.phase).toBe('results');
		expect(newState.roundResults).toHaveLength(1);
	});

	it('throws without current round', () => {
		const state = {
			...createInitialState(),
			phase: 'playing' as const,
			currentRound: null,
		};

		expect(() => transitionToResults(state)).toThrow('No current round');
	});
});

describe('advanceFromResults', () => {
	it('starts next round when rounds remain', () => {
		const state = {
			...createInitialState(),
			phase: 'results' as const,
			settings: { totalRounds: 12, timerSeconds: 10 },
			players: [createTestPlayer({ id: 'p1' })],
			photoPool: {
				available: createTestPhotos(10, 'p1'),
				used: [],
			},
			roundResults: [
				{
					roundNumber: 1,
					photoId: 'photo1',
					photoOwnerId: 'p1',
					guesses: [],
					scores: [],
					fastestCorrectGuesserId: null,
				},
			],
		};

		const newState = advanceFromResults(state, 2000);

		expect(newState.phase).toBe('playing');
		expect(newState.currentRound?.roundNumber).toBe(2);
	});

	it('transitions to final when all rounds complete', () => {
		const state = {
			...createInitialState(),
			phase: 'results' as const,
			settings: { totalRounds: 2, timerSeconds: 10 },
			players: [createTestPlayer({ id: 'p1' })],
			roundResults: [
				{
					roundNumber: 1,
					photoId: 'photo1',
					photoOwnerId: 'p1',
					guesses: [],
					scores: [],
					fastestCorrectGuesserId: null,
				},
				{
					roundNumber: 2,
					photoId: 'photo2',
					photoOwnerId: 'p1',
					guesses: [],
					scores: [],
					fastestCorrectGuesserId: null,
				},
			],
		};

		const newState = advanceFromResults(state, 3000);

		expect(newState.phase).toBe('final');
	});
});

describe('transitionToFinal', () => {
	it('transitions from results to final', () => {
		const state = {
			...createInitialState(),
			phase: 'results' as const,
		};

		const newState = transitionToFinal(state);

		expect(newState.phase).toBe('final');
		expect(newState.currentRound).toBeNull();
	});

	it('throws on invalid transition', () => {
		const state = {
			...createInitialState(),
			phase: 'playing' as const,
		};

		expect(() => transitionToFinal(state)).toThrow();
	});
});

describe('startRematch', () => {
	it('starts new game with same players', () => {
		const state = {
			...createInitialState(),
			phase: 'final' as const,
			players: [createTestPlayer({ id: 'p1', isHost: true }), createTestPlayer({ id: 'p2' })],
		};
		const photos = createTestPhotos(20, 'p1');

		const newState = startRematch(state, photos, 1000);

		expect(newState.phase).toBe('playing');
		expect(newState.players).toHaveLength(2);
		expect(newState.roundResults).toHaveLength(0);
	});

	it('throws when not in final phase', () => {
		const state = {
			...createInitialState(),
			phase: 'results' as const,
			players: [createTestPlayer({ id: 'p1', isHost: true })],
		};
		const photos = createTestPhotos(20, 'p1');

		expect(() => startRematch(state, photos, 1000)).toThrow();
	});
});

describe('transitionToNewGame', () => {
	it('returns to lobby with reset players', () => {
		const state = {
			...createInitialState(),
			phase: 'final' as const,
			players: [
				createTestPlayer({ id: 'p1', isHost: true, photoIds: ['p1', 'p2'] }),
				createTestPlayer({ id: 'p2', photoIds: ['p3', 'p4'] }),
			],
			roundResults: [
				{
					roundNumber: 1,
					photoId: 'photo1',
					photoOwnerId: 'p1',
					guesses: [],
					scores: [],
					fastestCorrectGuesserId: null,
				},
			],
		};

		const newState = transitionToNewGame(state);

		expect(newState.phase).toBe('lobby');
		expect(newState.players).toHaveLength(2);
		expect(newState.players[0].photoIds).toHaveLength(0);
		expect(newState.players[0].isReady).toBe(false);
		expect(newState.roundResults).toHaveLength(0);
	});
});

describe('getCurrentRoundNumber', () => {
	it('returns current round number during play', () => {
		const state = {
			...createInitialState(),
			currentRound: {
				roundNumber: 5,
				photoId: 'photo1',
				photoOwnerId: 'p1',
				guesses: [],
				startTime: 1000,
			},
		};

		expect(getCurrentRoundNumber(state)).toBe(5);
	});

	it('returns completed rounds count when no current round', () => {
		const state = {
			...createInitialState(),
			currentRound: null,
			roundResults: [
				{
					roundNumber: 1,
					photoId: 'photo1',
					photoOwnerId: 'p1',
					guesses: [],
					scores: [],
					fastestCorrectGuesserId: null,
				},
				{
					roundNumber: 2,
					photoId: 'photo2',
					photoOwnerId: 'p1',
					guesses: [],
					scores: [],
					fastestCorrectGuesserId: null,
				},
			],
		};

		expect(getCurrentRoundNumber(state)).toBe(2);
	});
});

describe('isGameActive', () => {
	it('returns true for playing phase', () => {
		const state = { ...createInitialState(), phase: 'playing' as const };
		expect(isGameActive(state)).toBe(true);
	});

	it('returns true for results phase', () => {
		const state = { ...createInitialState(), phase: 'results' as const };
		expect(isGameActive(state)).toBe(true);
	});

	it('returns false for other phases', () => {
		expect(isGameActive({ ...createInitialState(), phase: 'landing' })).toBe(false);
		expect(isGameActive({ ...createInitialState(), phase: 'lobby' })).toBe(false);
		expect(isGameActive({ ...createInitialState(), phase: 'final' })).toBe(false);
	});
});
