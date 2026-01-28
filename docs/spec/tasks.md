# Bunny photoroulette game thing — task list

This is the implementation roadmap. For full details, see:

- [tech.md](./tech.md) — architecture, stack, constraints
- [game.md](./game.md) — game flow, scoring, UI design

Tick off tasks when done.

---

## Phase 1: Project setup

### 1.1 Initialize SvelteKit project

- [x] Create SvelteKit project with TypeScript
- [x] Configure `pnpm` as package manager
- [x] Enable TypeScript strict mode

### 1.2 Code quality tooling

- [x] Add Prettier (latest from npm)
- [x] Add ESLint (latest from npm) with Svelte + TypeScript plugins
- [x] Configure `.prettierrc` and `.eslintrc`
- [x] Add format/lint scripts to `package.json`
- [x] Set up VS Code settings for auto-format on save

### 1.3 Testing setup

- [x] Configure Vitest (included with SvelteKit)
- [x] Add test script to `package.json`
- [x] Create sample test to verify setup works

---

## Phase 2: Core game logic (with tests)

All game logic should be pure TypeScript functions, tested independently of UI.

### 2.1 Types and constants

- [x] Define TypeScript types: `Player`, `Photo`, `Round`, `GameState`, `Guess`, etc.
- [x] Create constants file: timers, scoring values, limits, emoji list

### 2.2 Scoring logic

- [x] Implement `calculateRoundScore()` — correct guess, fastest bonus, featured bonus
- [x] Implement `calculateFinalScores()` — aggregate all rounds
- [x] **Tests**: all scoring scenarios, edge cases (no guess, self-guess, ties)

### 2.3 Round management

- [x] Implement `selectRandomPhoto()` — pick from pool, track used photos
- [x] Implement `advanceRound()` — progress game state
- [x] Implement `determineWinner()` — find fastest correct guess
- [x] **Tests**: photo selection, round progression, repeat handling

### 2.4 Game flow state machine

- [x] Define game phases: `landing` → `lobby` → `playing` → `results` → `final`
- [x] Implement state transitions
- [x] **Tests**: all valid transitions, invalid transition handling

### 2.5 Superlatives calculation

- [x] Implement end-game stats: fastest fingers, most featured, accuracy, etc.
- [x] **Tests**: superlative calculations with various game scenarios

---

## Phase 3: Networking (PeerJS)

### 3.1 Connection management

- [x] Host: create peer, generate room code
- [x] Player: connect to host via room code
- [x] Handle connection/disconnection events
- [x] Implement reconnection logic

### 3.2 Message protocol

- [x] Define message types: `player-joined`, `photos-ready`, `start-game`, `round-start`, `guess`, `round-result`, etc.
- [x] Implement message serialization/deserialization
- [x] Host: broadcast to all players
- [x] Player: send to host only

### 3.3 State synchronization

- [x] Host: maintain authoritative game state
- [x] Broadcast state updates to all players
- [x] Handle late joins / reconnects

---

## Phase 4: Google Photos integration

### 4.1 OAuth setup

- [x] Create Google Cloud project
- [x] Configure OAuth consent screen (unverified, test users)
- [x] Get client ID for Picker API

### 4.2 Picker API integration

- [x] Implement session creation
- [x] Open picker in new tab with `/autoclose`
- [x] Poll for completion
- [x] Retrieve `baseUrl`s for selected photos
- [x] Handle session expiry (60 min)

---

## Phase 5: UI components

All components follow the autumn color palette and design principles in [game.md](./game.md#ui-design).

### 5.1 Landing page

- [x] "Host a game" button
- [x] "Join a game" with room code input
- [x] Friendly welcome text

### 5.2 Lobby

- [x] Room code display + copy button
- [x] Game settings chips (host can edit)
- [x] Player list with name, emoji, photo count, ready state
- [x] "Connect your photos" button
- [x] Player name input + animal emoji picker
- [x] "Start game" button (host only, enabled when ready)

### 5.3 Round view

- [x] Photo display with letterbox fit
- [x] Progressive blur reveal (3 sec)
- [x] Ken Burns slow zoom effect
- [x] Circular progress ring timer
- [x] Player guess buttons with checkmark selection
- [x] Live guess counter ("5/8 have guessed")

### 5.4 Round result view

- [x] "It was X's photo!" header
- [x] Who guessed what list (correct/wrong/no guess)
- [x] Points earned this round
- [x] Current leaderboard
- [x] Auto-advance timer

### 5.5 Final scoreboard

- [x] Confetti animation
- [x] Podium with top 3 + crown for winner
- [x] Full leaderboard
- [x] Superlatives section
- [x] Expandable detailed stats
- [x] "Rematch" and "New game" buttons

### 5.6 Shared components

- [x] Loading spinner (CSS-only)
- [x] Photo loading with progress (if feasible)
- [x] Connection status indicator (low priority)
- [x] Sound effects (soft tick, chime, whoosh, victory)

---

## Phase 6: Integration and polish

### 6.1 End-to-end flow

- [ ] Connect all phases: landing → lobby → game → results
- [ ] Test with 2+ browser windows
- [ ] Test on mobile (phone + laptop)

### 6.2 Error handling

- [ ] Photo load failures → skip gracefully
- [ ] Connection drops → show status, allow reconnect
- [ ] Google Photos session expiry → prompt to refresh

### 6.3 Mobile responsiveness

- [ ] Test all views on narrow screens
- [ ] Ensure 44px tap targets
- [ ] No hover-only interactions

---

## Phase 7: Documentation

### 7.1 README.md

- [ ] Project description
- [ ] How to play (for friends)
- [ ] Tech stack overview
- [ ] Link to development docs

### 7.2 CONTRIBUTING.md

- [ ] Prerequisites (Node, pnpm)
- [ ] Clone and install
- [ ] Run in dev mode
- [ ] Run tests
- [ ] Code style / linting

### 7.3 docs/releasing.md

- [ ] Build for production
- [ ] Deploy to GitHub Pages
- [ ] Deploy to standard Linux server (nginx, etc.)
- [ ] Environment variables / configuration

---

## Done criteria

A task is done when:

- Code is written and works
- Tests pass (for game logic)
- Prettier and ESLint pass
- Manually tested in browser
