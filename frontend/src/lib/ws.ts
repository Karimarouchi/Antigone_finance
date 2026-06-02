import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { loadSession } from './api';

const WS_URL = (import.meta.env.VITE_WS_URL as string) || 'http://localhost:8080/ws';

let client: Client | null = null;
const subscriptions = new Map<string, Set<(msg: unknown) => void>>();

function ensureClient(): Client {
  if (client && client.active) return client;
  client = new Client({
    webSocketFactory: () => new SockJS(WS_URL) as any,
    reconnectDelay: 5000,
    beforeConnect: () => {
      const s = loadSession();
      if (s?.accessToken && client) {
        client.connectHeaders = { Authorization: `Bearer ${s.accessToken}` };
      }
    },
    onConnect: () => {
      for (const dest of subscriptions.keys()) {
        client?.subscribe(dest, (m: IMessage) => dispatch(dest, m.body));
      }
    },
  });
  client.activate();
  return client;
}

function dispatch(dest: string, body: string) {
  const set = subscriptions.get(dest); if (!set) return;
  let parsed: unknown; try { parsed = JSON.parse(body); } catch { parsed = body; }
  set.forEach((cb) => { try { cb(parsed); } catch { /* noop */ } });
}

export function subscribe<T = unknown>(destination: string, cb: (msg: T) => void): () => void {
  ensureClient();
  if (!subscriptions.has(destination)) subscriptions.set(destination, new Set());
  subscriptions.get(destination)!.add(cb as (msg: unknown) => void);
  if (client?.connected) client.subscribe(destination, (m: IMessage) => dispatch(destination, m.body));
  return () => {
    subscriptions.get(destination)?.delete(cb as (msg: unknown) => void);
  };
}

export function disconnectWs() { client?.deactivate(); client = null; subscriptions.clear(); }
