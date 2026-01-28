# Tasks: Multi-game platform with Hot Takes

## Overview

Transform the Photo Roulette app into a multi-game platform that can host multiple party games. The first addition will be **Hot Takes** - an anonymous opinion voting and guessing game.

**Hot Takes game concept:**

1. Each player submits 1-3 anonymous "hot takes" (controversial opinions)
2. All takes are shuffled and shown one by one
3. Everyone votes: 👍 Agree or 👎 Disagree
4. After voting, everyone guesses who wrote each take
5. Points awarded for correct guesses and having controversial (50/50) takes

---

## Phase 1: Refactor to multi-game architecture

### 1.1 Create common module structure

- [x] Create `src/lib/common/` folder
- [x] Create `src/lib/common/networking/` folder
- [x] Create `src/lib/common/components/` folder
- [x] Create `src/lib/common/stores/` folder
- [x] Create `src/lib/common/types.ts` for shared types

### 1.2 Extract networking to common

- [x] Move `src/lib/networking/peer-manager.ts` → `src/lib/common/networking/peer-manager.ts`
- [x] Move `src/lib/networking/room-code.ts` → `src/lib/common/networking/room-code.ts`
- [x] Move `src/lib/networking/constants.ts` → `src/lib/common/networking/constants.ts`
- [x] Create `src/lib/common/networking/types.ts` with base message types (ping, pong, join-request, join-accepted, join-rejected, player-left, player-reconnected, player-kicked, player-update)
- [x] Create `src/lib/common/networking/base-host.ts` - abstract host class with room creation, player management, broadcasting
- [x] Create `src/lib/common/networking/base-player.ts` - abstract player class with joining, reconnection
- [x] Create `src/lib/common/networking/index.ts` - re-export all

### 1.3 Extract shared components to common

- [x] Move `src/lib/components/Button.svelte` → `src/lib/common/components/Button.svelte`
- [x] Move `src/lib/components/Card.svelte` → `src/lib/common/components/Card.svelte`
- [x] Move `src/lib/components/Input.svelte` → `src/lib/common/components/Input.svelte`
- [x] Move `src/lib/components/EmojiPicker.svelte` → `src/lib/common/components/EmojiPicker.svelte`
- [x] Move `src/lib/components/PlayerCard.svelte` → `src/lib/common/components/PlayerCard.svelte`
- [x] Move `src/lib/components/Spinner.svelte` → `src/lib/common/components/Spinner.svelte`
- [x] Create `src/lib/common/components/index.ts` - re-export all

### 1.4 Create shared store utilities

- [x] Create `src/lib/common/stores/connection.svelte.ts` - connection state (roomCode, connectionStatus, connectionError, myPlayerId, myName, myEmoji)
- [x] Create `src/lib/common/stores/persistence.ts` - session persistence utilities (save, load, clear)
- [x] Create `src/lib/common/stores/types.ts` - shared store types

### 1.5 Create game registry and types

- [x] Create `src/lib/common/game-registry.ts` - game definitions with id, name, description, minPlayers, maxPlayers, component
- [x] Create `src/lib/common/types.ts` - GameId enum, GameDefinition interface, BasePlayer interface

### 1.6 Move Photo Roulette to games folder

- [x] Create `src/lib/games/` folder
- [x] Create `src/lib/games/photo-roulette/` folder
- [x] Move `src/lib/game/` → `src/lib/games/photo-roulette/logic/`
- [x] Move `src/lib/photos/` → `src/lib/games/photo-roulette/photos/`
- [x] Move `src/lib/stores/game.svelte.ts` → `src/lib/games/photo-roulette/store.svelte.ts`
- [x] Move `src/lib/views/` → `src/lib/games/photo-roulette/views/`
- [x] Move remaining `src/lib/components/AuthImage.svelte` → `src/lib/games/photo-roulette/components/AuthImage.svelte`
- [x] Create `src/lib/games/photo-roulette/networking/host.ts` - Photo Roulette specific host (extends base)
- [x] Create `src/lib/games/photo-roulette/networking/player.ts` - Photo Roulette specific player (extends base)
- [x] Create `src/lib/games/photo-roulette/networking/types.ts` - Photo Roulette specific message types
- [x] Create `src/lib/games/photo-roulette/index.ts` - export game definition
- [x] Update all imports in Photo Roulette files to use new paths

