# Getting started

This page gets the starter running on your computer and on a Quest headset.

## 1. Install and run

```sh
npm install
npm run dev
```

Node.js **20.19+**, **22.12+** or **24+** is required (`node -v` shows yours).

`npm run dev` starts the dev server and opens a managed browser at `https://localhost:8081`.
Edit any file and the page reloads by itself.

## 2. Try XR without a headset (IWER)

The managed browser includes **IWER**, IWSDK's XR emulator. It pretends to be a Quest 3 in a
living room:

- **Desktop preview:** click the floating panels with your mouse.
- **Emulated XR:** open the Demos menu → ⚙ Session → **Enter VR** or **Enter MR**, then
  move the fake head, controllers and hands with the
  [IWER controls](https://iwsdk.dev/guides/02-testing-experience.html#iwer-controls).

## 3. Run on a Quest 3 / 3S

**Over Wi-Fi**

1. Put the computer and headset on the same Wi-Fi.
2. With `npm run dev` running, run `npm run dev:status` and copy a URL from `runtimeUrls.network`.
3. Open it in Quest Browser and accept the certificate warning (WebXR needs HTTPS, and the dev
   server uses a local certificate).
4. Press **Enter VR** (dark world) or **Enter MR** (your room, via passthrough).

**Over USB:** `adb reverse tcp:8081 tcp:8081`, then open `https://localhost:8081` on the Quest.

## 4. Moving around the menus

| Action | Controllers | Hands | Desktop |
|---|---|---|---|
| Press a button | point + trigger | point + pinch, or poke it | click |
| Show / hide menus | left Menu (≡) or Y | tap the wrist button on your left hand | `M` |
| Move a panel | grab the bar under it | pinch the bar | drag the bar |
| Grab an object | squeeze | pinch near it | — |

## Troubleshooting

- **Blank page / nothing moves:** run `npm run typecheck`. A type error can stop the app
  without a visible message.
- **Quest says "not secure":** that's expected for the local certificate. Accept it once.
- **macOS 13:** the managed browser no longer runs there. Use `npm run dev:runtime` and open
  `https://localhost:8081` in your own Chrome.
- **Settings look wrong after experimenting:** ⚙ Session → **Reset settings** restores the
  current demo's defaults.

Next: [make your own demo](make-a-demo.md).
