# BlinkChat

Ultra-minimal, zero-persist random chat—Omegle-lite in 2025 style.  
Land → get a fun nickname → instantly paired with a stranger via WebSockets → chat in real-time. No accounts, no history, one page, ~200 kB total.

---

## Features
- 🔀 **Random nickname** (`<Adjective><Animal>#<nn>`, e.g. `SwiftFox#92`)
- 🤝 **One-line matchmaking** – first user waits, second user connects
- ⚡ **Realtime messaging** – WebSockets (`ws`), text-only, 500 char limit
- 🌓 **Minimal modern UI** – Tailwind CDN, dark mode, auto-scroll, fade-in bubbles, “New Chat” button
- 🗑 **Zero persistence** – all conversations live in RAM
- 🛡 **Heartbeat & cleanup** – 30 s ping to drop dead connections
- 🚀 **Performance-first** – Lighthouse ≥ 95, page weight ≤ 200 kB

---

## Quick Start ( ≤ 60 s)

```bash
git clone https://github.com/yourname/blinkchat
cd blinkchat
npm install
npm start        # opens http://localhost:3000
```

Open two browser tabs to start chatting.

---

## Local Development

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Start server | `npm start` |
| Lint (optional) | _none – pure vanilla_ |
| Port | `3000` (env `PORT` overrides) |

Hot-reload isn’t needed—frontend JS is a single file; refresh to pick up changes.

---

## One-Command Deploys

| Platform | Command |
|----------|---------|
| **Railway** | `railway up` |
| **Fly.io** | `fly launch --no-deploy && fly deploy` |
| **Render** | `render.yaml` autodetected → press **Deploy** or run `render deploy` |

> All services detect `npm start` and expose `PORT`.

---

## Project Structure

```
blinkchat/
├─ package.json        # deps & start script
├─ server.js           # Express + ws (~120 LOC)
└─ public/
   ├─ index.html       # single page UI
   ├─ main.js          # client logic (ESM)
   └─ styles.css       # (unused – Tailwind CDN)
```

No build tools, no bundlers. Pure ES modules everywhere.

---

## Technical Specs

| Layer | Stack |
|-------|-------|
| Backend | Node 18+, Express 4, `ws` 8 |
| Frontend | Vanilla JS, Tailwind CDN |
| Transport | RFC 6455 WebSocket |
| Matchmaking | single `waitingClient` variable (RAM only) |
| Security | 500 char guard, XSS-safe text nodes, heartbeat cleanup |

---

## Performance Notes

* **Tiny payloads** – CDN Tailwind, gzipped HTML+JS ≤ 20 kB < 200 kB budget.
* **No blocking scripts** – `type="module"` + HTTP/2 parallelism.
* **Auto GC** – on `close`, sockets are removed; memory stays flat.
* **Instant DOM updates** – minimal reflows; `scrollTop` after append.

---

## Contributing

1. Fork & clone  
2. Create a feature branch (`git checkout -b feat/my-idea`)  
3. Commit with conventional messages  
4. Open a pull request – small, focused, well-described  
5. Ensure `npm start` passes manual smoke test in two tabs

All contributions must keep **zero-persist, no-build** philosophy.

---

## License

MIT © 2025 BlinkChat contributors
