/**
 * WebSocket Connection Manager
 * 
 * Uses Bun's native pub/sub for room-based broadcasting.
 * Elysia creates new ElysiaWS wrapper objects per event, so using
 * wrapper identity for Map keys is unreliable. Bun's pub/sub operates
 * at the raw socket level and avoids this issue entirely.
 */
class WebSocketManager {
  private server: any = null;
  private connectionCount = 0;

  /**
   * Set the Bun server reference for server-side publishing.
   * Must be called after app.listen().
   */
  setServer(server: any) {
    this.server = server;
  }

  /**
   * Register a new WebSocket connection (for counting)
   */
  registerConnection(_ws: any) {
    this.connectionCount++;
  }

  /**
   * Remove a connection (for counting).
   * Bun automatically unsubscribes from all topics on close.
   */
  removeConnection(_ws: any) {
    this.connectionCount--;
  }

  /**
   * Subscribe a connection to a room's messages using Bun native pub/sub
   */
  joinRoom(ws: any, roomId: string) {
    ws.subscribe(`room:${roomId}`);
    console.log(`[WS] Connection joined room ${roomId}`);
  }

  /**
   * Unsubscribe a connection from a room
   */
  leaveRoom(ws: any, roomId: string) {
    ws.unsubscribe(`room:${roomId}`);
    console.log(`[WS] Connection left room ${roomId}`);
  }

  /**
   * Broadcast a message to all connections in a room via Bun pub/sub.
   * Uses server.publish() which sends to ALL subscribers (including sender).
   */
  broadcastToRoom(roomId: string, type: string, data: any) {
    if (!this.server) {
      console.error('[WS] Cannot broadcast: server not initialized');
      return;
    }
    const payload = JSON.stringify({ type, ...data });
    this.server.publish(`room:${roomId}`, payload);
  }

  /**
   * Send a message to a specific connection
   */
  sendTo(ws: any, type: string, data: any) {
    try {
      ws.send(JSON.stringify({ type, ...data }));
    } catch (err) {
      console.error('[WS] Error sending to connection:', err);
    }
  }

  /**
   * Get total connection count
   */
  getTotalConnectionCount(): number {
    return this.connectionCount;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
