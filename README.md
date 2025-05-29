# BlinkChat

BlinkChat is an ultra-minimal, real-time web chat that pairs strangers instantly.  
It focuses on speed, privacy (zero persistence), and a polished user experience that works straight from a single command line run.

## ✨ Key Features

| Category | Description |
|----------|-------------|
| **Real-time Matching** | Instant random pairing via WebSockets with no sign-up. |
| **Live Typing Indicator** | See “_User is typing…_” in real time for a more natural chat flow. |
| **Subtle Notification Sound** | Modern “bip” sound on incoming messages (toggleable & remembered between sessions). |
| **Modern, Polished UI** | Redesigned with Tailwind CSS, animated message bubbles, dark theme, responsive layout. |
| **Zero Persistence** | Messages are never stored—when a chat ends, everything disappears. |
| **One-Command Launch** | `npm install && npm start` is all you need. |

## 🚀 Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/Knh0m/BLINKCHAT.git
   cd BLINKCHAT
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run the app**

   ```bash
   npm start
   ```

4. **Open your browser**

   Navigate to **http://localhost:3000** and start chatting!

### Environment Variables (optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT`   | `3000`  | Change the server port. |

## 🛠️ Technologies Used

- **Node.js** & **Express** – Lightweight HTTP server.
- **ws** – Bare-metal WebSocket library for real-time communication.
- **Vanilla JavaScript** – No frontend framework, minimal bundle size.
- **Tailwind CSS** – Utility-first styling for the modern UI.
- **HTML5 Audio API** – Plays the notification “bip”.
- **ES Modules** – Clean, modern JS module structure.

## 📸 Screenshots / GIFs

> _Coming soon – visual walkthroughs of the new design, typing indicator, and sound toggle._

---

Made with ❤️ for lightning-fast, anonymous conversations. Enjoy chatting!