### 1.7 Create game selector UI

- [x] Create `src/lib/views/GameSelector.svelte` - main menu with game cards
- [x] Create `src/lib/views/GameLauncher.svelte` - orchestrates selected game
- [x] Update `src/routes/+page.svelte` to show GameSelector first, then delegate to selected game
- [x] Add game selection state to URL (e.g., `?game=photo-roulette` or `?game=hot-takes`)

### 1.8 Update tests for new structure

- [x] Update all unit test imports to use new paths
- [x] Verify all existing unit tests pass with `pnpm test`
- [x] Update E2E tests to navigate through game selector
- [x] Verify all E2E tests pass with `pnpm test:e2e`

### 1.9 Validation checkpoint

- [x] Run `pnpm validate` - all checks must pass
- [x] Photo Roulette works end-to-end (manual smoke test or E2E)

---

## Phase 2: Implement Hot Takes game

### 2.1 Create Hot Takes folder structure

- [x] Create `src/lib/games/hot-takes/` folder
- [x] Create `src/lib/games/hot-takes/logic/` folder
- [x] Create `src/lib/games/hot-takes/views/` folder
- [x] Create `src/lib/games/hot-takes/networking/` folder
- [x] Create `src/lib/games/hot-takes/components/` folder

### 2.2 Define Hot Takes types

- [x] Create `src/lib/games/hot-takes/logic/types.ts`:
  - `HotTake` - id, text, authorId (hidden until reveal)
  - `Vote` - playerId, takeId, vote ('agree' | 'disagree')
  - `Guess` - playerId, takeId, guessedAuthorId
  - `TakeResult` - takeId, authorId, votes, guesses, agreePercent
  - `HotTakesPhase` - 'lobby' | 'submitting' | 'voting' | 'guessing' | 'reveal' | 'final'
  - `HotTakesSettings` - takesPerPlayer (1-3), votingTimeSeconds, guessingTimeSeconds
  - `PlayerScore` - totalPoints, correctGuesses, controversialTakes

### 2.3 Implement Hot Takes game logic

- [x] Create `src/lib/games/hot-takes/logic/constants.ts`:
  - Points: correctGuess (100), controversialTake (50, for 40-60% split), unanimousTake (10)
  - Timing: votingTime [10, 15, 20, 30], guessingTime [15, 20, 30, 45]
  - Limits: takesPerPlayer [1, 2, 3], minPlayers (3), maxPlayers (8)
- [x] Create `src/lib/games/hot-takes/logic/scoring.ts`:
  - `calculateTakeScore(votes)` - controversy bonus
  - `calculateGuessScore(guesses, authorId)` - correct guess points
  - `calculateFinalScores(results)` - aggregate all scores
  - `getRankedPlayers(scores)` - sorted rankings
- [x] Create `src/lib/games/hot-takes/logic/state.ts`:
  - `createInitialState()` - empty game state
  - `isValidTransition(from, to)` - phase transitions
  - `allPlayersSubmitted(state)` - check submission complete
  - `allPlayersVoted(state, takeId)` - check voting complete
  - `allPlayersGuessed(state, takeId)` - check guessing complete
- [x] Create `src/lib/games/hot-takes/logic/round.ts`:
  - `shuffleTakes(takes)` - randomize order, hide authors
  - `getCurrentTake(state)` - get current take being processed
  - `advanceToNextTake(state)` - move to next take or phase
  - `revealAuthor(take)` - unmask author for display

### 2.4 Create Hot Takes networking

- [x] Create `src/lib/games/hot-takes/networking/types.ts`:
  - Message types: take-submitted, all-takes-ready, voting-start, vote-submitted, voting-end, guessing-start, guess-submitted, guessing-end, take-reveal, game-end
- [x] Create `src/lib/games/hot-takes/networking/host.ts`:
  - Extends base host
  - `collectTake(playerId, take)` - receive player's hot take
  - `broadcastVotingStart(take)` - start voting on a take
  - `collectVote(playerId, vote)` - receive player's vote
  - `broadcastGuessingStart(take, votes)` - start guessing phase
  - `collectGuess(playerId, guess)` - receive player's guess
  - `broadcastTakeReveal(result)` - reveal author and scores
  - `broadcastGameEnd(finalResults)` - end game with rankings
