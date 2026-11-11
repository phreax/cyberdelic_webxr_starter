# OSC (base structure)

OSC is ready to use but **not wired into the examples** (MVP decision). Browsers can't receive UDP,
so a small Node bridge translates between OSC/UDP and a WebSocket.

```text
TouchDesigner / Ableton / Python ──UDP :9000──▶ apps/osc-bridge ──ws :8080──▶ Vite dev server (wss /osc) ──▶ XR app
XR app ──wss /osc──▶ bridge ──UDP──▶ 127.0.0.1:9001
```

## Run

```sh
npm run osc-bridge            # defaults: UDP in 9000, UDP out 127.0.0.1:9001, WebSocket 8080
OSC_UDP_PORT=7000 OSC_TARGET_HOST=192.168.1.20 OSC_TARGET_PORT=7001 npm run osc-bridge
```

## Use in an experience

```ts
const { dispose } = await createExperience(world, { osc: true, scene: myScene }); // ctx.osc

// inside init(ctx)
import { bindOSC } from '../../core/parameters/bindings.js';
ctx.track(bindOSC(ctx.params, ctx.osc!, '/visual/growth', 'growth'));              // 0..1 → param range
ctx.track(bindOSC(ctx.params, ctx.osc!, '/midi/cc/1', 'hue', { inputRange: [0, 127] }));
ctx.track(ctx.osc!.on('/scene/*', (args, address) => console.log(address, args))); // OSC patterns: * ? [] {}
ctx.osc!.send('/interaction/grab', 1);
```

`ctx.osc.status` is `connecting | open | closed`; it reconnects automatically with capped backoff.

## Secure WebSockets (HTTPS / Quest)

WebXR needs HTTPS, and HTTPS pages may only open `wss://` sockets. In development the client
connects to `wss://<dev-host>/osc` and the Vite dev server (already HTTPS) proxies it to the bridge
(`vite.config.ts → server.proxy['/osc']`), so the Quest needs no extra certificate.

For production, put the bridge behind a TLS reverse proxy (Caddy, nginx) on the venue network and
pass its URL: `createExperience(world, { osc: { url: 'wss://osc.venue.local' }, ... })`.
