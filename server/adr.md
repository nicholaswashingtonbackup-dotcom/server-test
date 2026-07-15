# Architectural Decision Record (ADR)

## ADR-001: Authoritative Desktop-Hosted Executive Meeting Server Architecture

### Context
The EXOS Executive Meeting Platform is moving away from decentralization or thin-client-authoritative state. The platform runs natively on the secure Windows EXOS computer environment, which must serve as the sole source of truth for all meetings, archives, permissions, and executive interactions. Clients (Android apps, desktop browsers, tablets) must function as simple, secure thin clients that connect strictly via standard interfaces (HTTPS and WebSockets).

Furthermore, the server must run within local host boundaries while strictly guarding private internal AI engines, voice engines (Vosk, Canary, Edge TTS), and secure data directories.

### Decision
For Phase 1 (Meeting Gateway, Authentication, Meeting Manager, Connection Manager), we establish an authoritative server-side architecture built natively inside our Express Node environment:

1. **Central Meeting State & Capacity Constraint**:
   - The server maintains the central authoritative `MeetingState` in-memory with real-time operations, synchronized immediately to local secure files (`metadata.json`, `transcript.json`, etc.) to prevent data loss.
   - We enforce a **strict limit of maximum 5 human participants** per meeting. Clients cannot bypass this limit as the server actively counts active human sessions and blocks unauthorized join operations.
   - Virtual executive board members join virtually and do not count against the 5-human participant limit.

2. **Security & Session Tokens**:
   - Authentication resides on the server. Dev bypass uses the local credentials `Nicholas Washington` and `BANKAI1983`, generating secure, unique cryptographically random tokens (e.g. `exos-token-...`).
   - A single-token standard is exposed, compatible with future mobile/Android clients and browsers alike.

3. **Private Executive Board Isolation**:
   - Internal providers, direct LLM endpoints, and voice runtime configurations are kept private.
   - Thin clients send requests to a single Gateway Endpoint which safely invokes internal Experience OS services.

4. **Structured Archiving**:
   - Each meeting session is allocated an isolated directory structure (`meetings/<meeting_id>/`) containing metadata, transcripts, decisions, and action items.
   - Standard safeguards ensure archived meeting data is never overwritten.

5. **YAML Configuration**:
   - The server parameters (port, max capacity, paths, websocket triggers) are dynamically configured via `meeting_server.yaml`, guaranteeing adaptability for onsite deployments.

### Consequences
- **Security**: Complete abstraction of private AI capabilities. No third-party API keys or raw service provider parameters are exposed to clients.
- **Resilience**: Client disconnects or application crashes do not jeopardize meeting summaries or records as all transcript streams are recorded immediately by the authoritative host.
- **Portability**: All thin clients utilize a unified API format, making mobile integration highly deterministic.
