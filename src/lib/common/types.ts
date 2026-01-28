/**
 * Common types shared across all games
 */

/** Game identifier */
export type GameId = 'photo-roulette' | 'hot-takes';

/** Animal emojis used for player avatars */
export const ANIMAL_EMOJIS = [
	'🐰',
	'🐇',
	'🦊',
	'🐻',
	'🦉',
	'🦌',
	'🐿️',
	'🦝',
	'🐺',
	'🦎',
	'🐢',
	'🦋',
	'🐝',
	'🦔',
	'🐧',
	'🦜',
	'🐙',
	'🦀',
	'🐬',
	'🦭',
] as const;

export type AnimalEmoji = (typeof ANIMAL_EMOJIS)[number];

/** Game definition for the game registry */
export interface GameDefinition {
	id: GameId;
	name: string;
	description: string;
	minPlayers: number;
	maxPlayers: number;
	icon: string;
}

/** Base player structure - games extend this */
export interface BasePlayer {
	id: string;
	name: string;
	emoji: AnimalEmoji;
	isHost: boolean;
	isReady: boolean;
	isConnected: boolean;
}

/** Connection status */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Base game phase - games define their own phases */
export type BaseGamePhase = 'landing' | 'lobby';
