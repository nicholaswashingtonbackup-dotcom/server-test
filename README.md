# Executive Meeting Platform (EMP)

A beautiful, premium, mobile-first secure meeting thin client built specifically to communicate with the **Executive Operating System (EXOS)**. 

Designed with modern high-contrast Dark, Glassmorphic aesthetics ("Microsoft Loop meets Discord meets ChatGPT"), this application delivers a highly polished corporate briefing and decision boardroom environment.

---

## 🏗️ Architecture Design & Philosophy

This application is engineered strictly as a **Thin Client** complying with the EXOS design specifications. It holds no duplicate business planning logic, no local AI orchestration frameworks, and no secret vector databases. It relies on a single gateway adaptor to connect with EXOS:

```
[ Client Mobile/Desktop Web ]
            ↓
    [ Meeting Adapter ]  <--- src/lib/exosAdapter.ts (with Offline Cache)
            ↓
       [ EXOS Core ]     <--- server.ts API gateways
            ↓
  [ Executive Board ]    <--- Strategy (Nova), Tech (Astra), Growth (Fuego), Legal (Jarvis), finance (Sisters)
            ↓
  [ LLM Core Engine ]    <--- Server-side Google Gemini 3.5 Models
```

### Key Modules:
- **`src/types.ts`**: Central, strictly-typed schemas for meetings, executives, messages, polls, tasks, timeline events, and whiteboard vectors.
- **`src/lib/exosAdapter.ts`**: The exclusive communications tunnel. Implements elegant offline caching (`localStorage`) supporting complete reconnectivity and sync workflows during signal drops.
- **`src/components/WaveformVisualizer.tsx`**: Dynamic HTML5 Canvas wave rendering. Reacts to Voice Activity Detection (VAD) states (`Speaking`, `Thinking`, `Listening`).
- **`src/components/SharedWhiteboard.tsx`**: Interactive real-time canvas mapping collaborative vector diagrams and flows.
- **`server.ts`**: Express full-stack proxy running behind the gateway. Performs lazy client initialization and harnesses Google Gemini (`gemini-3.5-flash` & `gemini-3.1-flash-tts-preview`) to act as the EXOS backend, compiling transcripts, generating audio synthesis streams, and crafting comprehensive post-meeting reports.

---

## ⚡ Quick Start & Deployment

### Local Development
1. Install base dependencies:
   ```bash
   npm install
   ```
2. Start the development cluster:
   ```bash
   npm run dev
   ```
The Express adapter and Vite asset pipeline bind to host `0.0.0.0` on port `3000`.

### Production Build & Bundling
This platform is optimized for seamless deployment. The bundler compiles the TypeScript server into a **single, self-contained CommonJS file** (`dist/server.cjs`) using `esbuild`, keeping dependencies external and avoiding strict ES Module runtime errors.

1. Build assets and backend server:
   ```bash
   npm run build
   ```
2. Run the production container:
   ```bash
   npm run start
   ```

---

## 🔑 Environment Variables

Declare any keys or secrets in `.env`:
- `GEMINI_API_KEY`: Required for server-side EXOS executive emulation and automated transcript summarizing. (EXOS operates in a robust offline simulation mode if undefined).

---

## 🧪 Testing Guidelines

This application was designed with testability in mind.
- **Adapter Mocks**: `src/lib/exosAdapter.ts` is fully testable offline without network connections, falling back gracefully to standard localStorage state management.
- **Linter & Syntax Verification**:
  ```bash
  npm run lint
  ```
- **Component Audits**: Verify CSS contrast, click bounds, touch targets (>44px), and keyboard focus rings for complete accessibility compliance.
- **Visual Waveforms**: Change `currentVADState` in `MeetingRoom.tsx` to manually trigger and test sine amplitude rendering.

---

## 🚀 Future Extension Points
1. **Biometric Session Verification**: Integrate WebAuthn for secure fingerprint/facial scan MFA.
2. **WebSocket Audio Pipeline**: Convert the current voice adapter into a continuous duplex streaming WebSocket connection utilizing Gemini Live API.
3. **Automated Jira/Linear Syncer**: Auto-push compiled tasks in the meeting summary report to operational task managers.
