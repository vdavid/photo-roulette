# Hot Takes — game rules and scoring

## Overview

Hot Takes is an anonymous opinion voting and guessing game for 3-8 players. Players submit controversial opinions ("hot takes"), vote on them, and then try to guess who wrote each one.

## Game flow

### 1. Lobby phase

- Host creates room, players join with room code
- Host configures settings:
  - **Takes per player**: 1, 2, or 3 (default: 1)
  - **Voting time**: 10, 15, 20, or 30 seconds (default: 15)
  - **Guessing time**: 15, 20, 30, or 45 seconds (default: 20)
- Game starts when 3+ players are ready

### 2. Submitting phase

- Each player writes their hot take(s)
- Maximum 280 characters per take (like a tweet)
- Players can't see each other's submissions
- Phase ends when all players have submitted

### 3. Voting rounds

For each take (shuffled randomly):

**a) Voting (timed)**

- Take is displayed anonymously
- Everyone votes: 👍 Agree or 👎 Disagree
- Timer counts down (configurable duration)
- Phase ends when time runs out or all votes are in

**b) Guessing (timed)**

- Vote results shown (X% agree / Y% disagree)
- Players guess who wrote the take
- Can't guess yourself (you're excluded from options)
- Timer counts down (configurable duration)
- Phase ends when time runs out or all guesses are in

**c) Reveal**

- Author is revealed with animation
- Points awarded (see Scoring below)
- Brief pause before next take

### 4. Final phase

- Rankings displayed with total scores
- Special highlights:
  - Most controversial take (closest to 50/50 split)
  - Most agreed take (highest agree %)
  - Most disagreed take (lowest agree %)
- Play again or return to menu

## Scoring

### Guessing points

| Result        | Points |
| ------------- | ------ |
| Correct guess | 100    |

### Take author points

| Condition          | Points | Description                           |
| ------------------ | ------ | ------------------------------------- |
| Controversial take | 50     | Vote split is 40-60% (close to 50/50) |
| Unanimous take     | 10     | Everyone voted the same way           |

**Note**: Takes with vote splits outside 40-60% (but not unanimous) don't award author points.

### Example scoring

Take: "Pineapple belongs on pizza"

- Votes: 3 agree, 4 disagree (43% agree)
- This is in the 40-60% range → Author gets 50 controversy points

Guesses:

- Player A guessed correctly → +100 points
- Player B guessed wrong → +0 points
- Player C guessed correctly → +100 points

## Game constants

| Setting                  | Value          |
| ------------------------ | -------------- |
| Min players              | 3              |
| Max players              | 8              |
| Max take length          | 280 characters |
| Reveal display time      | 3000ms         |
| Default takes per player | 1              |
| Default voting time      | 15 seconds     |
| Default guessing time    | 20 seconds     |

## Networking messages

### Player → Host

| Message           | When sent                 |
| ----------------- | ------------------------- |
| `take-submitted`  | Player submits a hot take |
| `vote-submitted`  | Player votes on a take    |
| `guess-submitted` | Player guesses author     |

### Host → Players

| Message           | When sent                             |
| ----------------- | ------------------------------------- |
| `all-takes-ready` | All players have submitted            |
| `voting-start`    | New take shown for voting             |
| `voting-end`      | Voting phase complete                 |
| `guessing-start`  | Voting results shown, guessing begins |
| `take-reveal`     | Author revealed with results          |
| `game-end`        | Final rankings                        |

## Test mode

Like Photo Roulette, Hot Takes supports test players with names like `AAA`, `BBB`, `CCC`:

- Test players can join and play normally
- No special photo integration needed (Hot Takes doesn't use photos)
- Useful for E2E testing with multiple browser instances
