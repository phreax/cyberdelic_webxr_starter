import dgram from 'node:dgram';
import { afterEach, describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import OSC from 'osc-js';
import WebSocket from 'ws';
import { startBridge } from './bridge.js';

const PORTS = { udpIn: 47101, udpOut: 47102, ws: 47103 };

const decode = (data: ArrayBufferLike | Buffer) => {
  const bytes = data instanceof Buffer ? data : Buffer.from(data as ArrayBuffer);
  const message = new OSC.Message();
  message.unpack(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  return { address: message.address, args: message.args };
};

const openSocket = (url: string) =>
  new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.binaryType = 'nodebuffer';
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });

let cleanup: Array<() => void> = [];
afterEach(() => {
  cleanup.forEach((fn) => fn());
  cleanup = [];
});

describe('osc-bridge', () => {
  test('UDP -> WebSocket', async () => {
    const bridge = await startBridge({
      udpServer: { host: '127.0.0.1', port: PORTS.udpIn },
      udpClient: { host: '127.0.0.1', port: PORTS.udpOut },
      wsServer: { host: '127.0.0.1', port: PORTS.ws },
    });
    const socket = await openSocket(`ws://127.0.0.1:${PORTS.ws}`);
    const udp = dgram.createSocket('udp4');
    cleanup.push(() => udp.close(), () => socket.close(), () => bridge.close());

    const received = new Promise<ReturnType<typeof decode>>((resolve) => socket.once('message', (data: Buffer) => resolve(decode(data))));
    const packet = Buffer.from(new OSC.Message('/visual/intensity', 0.75).pack());
    udp.send(packet, PORTS.udpIn, '127.0.0.1');
    const message = await received;

    assert({
      given: 'an OSC message sent over UDP by a tool',
      should: 'arrive at the WebSocket client unchanged',
      actual: { address: message.address, value: Math.round(Number(message.args[0]) * 100) / 100 },
      expected: { address: '/visual/intensity', value: 0.75 },
    });
  });

  test('WebSocket -> UDP', async () => {
    const udp = dgram.createSocket('udp4');
    await new Promise<void>((resolve) => udp.bind(PORTS.udpOut + 10, '127.0.0.1', () => resolve()));
    const bridge = await startBridge({
      udpServer: { host: '127.0.0.1', port: PORTS.udpIn + 10 },
      udpClient: { host: '127.0.0.1', port: PORTS.udpOut + 10 },
      wsServer: { host: '127.0.0.1', port: PORTS.ws + 10 },
    });
    const socket = await openSocket(`ws://127.0.0.1:${PORTS.ws + 10}`);
    cleanup.push(() => udp.close(), () => socket.close(), () => bridge.close());

    const received = new Promise<ReturnType<typeof decode>>((resolve) => udp.once('message', (data) => resolve(decode(data))));
    socket.send(new OSC.Message('/interaction/grab', 1).pack());
    const message = await received;

    assert({
      given: 'an OSC message sent by the XR app over WebSocket',
      should: 'be forwarded as UDP to the configured target',
      actual: { address: message.address, value: message.args[0] },
      expected: { address: '/interaction/grab', value: 1 },
    });
  });
});