- [x] Create `src/lib/games/hot-takes/networking/player.ts`:
  - Extends base player
  - `submitTake(take)` - send hot take to host
  - `submitVote(vote)` - send vote to host
  - `submitGuess(guess)` - send guess to host
  - Event handlers for all broadcast messages

### 2.5 Create Hot Takes store

- [x] Create `src/lib/games/hot-takes/store.svelte.ts`:
  - State: phase, players, settings, myTakes, allTakes (anonymous), currentTakeIndex, votes, guesses, results, finalScores
  - Methods: hostGame, joinGame, submitTake, submitVote, submitGuess, startGame, nextTake, endGame
  - Timer management for voting/guessing phases
  - Integration with host/player networking

### 2.6 Create Hot Takes views

- [x] Create `src/lib/games/hot-takes/views/Lobby.svelte`:
  - Room code display, player list, settings (takes per player, timing)
  - Start button when 3+ players joined
- [x] Create `src/lib/games/hot-takes/views/Submitting.svelte`:
  - Text input for hot take(s)
  - Character limit (280 chars like a tweet)
  - Submit button, waiting indicator for others
- [x] Create `src/lib/games/hot-takes/views/Voting.svelte`:
  - Display current take (anonymous)
  - Big 👍 and 👎 buttons
  - Timer countdown
  - Progress indicator (take 3/12)
- [x] Create `src/lib/games/hot-takes/views/Guessing.svelte`:
  - Display take with vote results (X% agree)
  - Player buttons to guess author
  - Timer countdown
  - "I don't know" option
- [x] Create `src/lib/games/hot-takes/views/Reveal.svelte`:
  - Reveal author with animation
  - Show who guessed correctly
  - Points awarded display
  - Auto-advance to next take
- [x] Create `src/lib/games/hot-takes/views/Final.svelte`:
  - Final rankings with scores
  - Best takes showcase (most controversial, most agreed, most disagreed)
  - Play again / back to menu buttons
- [x] Create `src/lib/games/hot-takes/views/Game.svelte`:
  - Phase router - renders appropriate view based on phase

### 2.7 Create Hot Takes components

- [x] Create `src/lib/games/hot-takes/components/TakeCard.svelte`:
  - Displays a hot take with styling
  - Anonymous or revealed state
- [x] Create `src/lib/games/hot-takes/components/VoteButtons.svelte`:
  - Agree/disagree buttons with animations
- [x] Create `src/lib/games/hot-takes/components/VoteResults.svelte`:
  - Percentage bar showing agree/disagree split
- [x] Create `src/lib/games/hot-takes/components/PlayerGuessButton.svelte`:
  - Player selection for guessing

### 2.8 Register Hot Takes game

- [x] Create `src/lib/games/hot-takes/index.ts` - export game definition
- [x] Update `src/lib/common/game-registry.ts` to include Hot Takes
- [x] Update GameSelector to show Hot Takes option

### 2.9 Validation checkpoint

- [x] Run `pnpm validate` - all checks must pass
- [x] Hot Takes basic flow works (manual test with 3+ browser tabs)

---

## Phase 3: Unit tests for Hot Takes

### 3.1 Test Hot Takes game logic

- [x] Create `src/lib/games/hot-takes/logic/scoring.test.ts`:
  - Test correct guess scoring
  - Test controversy bonus (40-60% split gets bonus)
  - Test unanimous take scoring (penalty/reduced points)
  - Test final score aggregation
  - Test ranking calculation
- [x] Create `src/lib/games/hot-takes/logic/state.test.ts`:
  - Test initial state creation
  - Test all phase transitions (valid and invalid)
  - Test player submission tracking
  - Test voting completion detection
  - Test guessing completion detection
- [x] Create `src/lib/games/hot-takes/logic/round.test.ts`:
  - Test take shuffling (deterministic with seed)
  - Test author hiding
  - Test take advancement
  - Test author reveal

### 3.2 Test Hot Takes networking types

- [x] Create `src/lib/games/hot-takes/networking/types.test.ts`:
  - Test message type guards
  - Test message serialization/deserialization

### 3.3 Test common networking

