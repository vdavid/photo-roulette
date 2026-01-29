# Contributing to Photo Roulette

Hi there!
Fix a bug, add a feature, or just poke around.
This doc helps you understand how the codebase fits together.

---

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** — install with `npm install -g pnpm`

## Getting started

```bash
# Clone the repo
git clone https://github.com/vdavid/photo-roulette.git
cd photo-roulette

# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

The app runs at http://localhost:5173.

## Running tests

```bash
# Run unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run E2E tests (requires the dev server running)
pnpm test:e2e
```

## Code style

```bash
# Check for lint errors
pnpm lint

# Auto-fix lint errors
pnpm lint:fix

# Check formatting
pnpm format:check

# Auto-format all files
pnpm format
```

The project uses ESLint + Prettier. Format-on-save is configured for VS Code.

---

## Codebase overview

This is a SvelteKit app with PeerJS for P2P networking. Here's how the pieces connect:

### Architecture pattern

This is a multi-game platform that can host multiple party games. Each game has its own module under `src/lib/games/`.

| Directory                       | Purpose                                     |
| ------------------------------- | ------------------------------------------- |
| `src/routes/`                   | SvelteKit pages and entry point             |
| `src/lib/common/`               | Shared code across all games                |
| `src/lib/common/components/`    | Reusable UI components (Button, Card, etc.) |
| `src/lib/common/networking/`    | Base P2P networking (PeerJS wrapper)        |
| `src/lib/common/stores/`        | Shared store utilities                      |
| `src/lib/views/`                | Game selector and shared views              |
| `src/lib/games/`                | Game-specific modules                       |
| `src/lib/games/photo-roulette/` | Photo Roulette game                         |
| `src/lib/games/hot-takes/`      | Hot Takes game                              |

#### Game module structure

Each game follows the same structure:

```
src/lib/games/<game-name>/
├── logic/           # Pure game logic (state, scoring, rounds)
│   ├── types.ts     # Game-specific types
│   ├── state.ts     # State machine
│   ├── scoring.ts   # Points calculation
│   └── round.ts     # Round management
├── networking/      # Game-specific networking
│   ├── types.ts     # Message types
│   ├── host.ts      # Host networking
│   └── player.ts    # Player networking
├── views/           # Svelte view components
├── components/      # Game-specific UI components
├── store.svelte.ts  # Svelte 5 reactive store
└── index.ts         # Game definition export
```

---

## Key files explained

### 1. Landing page & player input

**File:** `src/lib/views/Landing.svelte`

Handles the initial screen where players choose to host or join a game:

- Player name input (max 20 characters)
- Room code input (4 uppercase characters for joining)
- Emoji picker from `ANIMAL_EMOJIS` constant
- Two modes: "host" and "join"

**Related:**

- `src/lib/components/EmojiPicker.svelte` — Emoji selection component
- `src/lib/components/Input.svelte` — Reusable input component
- `src/lib/game/constants.ts` — Contains `ANIMAL_EMOJIS` array

---

### 2. Photo connection logic (including test mode)

**Primary file:** `src/lib/stores/game.svelte.ts`

The `connectPhotos()` function orchestrates photo handling:

1. **Test mode detection**: Calls `isTestPlayer(myName)` from `test-photos.ts`
   - Checks if name matches pattern: 3 identical uppercase letters (AAA, BBB, etc.)
   - If test player: generates fake photos with `generateTestPhotos(myName, 15)`
   - If real player: fetches from Google Photos API

2. **Real photo flow**:
   - Accepts a `pickerFn` callback that returns selected photos
   - Calls `processPickedPhotos()` to fetch, resize, and compress to base64

3. **Test photo generation**: `src/lib/photos/test-photos.ts`
   - Creates canvas-based images labeled "AAA/1", "AAA/2", etc.
   - Uses color mapping by first letter (A=Red, B=Blue, etc.)
   - Returns 15 `ProcessedImage` objects with base64 imageData

**Networking integration:**

- For host: updates own `player.photoIds` and sets `isReady` if >= 15 photos
- For players: sends photos to host via `playerNetwork.sendPhotos()`
- Host aggregates all player photos into `photoPool` via `photosSubmitted` event

---

### 3. Game state synchronization & round management

**Central state management:** `src/lib/stores/game.svelte.ts`

The Svelte store maintains:

- `internalState` (GameState) — authoritative on host
- Reactive variables for UI updates
- `syncState()` function to propagate changes

**Host networking:** `src/lib/networking/host.ts`

Manages:

- **Room creation**: `createRoom()` generates 4-char room code
- **Player join handling**: validates game isn't full (max 8 players)
- **Broadcasting**: sends messages to all connected players
  - `broadcastPlayerUpdate()` — name/emoji changes
  - `broadcastSettingsChange()` — game settings
  - `broadcastGameStarting()` — game begins
  - `broadcastRoundStart()` — new round with image data (base64)
  - `broadcastRoundEnd()` — results and scores
  - `broadcastGameEnd()` — final results

**Player (client) networking:** `src/lib/networking/player.ts`

Handles:

- **Join flow**: connects to host, sends `PlayerJoinRequestMessage`
- **Event listeners**: listens for 13+ message types
- **Reconnection**: auto-attempts up to `MAX_RECONNECT_ATTEMPTS` times
- **State sync**: updates local state on `roundStart`, `roundEnd`, `gameEnd` events

**Message types:** `src/lib/networking/types.ts`

Complete type definitions:

- Connection: `join-request`, `join-accepted`, `join-rejected`, `player-left`, `player-kicked`
- Lobby: `player-update`, `photos-submitted`, `settings-changed`, `game-starting`
- Game: `round-start`, `guess-submitted`, `round-end`, `game-end`
- State: `state-sync`, `ping/pong`

**P2P infrastructure:** `src/lib/networking/peer-manager.ts`

- Uses PeerJS library for WebRTC data connections
- Room code maps to peer ID deterministically
- Connection timeout: 5000ms
- Ping/pong health checks every 2000ms

---

### 4. Photo selection & randomization logic

**File:** `src/lib/game/round.ts`

**Photo pool management:**

```
PhotoPool: { available: Photo[], used: Photo[] }
```

**Round functions:**

- `createPhotoPool(photos)` — creates initial pool from all players' photos
- `selectRandomPhoto(pool)` — randomly selects from available pool
  - Moves selection to "used" array
  - When exhausted: reshuffles used photos back into available
  - Uses Fisher-Yates shuffle algorithm
- `createRound()` — creates Round object with selected photo
- `completeRound()` — processes guesses and calculates scores
- `allPlayersGuessed()` — checks if round can end early

**Game flow in store:**

1. `startGame()`: creates photoPool from all connected photos
2. `startNextRoundInternal()`: selects random photo, broadcasts to players, starts timer
3. `endRound()`: completes round, calculates scores, advances or shows final results

---

### 5. Game logic modules

| Module            | Purpose                                                   |
| ----------------- | --------------------------------------------------------- |
| `state.ts`        | State machine with valid transitions                      |
| `round.ts`        | Round creation, photo selection, guess tracking           |
| `scoring.ts`      | Points calculation (correct=100, fastest=50, featured=50) |
| `superlatives.ts` | Special awards computation                                |
| `types.ts`        | TypeScript interfaces for all entities                    |

---

## View lifecycle

Driven by `gameStore.phase`:

```
landing → lobby → playing → results → final
```

1. **Landing** (`Landing.svelte`) — host/join selection
2. **Lobby** (`Lobby.svelte`) — waiting room with settings, photo connection
3. **Game** (`Game.svelte`) — round in progress with photo, guessing, timer
4. **Results** (`Results.svelte`) — round results, scores, leaderboard
5. **Final** (`Final.svelte`) — rankings, superlatives, rematch/new game

---

## Data flow summary

```
User Input (Landing)
    ↓
Store: hostGame() / joinGame()
    ↓
Networking: HostNetwork / PlayerNetwork (PeerJS)
    ↓
Game State: GameState in internalState
    ↓
Stores: Reactive variables (phase, players, round, etc.)
    ↓
Views: Svelte components re-render
    ↓
Photo Integration:
  - Real: Google Photos OAuth → picker → image-processor → base64
  - Test (AAA, BBB): generateTestPhotos() → canvas → base64
    ↓
Round Management:
  - selectRandomPhoto() → create Round → broadcast imageData
  - Collect guesses → calculate scores → advance to next round
```

---

## Running locally

```bash
pnpm install
pnpm dev
```

## Running tests

```bash
pnpm test
```

## Code style

```bash
pnpm lint
pnpm format
```

See `AGENTS.md` for detailed coding guidelines.
