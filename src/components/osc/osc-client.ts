import OSC from 'osc-js';
import { matchAddress, reconnectDelay } from './osc-utils.js';

/**
 * Browser OSC client over WebSocket (talks to apps/osc-bridge). Base structure for later use:
 * no example wires it in yet (PRD §8, MVP decision).
 *
 * Default URL: wss://<page host>/osc — the Vite dev server proxies it to the bridge, so HTTPS pages
 * (required for WebXR on Quest) never hit mixed-content blocking.
 */
export type OscStatus = 'idle' | 'connecting' | 'open' | 'closed';
export type OscArg = number | string | boolean | null;
export type OscHandler = (args: OscArg[], address: string) => void;

export type OscClientOptions = {
  url?: string;
  autoConnect?: boolean;
  reconnect?: { base?: number; max?: number } | false;
};

const defaultUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/osc`;

type Decoded = { address: string; args: OscArg[] };

const flatten = (value: unknown, out: Decoded[]) => {
  if (value instanceof OSC.Bundle) value.bundleElements.forEach((element: unknown) => flatten(element, out));
  else if (value instanceof OSC.Message) out.push({ address: value.address, args: value.args as OscArg[] });
};

export const decodeOscPacket = (data: ArrayBuffer): Decoded[] => {
  const packet = new OSC.Packet();
  packet.unpack(new DataView(data));
  const out: Decoded[] = [];
  flatten(packet.value, out);
  return out;
};

export const createOscClient = ({ url = defaultUrl(), autoConnect = true, reconnect = {} }: OscClientOptions = {}) => {
  const handlers = new Set<{ pattern: string; handler: OscHandler }>();
  const statusListeners = new Set<(status: OscStatus) => void>();
  let socket: WebSocket | undefined;
  let status: OscStatus = 'idle';
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closedByUser = false;
  let lastMessageAt = 0;

  const setStatus = (next: OscStatus) => {
    status = next;
    statusListeners.forEach((listener) => listener(next));
  };

  const scheduleReconnect = () => {
    if (closedByUser || reconnect === false) return;
    timer = setTimeout(connect, reconnectDelay(attempt, reconnect));
    attempt += 1;
  };

  function connect(): void {
    clearTimeout(timer);
    closedByUser = false;
    setStatus('connecting');
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    socket = ws;
    ws.onopen = () => {
      attempt = 0;
      setStatus('open');
    };
    ws.onclose = () => {
      if (socket !== ws) return;
      setStatus('closed');
      scheduleReconnect();
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      lastMessageAt = performance.now();
      for (const { address, args } of decodeOscPacket(event.data)) {
        handlers.forEach(({ pattern, handler }) => {
          if (pattern === '' || matchAddress(pattern, address)) handler(args, address);
        });
      }
    };
  }

  if (autoConnect) connect();

  return {
    url,
    get status() {
      return status;
    },
    get lastMessageAt() {
      return lastMessageAt;
    },
    connect,
    onStatus(listener: (status: OscStatus) => void) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    /** Subscribe to an address or OSC pattern (`*`, `?`, `[..]`, `{a,b}`). Returns unsubscribe. */
    on(pattern: string, handler: OscHandler) {
      const entry = { pattern, handler };
      handlers.add(entry);
      return () => handlers.delete(entry);
    },
    /** Every incoming message (monitoring / logging). */
    onAny(handler: OscHandler) {
      const entry = { pattern: '', handler };
      handlers.add(entry);
      return () => handlers.delete(entry);
    },
    send(address: string, ...args: Array<number | string | boolean>): boolean {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(new OSC.Message(address, ...args).pack());
      return true;
    },
    close,
    dispose() {
      close();
      handlers.clear();
      statusListeners.clear();
    },
  };

  function close(): void {
      closedByUser = true;
      clearTimeout(timer);
      socket?.close();
      socket = undefined;
      setStatus('closed');
  }
};

export type OscClient = ReturnType<typeof createOscClient>;
