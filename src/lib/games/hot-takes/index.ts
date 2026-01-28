/**
 * Hot Takes game module
 */

import type { GameDefinition } from '$lib/common/types.js';

/** Hot Takes game definition */
export const hotTakesGame: GameDefinition = {
	id: 'hot-takes',
	name: 'Hot Takes',
	description:
		'Share your spiciest opinions, vote on others, and guess who wrote what! Points for correct guesses and controversial takes.',
	minPlayers: 3,
	maxPlayers: 8,
	icon: '🔥',
};

// Re-export store
export { hotTakesStore } from './store.svelte.js';

// Re-export views
export * from './views/index.js';

// Re-export logic
export * from './logic/index.js';

// Re-export networking
export * from './networking/index.js';

// Re-export components
export * from './components/index.js';
