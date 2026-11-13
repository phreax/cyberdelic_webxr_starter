#!/usr/bin/env node
import { DEFAULT_BRIDGE_OPTIONS, startBridge } from './bridge.ts';

// Configure with env vars, e.g. OSC_UDP_PORT=9000 OSC_TARGET_PORT=9001 OSC_WS_PORT=8080 npm run osc-bridge
const num = (value: string | undefined, fallback: number) => (value ? Number(value) : fallback);
const env = process.env;

const bridge = await startBridge({
  udpServer: { host: env.OSC_UDP_HOST ?? DEFAULT_BRIDGE_OPTIONS.udpServer.host, port: num(env.OSC_UDP_PORT, DEFAULT_BRIDGE_OPTIONS.udpServer.port) },
  udpClient: { host: env.OSC_TARGET_HOST ?? DEFAULT_BRIDGE_OPTIONS.udpClient.host, port: num(env.OSC_TARGET_PORT, DEFAULT_BRIDGE_OPTIONS.udpClient.port) },
  wsServer: { host: env.OSC_WS_HOST ?? DEFAULT_BRIDGE_OPTIONS.wsServer.host, port: num(env.OSC_WS_PORT, DEFAULT_BRIDGE_OPTIONS.wsServer.port) },
});

const { udpServer, udpClient, wsServer } = bridge.config;
console.log(`[osc-bridge] OSC in  udp://${udpServer.host}:${udpServer.port}  ->  ws://${wsServer.host}:${wsServer.port}`);
console.log(`[osc-bridge] OSC out ws  ->  udp://${udpClient.host}:${udpClient.port}`);
console.log('[osc-bridge] The dev server proxies wss://<dev-host>/osc to this WebSocket.');

const shutdown = () => {
  bridge.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
