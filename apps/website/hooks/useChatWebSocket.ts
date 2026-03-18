import { useRef, useState, useEffect, useCallback } from 'react';

interface WebSocketCallbacks {
  onNewMessage: (message: RedisChatMessage) => void;
  onMessageUpdated: (message: RedisChatMessage) => void;
  onMessagesDeleted: (roomId: string) => void;
  onError?: (error: string) => void;
}

interface UseChatWebSocketReturn {
  isConnected: boolean;
  sendMessage: (message: string, replyToId?: string, token?: string) => void;
}

/**
 * React hook for WebSocket-based real-time chat.
 * 
 * Connects to the backend WebSocket server, joins the specified room,
 * and provides callbacks for incoming events. Handles reconnection
 * with exponential backoff.
 */
export function useChatWebSocket(
  roomId: string | null,
  callbacks: WebSocketCallbacks
): UseChatWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef(callbacks);
  const roomIdRef = useRef(roomId);

  // Keep refs up to date (avoids stale closures)
  callbacksRef.current = callbacks;
  roomIdRef.current = roomId;

  const getWebSocketUrl = useCallback(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    // Convert http(s) to ws(s)
    const wsUrl = backendUrl.replace(/^http/, 'ws');
    return `${wsUrl}/ws`;
  }, []);

  const connect = useCallback(() => {
    // Don't connect if no roomId
    if (!roomIdRef.current) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent reconnect on intentional close
      wsRef.current.close();
      wsRef.current = null;
    }

    const url = getWebSocketUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setIsConnected(true);
      reconnectAttemptRef.current = 0;

      // Join the room
      if (roomIdRef.current) {
        ws.send(JSON.stringify({ type: 'join_room', roomId: roomIdRef.current }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'new_message':
            if (data.message) {
              callbacksRef.current.onNewMessage(data.message);
            }
            break;

          case 'message_updated':
            if (data.message) {
              callbacksRef.current.onMessageUpdated(data.message);
            }
            break;

          case 'messages_deleted':
            if (data.roomId) {
              callbacksRef.current.onMessagesDeleted(data.roomId);
            }
            break;

          case 'room_joined':
            console.log('[WS] Joined room:', data.roomId);
            break;

          case 'error':
            console.error('[WS] Server error:', data.error);
            callbacksRef.current.onError?.(data.error);
            break;
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log('[WS] Disconnected:', event.code, event.reason);
      setIsConnected(false);
      wsRef.current = null;

      // Reconnect with exponential backoff (1s, 2s, 4s, 8s, ... max 30s)
      if (roomIdRef.current) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
        reconnectAttemptRef.current++;
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`);

        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] Connection error:', error);
    };
  }, [getWebSocketUrl]);

  // Connect when roomId changes
  useEffect(() => {
    if (!roomId) return;

    connect();

    return () => {
      // Clean up on unmount or roomId change
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (wsRef.current) {
        // Send leave_room before closing
        if (wsRef.current.readyState === WebSocket.OPEN && roomId) {
          wsRef.current.send(JSON.stringify({ type: 'leave_room', roomId }));
        }
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }

      setIsConnected(false);
    };
  }, [roomId, connect]);

  const sendMessage = useCallback((message: string, replyToId?: string, token?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[WS] Cannot send message: not connected');
      callbacksRef.current.onError?.('Not connected to chat server');
      return;
    }

    if (!roomIdRef.current) {
      console.error('[WS] Cannot send message: no roomId');
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'send_message',
      roomId: roomIdRef.current,
      message,
      replyToId,
      token
    }));
  }, []);

  return { isConnected, sendMessage };
}
