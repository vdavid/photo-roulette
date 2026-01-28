/**
 * Base network message types for P2P communication
 * Shared across all games - games extend these with game-specific messages
 */

// === Base Types ===

/** Unique player identifier */
export type PlayerId = string;

/** Base message types shared by all games */
export type BaseMessageType =
	// Connection
	| 'player-join-request'
	| 'player-join-accepted'
	| 'player-join-rejected'
	| 'player-left'
	| 'player-reconnected'
	| 'player-kicked'
	// Lobby
	| 'player-update'
	| 'settings-changed'
	| 'game-starting'
	// Health
	| 'ping'
	| 'pong';

/** Base message structure */
export interface BaseMessage {
	type: string;
	timestamp: number;
	senderId: PlayerId;
}

// === Base Player ===

/** Base player structure - games extend this */
export interface BasePlayer {
	id: PlayerId;
	name: string;
	emoji: string;
	isHost: boolean;
	isReady: boolean;
	isConnected: boolean;
}

// === Connection Messages ===

/** Player requesting to join a game */
export interface PlayerJoinRequestMessage extends BaseMessage {
	type: 'player-join-request';
	playerName: string;
	playerEmoji: string;
}

/** Base fields for join accepted - games extend with game-specific data */
export interface BasePlayerJoinAcceptedMessage extends BaseMessage {
	type: 'player-join-accepted';
	playerId: PlayerId;
}

/** Rejection reasons */
export type JoinRejectionReason =
	| 'game-full'
	| 'room-full'
	| 'game-in-progress'
	| 'name-taken'
	| 'invalid-room';

/** Host rejecting a player's join request */
export interface PlayerJoinRejectedMessage extends BaseMessage {
	type: 'player-join-rejected';
	reason: JoinRejectionReason;
}

/** Player leaving the game */
export interface PlayerLeftMessage extends BaseMessage {
	type: 'player-left';
	playerId: PlayerId;
}

/** Player reconnecting to the game */
export interface PlayerReconnectedMessage extends BaseMessage {
	type: 'player-reconnected';
	playerId: PlayerId;
}

/** Host kicking a player */
export interface PlayerKickedMessage extends BaseMessage {
	type: 'player-kicked';
	playerId: PlayerId;
	reason?: string;
}

// === Lobby Messages ===

/** Player updating their info - games can extend the updates field */
export interface BasePlayerUpdateMessage extends BaseMessage {
	type: 'player-update';
	playerId: PlayerId;
	updates: Partial<Pick<BasePlayer, 'name' | 'emoji' | 'isReady'>>;
}

/** Base settings changed message - games provide their own settings type */
export interface BaseSettingsChangedMessage extends BaseMessage {
	type: 'settings-changed';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	settings: any;
}

/** Base game starting message - games provide their own player/settings types */
export interface BaseGameStartingMessage extends BaseMessage {
	type: 'game-starting';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	players: any[];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	settings: any;
}

// === Health Messages ===

/** Ping message for connection health check */
export interface PingMessage extends BaseMessage {
	type: 'ping';
}

/** Pong response to ping */
export interface PongMessage extends BaseMessage {
	type: 'pong';
}

// === Connection State ===

/** State of a peer connection */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/** Information about a connected peer */
export interface PeerConnection {
	peerId: string;
	playerId: PlayerId;
	state: ConnectionState;
	lastPingTime: number | null;
	latency: number | null;
}

/** Network role */
export type NetworkRole = 'host' | 'player' | 'none';

/** Network status */
export interface NetworkStatus {
	role: NetworkRole;
	roomCode: string | null;
	isConnected: boolean;
	connections: PeerConnection[];
	error: string | null;
}

// === Helper Functions ===

/** Create a base message with common fields */
export function createBaseMessage(type: string, senderId: PlayerId): BaseMessage {
	return {
		type,
		timestamp: Date.now(),
		senderId,
	};
}
