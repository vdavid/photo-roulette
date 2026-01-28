# Bunny photoroulette game thing — task list

This is the implementation roadmap. For full details, see:
- [tech.md](./tech.md) — architecture, stack, constraints
- [game.md](./game.md) — game flow, scoring, UI design

---

## Phase 1: Project setup

### 1.1 Initialize SvelteKit project
- [ ] Create SvelteKit project with TypeScript
- [ ] Configure `pnpm` as package manager
- [ ] Enable TypeScript strict mode

### 1.2 Code quality tooling
- [ ] Add Prettier (latest from npm)
- [ ] Add ESLint (latest from npm) with Svelte + TypeScript plugins
- [ ] Configure `.prettierrc` and `.eslintrc`
- [ ] Add format/lint scripts to `package.json`
- [ ] Set up VS Code settings for auto-format on save

### 1.3 Testing setup
- [ ] Configure Vitest (included with SvelteKit)
- [ ] Add test script to `package.json`
- [ ] Create sample test to verify setup works

---

## Phase 2: Core game logic (with tests)

All game logic should be pure TypeScript functions, tested independently of UI.

### 2.1 Types and constants
- [ ] Define TypeScript types: `Player`, `Photo`, `Round`, `GameState`, `Guess`, etc.
- [ ] Create constants file: timers, scoring values, limits, emoji list

### 2.2 Scoring logic
- [ ] Implement `calculateRoundScore()` — correct guess, fastest bonus, featured bonus
- [ ] Implement `calculateFinalScores()` — aggregate all rounds
- [ ] **Tests**: all scoring scenarios, edge cases (no guess, self-guess, ties)

### 2.3 Round management
- [ ] Implement `selectRandomPhoto()` — pick from pool, track used photos
- [ ] Implement `advanceRound()` — progress game state
- [ ] Implement `determineWinner()` — find fastest correct guess
- [ ] **Tests**: photo selection, round progression, repeat handling

### 2.4 Game flow state machine
- [ ] Define game phases: `landing` → `lobby` → `playing` → `results` → `final`
- [ ] Implement state transitions
- [ ] **Tests**: all valid transitions, invalid transition handling

### 2.5 Superlatives calculation
- [ ] Implement end-game stats: fastest fingers, most featured, accuracy, etc.
- [ ] **Tests**: superlative calculations with various game scenarios

---

## Phase 3: Networking (PeerJS)

### 3.1 Connection management
- [ ] Host: create peer, generate room code
- [ ] Player: connect to host via room code
- [ ] Handle connection/disconnection events
- [ ] Implement reconnection logic

### 3.2 Message protocol
- [ ] Define message types: `player-joined`, `photos-ready`, `start-game`, `round-start`, `guess`, `round-result`, etc.
- [ ] Implement message serialization/deserialization
- [ ] Host: broadcast to all players
- [ ] Player: send to host only

### 3.3 State synchronization
- [ ] Host: maintain authoritative game state
- [ ] Broadcast state updates to all players
- [ ] Handle late joins / reconnects

---

## Phase 4: Google Photos integration

### 4.1 OAuth setup
- [ ] Create Google Cloud project
- [ ] Configure OAuth consent screen (unverified, test users)
- [ ] Get client ID for Picker API

### 4.2 Picker API integration
- [ ] Implement session creation
- [ ] Open picker in new tab with `/autoclose`
- [ ] Poll for completion
- [ ] Retrieve `baseUrl`s for selected photos
- [ ] Handle session expiry (60 min)

---

## Phase 5: UI components

All components follow the autumn color palette and design principles in [game.md](./game.md#ui-design).

### 5.1 Landing page
- [ ] "Host a game" button
- [ ] "Join a game" with room code input
- [ ] Friendly welcome text

### 5.2 Lobby
- [ ] Room code display + copy button
- [ ] Game settings chips (host can edit)
- [ ] Player list with name, emoji, photo count, ready state
- [ ] "Connect your photos" button
- [ ] Player name input + animal emoji picker
- [ ] "Start game" button (host only, enabled when ready)

### 5.3 Round view
- [ ] Photo display with letterbox fit
- [ ] Progressive blur reveal (3 sec)
- [ ] Ken Burns slow zoom effect
- [ ] Circular progress ring timer
- [ ] Player guess buttons with checkmark selection
- [ ] Live guess counter ("5/8 have guessed")

### 5.4 Round result view
- [ ] "It was X's photo!" header
- [ ] Who guessed what list (correct/wrong/no guess)
- [ ] Points earned this round
- [ ] Current leaderboard
- [ ] Auto-advance timer

### 5.5 Final scoreboard
- [ ] Confetti animation
- [ ] Podium with top 3 + crown for winner
- [ ] Full leaderboard
- [ ] Superlatives section
- [ ] Expandable detailed stats
- [ ] "Rematch" and "New game" buttons

### 5.6 Shared components
- [ ] Loading spinner (CSS-only)
- [ ] Photo loading with progress (if feasible)
- [ ] Connection status indicator (low priority)
- [ ] Sound effects (soft tick, chime, whoosh, victory)

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

### 7.2 docs/development.md
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
