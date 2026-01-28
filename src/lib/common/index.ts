/**
 * Common module exports
 * Shared infrastructure for all games
 */

// Types
export type {
	GameId,
	GameDefinition,
	BasePlayer,
	ConnectionStatus,
	BaseGamePhase,
	AnimalEmoji,
} from './types.js';

export { ANIMAL_EMOJIS } from './types.js';

// Game registry
export { GAMES, getGame, getAllGames, isValidGameId } from './game-registry.js';

// Networking
export * from './networking/index.js';

// Components are exported from their own index
