/**
 * Photo Roulette game module
 */

import type { GameDefinition } from '$lib/common/types.js';

/** Photo Roulette game definition */
export const photoRouletteGame: GameDefinition = {
	id: 'photo-roulette',
	name: 'Photo Roulette',
	description:
		'Guess whose photo it is! Connect your photos and see if your friends can recognize them.',
	minPlayers: 2,
	maxPlayers: 8,
	icon: '📸',
};

// Re-export store
export { gameStore } from './store.svelte.js';

// Re-export views
export { Landing, Lobby, Game, Results, Final } from './views/index.js';

// Re-export logic types and functions (including MAX_PHOTOS_TO_PICK)
export * from './logic/index.js';
export { MAX_PHOTOS_TO_PICK } from './logic/constants.js';

// Re-export photos utilities
export * from './photos/index.js';

// Re-export networking
export * from './networking/index.js';
