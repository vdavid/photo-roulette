/**
 * Game registry - defines available games
 */

import type { GameDefinition, GameId } from './types.js';

/** All available games */
export const GAMES: Record<GameId, GameDefinition> = {
	'photo-roulette': {
		id: 'photo-roulette',
		name: 'Photo Roulette',
		description:
			'Guess whose photo it is! Connect your photos and see if your friends can recognize them.',
		minPlayers: 2,
		maxPlayers: 8,
		icon: '📸',
	},
	'hot-takes': {
		id: 'hot-takes',
		name: 'Hot Takes',
		description:
			'Share controversial opinions anonymously, vote on them, then guess who said what!',
		minPlayers: 3,
		maxPlayers: 8,
		icon: '🔥',
	},
};

/** Get game by ID */
export function getGame(id: GameId): GameDefinition | undefined {
	return GAMES[id];
}

/** Get all games as array */
export function getAllGames(): GameDefinition[] {
	return Object.values(GAMES);
}

/** Check if a game ID is valid */
export function isValidGameId(id: string): id is GameId {
	return id in GAMES;
}
