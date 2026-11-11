import OSC from 'osc-js';

/**
 * OSC UDP <-> WebSocket bridge.
 *   OSC tools (TouchDesigner, Ableton, Python) --UDP--> udpServer --> every WebSocket client
 *   WebSocket client (the XR app) --> udpClient --UDP--> OSC tools
 */
export type BridgeOptions = {
  /** Where the bridge listens for OSC from tools. */
  udpServer?: { host?: string; port?: number };
  /** Where the bridge sends OSC coming from the browser. */
  udpClient?: { host?: string; port?: number };
  /** WebSocket server the XR app connects to. */
  wsServer?: { host?: string; port?: number };
};

export const DEFAULT_BRIDGE_OPTIONS = {
  udpServer: { host: '0.0.0.0', port: 9000 },
  udpClient: { host: '127.0.0.1', port: 9001 },
  wsServer: { host: '0.0.0.0', port: 8080 },
} as const;

export const startBridge = async (options: BridgeOptions = {}) => {
  const config = {
    udpServer: { ...DEFAULT_BRIDGE_OPTIONS.udpServer, ...options.udpServer },
    udpClient: { ...DEFAULT_BRIDGE_OPTIONS.udpClient, ...options.udpClient },
    wsServer: { ...DEFAULT_BRIDGE_OPTIONS.wsServer, ...options.wsServer },
  };
  const osc = new OSC({ plugin: new OSC.BridgePlugin(config) });
  await new Promise<void>((resolve, reject) => {
    osc.on('open', () => resolve());
    osc.on('error', (error: unknown) => reject(error));
    osc.open();
  });
  return {
    config,
    close: () => osc.close(),
  };
};
