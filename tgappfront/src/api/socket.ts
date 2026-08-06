import { io, Socket } from "socket.io-client";

const listeners = new Map<string, Set<(data: unknown) => void>>();

let socket: Socket | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lastToken: string | null = null;
let authFailed = false;

const MAX_RECONNECT_ATTEMPTS = 5;
const RETRY_DELAY = 10_000;

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function attachListeners(s: Socket) {
  for (const [event, cbs] of listeners) {
    for (const cb of cbs) {
      s.on(event, cb);
    }
  }
}

export function connectWs(token: string) {
  if (!token) return;
  if (socket?.connected) return;

  disconnectWs();

  lastToken = token;
  authFailed = false;

  const s = io({
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    timeout: 10_000,
  });

  socket = s;
  attachListeners(s);

  s.on("connect", () => {
    authFailed = false;
  });

  s.on("connect_error", (err) => {
    const msg = (err as Error)?.message || "";
    if (/401|refused|unauthorized|invalid token|no token|user not found/i.test(msg)) {
      authFailed = true;
      disconnectWs();
    }
  });

  s.io.on("reconnect_failed", () => {
    if (socket !== s) return;
    clearRetryTimer();
    retryTimer = setTimeout(() => {
      if (socket === s && !authFailed && lastToken) {
        socket = null;
        connectWs(lastToken);
      }
    }, RETRY_DELAY);
  });
}

export function disconnectWs() {
  clearRetryTimer();
  lastToken = null;
  authFailed = false;
  if (socket) {
    socket.removeAllListeners();
    socket.io.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function onWsEvent<T = unknown>(event: string, cb: (data: T) => void): () => void {
  const listener = cb as (data: unknown) => void;
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(listener);
  socket?.on(event, listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(event);
    socket?.off(event, listener);
  };
}

export function sendWs(type: string, payload: Record<string, unknown>) {
  if (socket?.connected) {
    socket.emit(type, payload);
  }
}
