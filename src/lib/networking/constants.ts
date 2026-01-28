/**
 * Networking constants for P2P communication
 */

// === Room Codes ===

/** Characters used in room codes (excludes ambiguous chars like 0/O, 1/I/L) */
export const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Length of room codes */
export const ROOM_CODE_LENGTH = 4;

// === Connection ===

/** Time to wait for connection to establish (ms) */
export const CONNECTION_TIMEOUT_MS = 15000;

/** Interval between ping messages for connection health (ms) */
export const PING_INTERVAL_MS = 5000;

/** Time without pong before considering a ping missed (ms) */
export const PING_TIMEOUT_MS = 10000;

/** Number of consecutive missed pings before disconnecting */
export const MAX_MISSED_PINGS = 3;

/** Time to wait before attempting reconnection (ms) */
export const RECONNECT_DELAY_MS = 1000;

/** Maximum reconnection attempts */
export const MAX_RECONNECT_ATTEMPTS = 5;

// === PeerJS Configuration ===

/** PeerJS server configuration (uses free PeerJS Cloud) */
export const PEERJS_CONFIG = {
	// Using PeerJS Cloud (free signaling server)
	// No host/port needed - PeerJS handles it automatically
	debug: 2, // 0: off, 1: errors, 2: warnings, 3: all
};

/** Prefix for peer IDs to avoid collisions */
export const PEER_ID_PREFIX = 'photoroulette-';
