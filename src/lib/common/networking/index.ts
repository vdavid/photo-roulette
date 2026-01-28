/**
 * Common networking exports
 * Shared P2P infrastructure for all games
 */

export { PeerManager, type PeerManagerEvents } from './peer-manager.js';

export {
	generateRoomCode,
	isValidRoomCode,
	normalizeRoomCode,
	roomCodeToPeerId,
	peerIdToRoomCode,
} from './room-code.js';

export {
	ROOM_CODE_CHARS,
	ROOM_CODE_LENGTH,
	CONNECTION_TIMEOUT_MS,
	PING_INTERVAL_MS,
	PING_TIMEOUT_MS,
	MAX_MISSED_PINGS,
	RECONNECT_DELAY_MS,
	MAX_RECONNECT_ATTEMPTS,
	PEERJS_CONFIG,
	PEER_ID_PREFIX,
} from './constants.js';

export type {
	PlayerId,
	BaseMessageType,
	BaseMessage,
	BasePlayer,
	PlayerJoinRequestMessage,
	BasePlayerJoinAcceptedMessage,
	JoinRejectionReason,
	PlayerJoinRejectedMessage,
	PlayerLeftMessage,
	PlayerReconnectedMessage,
	PlayerKickedMessage,
	BasePlayerUpdateMessage,
	BaseSettingsChangedMessage,
	BaseGameStartingMessage,
	PingMessage,
	PongMessage,
	ConnectionState,
	PeerConnection,
	NetworkRole,
	NetworkStatus,
} from './types.js';

export { createBaseMessage } from './types.js';
