/**
 * In-memory PeerJS mock for fast E2E tests.
 * Routes messages between "peers" without any network latency.
 */

// Global registry of all mock peers (shared across browser contexts via injection)
const MOCK_SCRIPT = `
(function() {
  // Registry of all peers by ID
  const peers = new Map();
  // Pending connection requests
  const pendingConnections = new Map();

  class MockDataConnection {
    constructor(peerId, targetPeerId, initiator) {
      this.peer = targetPeerId;
      this.open = false;
      this.metadata = {};
      this._handlers = new Map();
      this._peerId = peerId;
      this._targetPeerId = targetPeerId;
      this._initiator = initiator;
    }

    on(event, handler) {
      if (!this._handlers.has(event)) {
        this._handlers.set(event, []);
      }
      this._handlers.get(event).push(handler);
      return this;
    }

    off(event, handler) {
      const handlers = this._handlers.get(event);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      }
    }

    emit(event, ...args) {
      const handlers = this._handlers.get(event) || [];
      handlers.forEach(h => h(...args));
    }

    send(data) {
      if (!this.open) return;
      // Find the target peer and deliver the message
      const targetPeer = peers.get(this._targetPeerId);
      if (targetPeer) {
        const targetConn = targetPeer._connections.get(this._peerId);
        if (targetConn) {
          // Use setTimeout to simulate async message delivery
          setTimeout(() => targetConn.emit('data', data), 1);
        }
      }
    }

    close() {
      this.open = false;
      this.emit('close');
    }
  }

  class MockPeer {
    constructor(id, options = {}) {
      this.id = id || 'mock-' + Math.random().toString(36).substr(2, 9);
      this.open = false;
      this.destroyed = false;
      this.disconnected = false;
      this._handlers = new Map();
      this._connections = new Map();

      // Register this peer
      peers.set(this.id, this);

      // Simulate async open
      setTimeout(() => {
        this.open = true;
        this.emit('open', this.id);

        // Check for pending connections to this peer
        const pending = pendingConnections.get(this.id);
        if (pending) {
          pending.forEach(({ fromPeerId, conn }) => {
            this._handleIncomingConnection(fromPeerId, conn);
          });
          pendingConnections.delete(this.id);
        }
      }, 5);
    }

    on(event, handler) {
      if (!this._handlers.has(event)) {
        this._handlers.set(event, []);
      }
      this._handlers.get(event).push(handler);
      return this;
    }

    off(event, handler) {
      const handlers = this._handlers.get(event);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      }
    }

    emit(event, ...args) {
      const handlers = this._handlers.get(event) || [];
      handlers.forEach(h => h(...args));
    }

    connect(targetPeerId, options = {}) {
      const conn = new MockDataConnection(this.id, targetPeerId, true);
      this._connections.set(targetPeerId, conn);

      const targetPeer = peers.get(targetPeerId);
      if (targetPeer && targetPeer.open) {
        // Target peer exists and is open - establish connection
        setTimeout(() => {
          targetPeer._handleIncomingConnection(this.id, conn);
          conn.open = true;
          conn.emit('open');
        }, 5);
      } else {
        // Target peer doesn't exist yet - queue the connection
        if (!pendingConnections.has(targetPeerId)) {
          pendingConnections.set(targetPeerId, []);
        }
        pendingConnections.get(targetPeerId).push({ fromPeerId: this.id, conn });
      }

      return conn;
    }

    _handleIncomingConnection(fromPeerId, remoteConn) {
      const conn = new MockDataConnection(this.id, fromPeerId, false);
      conn.open = true;
      this._connections.set(fromPeerId, conn);

      // Link the connections
      remoteConn._linkedConn = conn;
      conn._linkedConn = remoteConn;

      this.emit('connection', conn);
    }

    disconnect() {
      this.disconnected = true;
      this.open = false;
      this.emit('disconnected');
    }

    destroy() {
      this.destroyed = true;
      this.disconnected = true;
      this.open = false;
      peers.delete(this.id);
      this._connections.forEach(conn => conn.close());
      this._connections.clear();
      this.emit('close');
    }

    reconnect() {
      if (this.destroyed) return;
      this.disconnected = false;
      this.open = true;
      peers.set(this.id, this);
      this.emit('open', this.id);
    }
  }

  // Expose mock globally
  window.Peer = MockPeer;
  window.__PEERJS_MOCKED__ = true;
})();
`;

/**
 * Inject PeerJS mock into a page before any navigation.
 */
export async function injectPeerJsMock(page: import('@playwright/test').Page): Promise<void> {
	await page.addInitScript(MOCK_SCRIPT);
}

/**
 * Inject PeerJS mock into all pages in a browser context.
 */
export async function injectPeerJsMockToContext(
	context: import('@playwright/test').BrowserContext
): Promise<void> {
	await context.addInitScript(MOCK_SCRIPT);
}
