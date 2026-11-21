# Graph Report - LunaJam  (2026-11-21)

## Corpus Check
- 47 files · ~35,987 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .css 1)

## Summary
- 612 nodes · 1628 edges · 27 communities (18 shown, 9 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 123 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5fa43c33`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Native UI Integration
- Discord RPC & Build
- Plugin Orchestration & Discord
- protocol.ts
- Relay Server Rooms
- hub.ts
- index.ts
- @types/react-dom@^19.3.0
- Docker & Server Deployment
- client.ts
- Test Mocks & Fixtures
- Runtime Package Config
- Dev Dependencies Config
- Plugin Manifest Config
- TypeScript Config
- ESLint Config
- NPM Scripts Config
- QueueTrack
- Luna Build Plugin
- Package Author Metadata
- ESLint Dependency
- jsdom
- @types/jsdom@^30.0.0
- @types/qrcode@^1.5.6
- React Types
- TypeScript Dependency
- PopoverController

## God Nodes (most connected - your core abstractions)
1. `SessionClient` - 56 edges
2. `Rooms` - 39 edges
3. `TidalQueueSync` - 21 edges
4. `Profile` - 20 edges
5. `AudioMode` - 18 edges
6. `decodeClient()` - 18 edges
7. `normalizeServerUrl()` - 17 edges
8. `ClientMsg` - 16 edges
9. `localProfile()` - 16 edges
10. `decodeServer()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Wire Format` --references--> `SessionClient`  [INFERRED]
  docs/ARCHITECTURE.md → plugins/lunajam/src/session/client.ts
- `TIDAL Desktop Synchronization` --references--> `toNativeItemId()`  [INFERRED]
  docs/ARCHITECTURE.md → plugins/lunajam/src/tidal/metadata.ts
- `TIDAL Desktop Synchronization` --references--> `ensureQueueInStore()`  [INFERRED]
  docs/ARCHITECTURE.md → plugins/lunajam/src/tidal/metadata.ts
- `UI Mounting and Contributor Avatars` --references--> `QueueAvatarDecorator`  [INFERRED]
  docs/ARCHITECTURE.md → plugins/lunajam/src/ui/queueAvatars.ts
- `Wire Format` --references--> `Rooms`  [INFERRED]
  docs/ARCHITECTURE.md → server/src/rooms.ts

## Import Cycles
- None detected.

## Communities (27 total, 9 thin omitted)

### Community 0 - "Native UI Integration"
Cohesion: 0.10
Nodes (38): Profile, SessionState, openTidalProfile(), Avatar(), avatarColor(), AvatarStack(), initialsFor(), PALETTE (+30 more)

### Community 1 - "Discord RPC & Build"
Cohesion: 0.06
Nodes (38): root, dist, types, allowRate(), corsHeaders(), drainLoopbackJoins(), LoopbackJoinRequest, pendingJoins (+30 more)

### Community 2 - "Plugin Orchestration & Discord"
Cohesion: 0.12
Nodes (7): queueSync, PlaybackInput, QueueTrackInput, SessionClient, normalizeServerUrl(), wsUrlFromServer(), QueueHeaderCard()

### Community 3 - "protocol.ts"
Cohesion: 0.13
Nodes (37): Wire Format, AVATAR_DOMAINS, COVER_DOMAINS, decode(), decodeClient(), decodeServer(), Envelope, fin() (+29 more)

### Community 4 - "Relay Server Rooms"
Cohesion: 0.12
Nodes (19): ClientMsg, CROCKFORD_ALPHABET, EndReason, MAX_QUEUE_TRACKS, Participant, PlaybackSnapshot, generateRoomCode(), generateStandbyId() (+11 more)

### Community 5 - "hub.ts"
Cohesion: 0.09
Nodes (19): encode(), ServerMsg, Config, intEnv(), loadConfig(), BASE_SECURITY_HEADERS, Conn, extractClientIp() (+11 more)

### Community 6 - "index.ts"
Cohesion: 0.07
Nodes (43): attemptedMeta, errSignal, joinJam(), popover, queueAvatars, session, Settings, startJam() (+35 more)

### Community 8 - "Docker & Server Deployment"
Cohesion: 0.07
Nodes (28): context, dockerfile, LUNAJAM_HOST, LUNAJAM_HOST_GRACE_MS, LUNAJAM_IDLE_MS, LUNAJAM_MAX_CONNECTIONS, LUNAJAM_MAX_PARTICIPANTS, LUNAJAM_MAX_ROOMS (+20 more)

### Community 9 - "client.ts"
Cohesion: 0.05
Nodes (37): playback, queueHeader, ControlAction, InsertPosition, QueueTrackReplace, Role, RoomSnapshot, TrackMetaUpdate (+29 more)

### Community 10 - "Test Mocks & Fixtures"
Cohesion: 0.08
Nodes (16): ContextMenu, dispatched, getDispatched(), InterceptFn, interceptMap, ipcRenderer, MediaItem, PlayState (+8 more)

### Community 11 - "Runtime Package Config"
Cohesion: 0.18
Nodes (12): dependencies, qrcode@^1.5.4, ws@^8.22.2, description, engines, node, name, private (+4 more)

### Community 12 - "Dev Dependencies Config"
Cohesion: 0.15
Nodes (13): devDependencies, esbuild@^0.28.2, react@^19.3.1, react-dom@^19.3.1, tsx@^4.23.12, @types/node@^22, @types/ws@^8.18.2, vitest@^5.1.0 (+5 more)

### Community 13 - "Plugin Manifest Config"
Cohesion: 0.22
Nodes (8): author, name, url, description, main, name, type, version

### Community 14 - "TypeScript Config"
Cohesion: 0.33
Nodes (5): luna/tsconfig.json, compilerOptions, jsx, extends, include

### Community 15 - "ESLint Config"
Cohesion: 0.40
Nodes (4): @eslint/js@^10.0.1, typescript-eslint@^8.72.2, @eslint/js, typescript-eslint

### Community 16 - "NPM Scripts Config"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, test

### Community 19 - "Package Author Metadata"
Cohesion: 0.67
Nodes (3): author, name, url

### Community 28 - "PopoverController"
Cohesion: 0.09
Nodes (15): Clock Offset and Drift Hysteresis, Discord RPC and Loopback Handoff, LunaJam Architecture, TIDAL Desktop Synchronization, UI Mounting and Contributor Avatars, findUtilityContainer(), FooterButtonMount, PopoverController (+7 more)

## Knowledge Gaps
- **1 isolated node(s):** `luna/tsconfig.json`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 148 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SessionClient` connect `Plugin Orchestration & Discord` to `Native UI Integration`, `Discord RPC & Build`, `protocol.ts`, `index.ts`, `client.ts`, `QueueTrack`, `PopoverController`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **What connects `luna/tsconfig.json` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Native UI Integration` be split into smaller, more focused modules?**
  _Cohesion score 0.0962962962962963 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Native UI Integration` to `Test Mocks & Fixtures`, `Runtime Package Config`, `Dev Dependencies Config`, `index.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Should `Discord RPC & Build` be split into smaller, more focused modules?**
  _Cohesion score 0.06240084611316764 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Dev Dependencies Config` to `Discord RPC & Build`, `protocol.ts`, `hub.ts`, `index.ts`, `client.ts`, `Runtime Package Config`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `Plugin Orchestration & Discord` be split into smaller, more focused modules?**
  _Cohesion score 0.12077294685990338 - nodes in this community are weakly interconnected._