- [x] Create `src/lib/common/networking/room-code.test.ts` (move existing)
- [x] Create `src/lib/common/networking/types.test.ts` (move existing)
- [x] Verify tests use new import paths

### 3.4 Validation checkpoint

- [x] Run `pnpm test` - all unit tests pass (426 tests)
- [x] Verify test coverage for new code

---

## Phase 4: E2E tests

### 4.1 Update existing E2E tests

- [x] Update `e2e/landing.spec.ts` for game selector flow
- [x] Update `e2e/host-flow.spec.ts` to select Photo Roulette first
- [x] Update `e2e/full-game.spec.ts` to navigate through game selector
- [x] Update `e2e/spectator-mode.spec.ts` if applicable

### 4.2 Create Hot Takes E2E tests

- [x] Create `e2e/hot-takes/` folder
- [x] Create `e2e/hot-takes/lobby.spec.ts`:
  - Test hosting a Hot Takes game
  - Test joining a Hot Takes game
  - Test player list updates
  - Test settings changes
- [x] Create `e2e/hot-takes/full-game.spec.ts`:
  - Test complete game flow with 3 players
  - Each player submits 1 take (3 takes total)
  - All players vote on all takes
  - All players guess on all takes
  - Verify reveal shows correct author
  - Verify final scores calculated correctly
  - Use test mode (AAA, BBB, CCC players)
- [ ] Create `e2e/hot-takes/edge-cases.spec.ts`:
  - Test player disconnect during submission
  - Test player disconnect during voting
  - Test unanimous vote (everyone agrees) ✓ (covered in full-game.spec.ts)
  - Test split vote (50/50)
  - Test no one guesses correctly
  - Test everyone guesses correctly
  - Test timer expiry (no vote submitted)

### 4.3 Create game selector E2E tests

- [x] Create `e2e/game-selector.spec.ts`:
  - Test game selector displays both games
  - Test selecting Photo Roulette navigates correctly
  - Test selecting Hot Takes navigates correctly
  - Test back to menu from each game's lobby
  - Test URL state (?game=) works

### 4.4 Validation checkpoint

- [x] Run `pnpm test:e2e` - all E2E tests pass (29 tests)
- [ ] Review test coverage for happy and unhappy paths (edge cases need work)

---

## Phase 5: Polish and final validation

### 5.1 Code quality

- [x] Run `pnpm validate` - must pass completely
- [ ] Review all TODO comments and address them
- [ ] Ensure no console.log statements in production code
- [x] Verify all TypeScript strict mode errors resolved

### 5.2 UI polish

- [x] Consistent styling between games (colors, fonts, spacing)
- [x] Loading states for all async operations
- [x] Error states with retry options
- [x] Mobile-responsive layouts for Hot Takes views

### 5.3 Documentation

- [ ] Update CONTRIBUTING.md with new folder structure
- [ ] Update docs/spec/tech.md with multi-game architecture
- [ ] Create docs/spec/hot-takes.md with game rules and scoring

### 5.4 Final validation

- [x] Run `pnpm validate` one final time
- [x] All unit tests pass (426 tests)
- [x] All E2E tests pass (29 tests)
- [ ] Manual smoke test: Photo Roulette full game
- [ ] Manual smoke test: Hot Takes full game
- [x] Both games accessible from game selector

---

## Task summary

| Phase | Tasks   | Description                         | Status |
| ----- | ------- | ----------------------------------- | ------ |
| 1     | 1.1-1.9 | Refactor to multi-game architecture | ✅ Done |
| 2     | 2.1-2.9 | Implement Hot Takes game            | ✅ Done |
| 3     | 3.1-3.4 | Unit tests for Hot Takes            | ✅ Done |
| 4     | 4.1-4.4 | E2E tests                           | ⚠️ Mostly done (edge cases pending) |
| 5     | 5.1-5.4 | Polish and final validation         | ⚠️ Mostly done (docs pending) |

**Total estimated tasks:** ~85 subtasks across 5 phases

---

## Notes

- Use `pnpm` for all package management
- Sentence case for all UI text
- Test mode players: AAA, BBB, CCC, DDD (pattern: `/^([A-Z])\1{2}$/`)
- Seeded random for deterministic tests: `setRandomSeed(12345)`
- Fast result display in tests: `window.__TEST_RESULT_DISPLAY_MS__ = 500`
