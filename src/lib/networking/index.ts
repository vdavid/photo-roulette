/**
 * Networking module for P2P communication
 *
 * This module provides the networking layer for the Photo Roulette game
 * using PeerJS for WebRTC data channels.
 *
 * Architecture:
 * - Star topology: Host maintains all connections, no mesh
 * - Host is authoritative: All game state lives on host
 * - Players connect only to host via room code
 *
 * Usage:
 *
 * Host:
 * ```typescript
 * import { HostNetwork } from '$lib/networking';
 *
 * const host = new HostNetwork(myPlayerId);
 * const roomCode = await host.createRoom();
 *
 * host.on('playerJoinRequest', (peerId, name, emoji, accept, reject) => {
 *   // Validate and accept/reject the player
 *   const playerId = generatePlayerId();
 *   accept(playerId);
 *   host.sendJoinAccepted(peerId, playerId, players, settings, phase);
 * });
 *
 * // Broadcast game events
 * host.broadcastRoundStart(roundNumber, photoUrl, photoId, startTime);
 * host.broadcastRoundEnd(result, scores);
 * ```
 *
 * Player:
 * ```typescript
 * import { PlayerNetwork } from '$lib/networking';
 *
 * const player = new PlayerNetwork();
 * await player.joinRoom('X7K2', 'David', '🦊');
 *
 * player.on('joined', (playerId, players, settings, phase) => {
 *   // Connected and ready
 * });
 *
 * player.on('roundStart', (roundNumber, photoUrl, photoId, startTime) => {
 *   // New round started
 * });
 *
 * // Send a guess
 * player.sendGuess(guessedPlayerId);
 * ```
 */

// Types
export type {
	MessageType,
	BaseMessage,
	NetworkMessage,
	ConnectionState,
	PeerConnection,
	NetworkRole,
	NetworkStatus,
	PlayerScoreData,
	// Message types
	PlayerJoinRequestMessage,
	PlayerJoinAcceptedMessage,
	PlayerJoinRejectedMessage,
	PlayerLeftMessage,
	PlayerReconnectedMessage,
	PlayerKickedMessage,
	PlayerUpdateMessage,
	PhotosSubmittedMessage,
	SettingsChangedMessage,
	GameStartingMessage,
	RoundStartMessage,
	GuessSubmittedMessage,
	RoundEndMessage,
	GameEndMessage,
	StateSyncMessage,
	PingMessage,
	PongMessage,
} from './types.js';

// Helper functions
export { createBaseMessage, playerScoresToData, dataToPlayerScores } from './types.js';

// Constants
export {
	ROOM_CODE_CHARS,
	ROOM_CODE_LENGTH,
	CONNECTION_TIMEOUT_MS,
	PING_INTERVAL_MS,
	PING_TIMEOUT_MS,
	RECONNECT_DELAY_MS,
	MAX_RECONNECT_ATTEMPTS,
	PEERJS_CONFIG,
	PEER_ID_PREFIX,
} from './constants.js';

// Room code utilities
export {
	generateRoomCode,
	isValidRoomCode,
	normalizeRoomCode,
	roomCodeToPeerId,
	peerIdToRoomCode,
} from './room-code.js';

// Core classes
export { PeerManager, type PeerManagerEvents } from './peer-manager.js';
export { HostNetwork, type HostNetworkEvents } from './host.js';
export { PlayerNetwork, type PlayerNetworkEvents } from './player.js';
