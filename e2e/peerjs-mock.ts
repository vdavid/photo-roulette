/**
 * In-memory PeerJS mock for fast E2E tests.
 *
 * Two modes:
 * 1. In-memory mode (default): Routes messages within a single browser context
 * 2. WebSocket bridge mode: Routes messages across browser contexts via a WebSocket server
 *    Enabled by setting window.__PEERJS_WS_URL__
 */

const MOCK_SCRIPT = `
(function() {
  // Check if we should use WebSocket bridge (for multi-browser tests)
  const wsUrl = window.__PEERJS_WS_URL__;

  if (wsUrl) {
    // === WebSocket Bridge Mode ===
    // Used for multi-browser tests where contexts need to communicate

    class MockDataConnection {
      constructor(peerId, targetPeerId, ws, initiator) {
        this.peer = targetPeerId;
        this.open = false;
        this.metadata = {};
        this._handlers = new Map();
        this._peerId = peerId;
        this._targetPeerId = targetPeerId;
        this._ws = ws;
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
        this._ws.send(JSON.stringify({
          type: 'data',
          targetPeerId: this._targetPeerId,
          data: data
        }));
      }

      close() {
        this.open = false;
        this.emit('close');
      }
    }

    class MockPeer {
      constructor(id, options = {}) {
        // Handle case where first arg is options object (no ID provided)
        if (typeof id === 'object' && id !== null) {
          options = id;
          id = null;
        }
        this.id = id || 'mock-' + Math.random().toString(36).substr(2, 9);
        this.open = false;
        this.destroyed = false;
        this.disconnected = false;
        this._handlers = new Map();
        this._connections = new Map();
        this._pendingConnections = new Map();

        // Connect to WebSocket bridge
        this._ws = new WebSocket(wsUrl);

        this._ws.onopen = () => {
          // Register this peer with the bridge
          this._ws.send(JSON.stringify({ type: 'register', peerId: this.id }));
        };

        this._ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'registered':
              this.open = true;
              this.emit('open', this.id);
              break;

            case 'incoming-connection':
              // Another peer wants to connect to us
              const incomingConn = new MockDataConnection(this.id, msg.fromPeerId, this._ws, false);
              this._connections.set(msg.fromPeerId, incomingConn);
              this.emit('connection', incomingConn);
              // Emit 'open' on the connection after a short delay (like real PeerJS)
              setTimeout(() => {
                incomingConn.open = true;
                incomingConn.emit('open');
              }, 5);
              break;

            case 'connection-ready':
              // Our connection request was successful
              const pendingConn = this._pendingConnections.get(msg.targetPeerId);
              if (pendingConn) {
                pendingConn.open = true;
                this._connections.set(msg.targetPeerId, pendingConn);
                this._pendingConnections.delete(msg.targetPeerId);
                setTimeout(() => pendingConn.emit('open'), 5);
              }
              break;

            case 'connection-pending':
              // Target doesn't exist yet, retry after a delay
              const retryConn = this._pendingConnections.get(msg.targetPeerId);
              if (retryConn && retryConn._retryCount < 50) {
                retryConn._retryCount = (retryConn._retryCount || 0) + 1;
                setTimeout(() => {
                  if (this._pendingConnections.has(msg.targetPeerId)) {
                    this._ws.send(JSON.stringify({
                      type: 'connect',
                      targetPeerId: msg.targetPeerId
                    }));
                  }
                }, 100);
              }
              break;

            case 'data':
              // Received data from another peer
              const dataConn = this._connections.get(msg.fromPeerId);
              if (dataConn) {
                dataConn.emit('data', msg.data);
              }
              break;

            case 'peer-disconnected':
              // A peer disconnected
              const disconnectedConn = this._connections.get(msg.peerId);
              if (disconnectedConn) {
                disconnectedConn.open = false;
                disconnectedConn.emit('close');
                this._connections.delete(msg.peerId);
              }
              break;
          }
        };

        this._ws.onerror = (err) => {
          console.error('[PeerJS Mock] WebSocket error:', err);
          this.emit('error', err);
        };

        this._ws.onclose = () => {
          this.open = false;
          this.disconnected = true;
          this.emit('disconnected');
        };
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
        const conn = new MockDataConnection(this.id, targetPeerId, this._ws, true);
        conn._retryCount = 0;
        this._pendingConnections.set(targetPeerId, conn);

        // Request connection through the bridge
        this._ws.send(JSON.stringify({
          type: 'connect',
          targetPeerId: targetPeerId
        }));

        return conn;
      }

      disconnect() {
        this.disconnected = true;
        this.open = false;
        this._ws.close();
        this.emit('disconnected');
      }

      destroy() {
        this.destroyed = true;
        this.disconnected = true;
        this.open = false;
        this._ws.close();
        this._connections.forEach(conn => conn.close());
        this._connections.clear();
        this.emit('close');
      }

      reconnect() {
        if (this.destroyed) return;
        // Reconnect by creating a new WebSocket
        this._ws = new WebSocket(wsUrl);
        this._ws.onopen = () => {
          this._ws.send(JSON.stringify({ type: 'register', peerId: this.id }));
        };
        // Re-attach handlers...
      }
    }

    window.Peer = MockPeer;
    window.__PEERJS_MOCKED__ = true;
    window.__PEERJS_WS_BRIDGE__ = true;

  } else {
    // === In-Memory Mode ===
    // Used for single-browser tests (faster, no network)

    const peers = new Map();
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
        const targetPeer = peers.get(this._targetPeerId);
        if (targetPeer) {
          const targetConn = targetPeer._connections.get(this._peerId);
          if (targetConn) {
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
        // Handle case where first arg is options object (no ID provided)
        if (typeof id === 'object' && id !== null) {
          options = id;
          id = null;
        }
        this.id = id || 'mock-' + Math.random().toString(36).substr(2, 9);
        this.open = false;
        this.destroyed = false;
        this.disconnected = false;
        this._handlers = new Map();
        this._connections = new Map();

        peers.set(this.id, this);

        setTimeout(() => {
          this.open = true;
          this.emit('open', this.id);

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
          setTimeout(() => {
            targetPeer._handleIncomingConnection(this.id, conn);
            conn.open = true;
            conn.emit('open');
          }, 5);
        } else {
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

    window.Peer = MockPeer;
    window.__PEERJS_MOCKED__ = true;
  }
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
