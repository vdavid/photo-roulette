# Bunny photoroulette game thing — game spec

## Core concept

A random photo appears. Everyone guesses whose photo it is. Fast, chaotic, hilarious.

Named after Bunny, the friend group playing it.

## Game flow

### 1. Landing

Two options:
- **Host a game** — create a new room, become the host
- **Join a game** — enter a room code, join as player

### 2. Lobby

Host and players gather here before the game starts.

**What players see:**
- Room code (e.g., `X7K2`) + copy button — one tap to copy, paste in chat
- Game settings shown as compact chips: "12 rounds • 10 sec"
- List of all players with status:
  - Name + emoji (e.g., "David 🦊", "Anna 🐻")
  - Photo count (after connecting)
  - Ready state
- "Connect your photos" button → opens Google Photos Picker
- Host sees "Start game" button (enabled when everyone's ready)

**Player names:**
- Free text input + emoji picker
- Curated animal emoji set (~20): 🐰🐇🦊🐻🦉🦌🐿️🦝🐺🦎🐢🦋🐝🦔🐧🦜🐙🦀🐬🦭
- Pick an emoji to make yourself recognizable in the UI

**Ready conditions:**
- Player has entered their name
- Player has connected photos (minimum 15)

### 3. Round (the core loop)

```
┌─────────────────────────────────────────┐
│  Round 7 of 12              ⏱ 8 sec    │
├─────────────────────────────────────────┤
│                                         │
│          [ PHOTO ]                      │
│                                         │
├─────────────────────────────────────────┤
│  Whose photo is this?                   │
│                                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │ David│ │ Anna │ │ Pete │ │ Zoe  │   │
│  └──────┘ └──────┘ └──────┘ └──────┘   │
└─────────────────────────────────────────┘
```

**Mechanics:**
- Photo shown to all players simultaneously
- **Progressive reveal**: photo starts blurry, sharpens over 3 seconds, then stays clear
- **Circular progress ring** around photo depletes as timer runs (10 sec default)
- Players CAN guess during the blur phase — risky but rewarding for fast recognition
- Players tap a name to guess → **button shows checkmark/border** to confirm selection
- Can change guess until timer ends (checkmark moves to new selection)
- **Live guess counter**: "5/8 have guessed" — creates social pressure
- Photo owner CAN guess and CAN pick themselves (free +100, but everyone knows it's theirs anyway)
- No guess before timer = 0 points (no penalty, just missed opportunity)
- **No right/wrong feedback until reveal** — you don't know if you're correct until the round ends
- No hint about who owns the photo — all buttons look identical, pure guessing

### 4. Round result

Shown for 4-5 seconds after each round. Shows who guessed what — more social, more fun.

```
┌─────────────────────────────────────────┐
│  It was Anna's photo!                   │
├─────────────────────────────────────────┤
│  David → Anna ✓ ................ +150   │  (correct + fastest)
│  Zoe → Anna ✓ .................. +100   │
│  Pete → Anna ✓ ................. +100   │
│  Mike → David ✗                         │
│  Sara → (no guess)                      │
│  ★ Anna ......................... +50   │  (featured)
├─────────────────────────────────────────┤
│  Leaderboard:                           │
│  1. Zoe .......... 650                  │
│  2. David ........ 600                  │
│  3. Anna ......... 550                  │
└─────────────────────────────────────────┘
```

Leaderboard shown after every round. **Auto-advance to next round after 4-5 seconds** — no ready-up button, keeps the flow fast.

### 5. Final scoreboard

After all rounds complete. **Big celebration moment**: confetti explosion + victory sound.

```
┌─────────────────────────────────────────┐
│  🎉 Game over!              [confetti]  │
├─────────────────────────────────────────┤
│         🥇          🥈          🥉       │
│        [Zoe]      [David]     [Anna]    │  ← visual podium
│       1,250        1,100        950     │
├─────────────────────────────────────────┤
│  4. Pete ..................... 800 pts  │
│  5. Mike ..................... 650 pts  │
│  ...                                    │
├─────────────────────────────────────────┤
│  🏆 Superlatives                        │
│  Fastest fingers: Zoe                   │
│  Most featured: Pete                    │
│  Lucky guesser: Mike (40% but clutch)   │
│  Sharpshooter: Anna (92% accuracy)      │
├─────────────────────────────────────────┤
│  📊 Detailed stats (expandable)         │
│  Per-player: accuracy %, avg time, etc. │
├─────────────────────────────────────────┤
│  [ Rematch ]    [ New game ]            │
└─────────────────────────────────────────┘
```

Winner gets 👑 crown icon next to their name.

**Rematch**: same photos reshuffled, instant restart
**New game**: back to lobby, players can select new photos

## Scoring

| Action | Points |
|--------|--------|
| Correct guess | +100 |
| Fastest correct guess | +50 bonus |
| Your photo was shown | +50 |
| Wrong guess | 0 |

## Game settings (host configures in lobby)

| Setting | Default | Options |
|---------|---------|---------|
| Rounds | 12 | 8, 12, 16, 20 |
| Timer per round | 10 sec | 5, 10, 15, 20 sec |
| Min photos per player | 15 | — |

## Audio

**Subtle feedback sounds** (mutable):
- Soft tick when selecting a player
- Gentle chime on round end
- Soft whoosh on photo reveal
- Victory flourish for winner at game end

No loud buzzers or jarring sounds — you're already on Zoom.

## Photo display

- **Letterbox fit**: always show the entire photo, cream-colored bars if aspect ratio doesn't match
- **Progressive blur**: starts heavily blurred (CSS filter), animates to clear over 3 seconds
- **Ken Burns effect**: slow subtle zoom (~5%) over the round duration, adds life to static images
- No cropping, no face detection — keep it simple

**Loading state**:
- CSS-only spinner while photo loads
- Show actual progress if technically feasible (bytes loaded / total)
- Fallback: just the spinner if progress isn't available

## Host controls

**During lobby**: configure game settings (rounds, timer)

**During game**: none — once started, the game runs to completion. No pause, no skip, no kick. Keeps it fair and simple.

## UI design

### Colors (autumn palette)

| Role | Hex | Name |
|------|-----|------|
| Primary | `#C85A35` | burnt sienna |
| Secondary | `#E8A54B` | goldenrod |
| Background | `#FDF6EE` | cream |
| Surface | `#FFFFFF` | white |
| Text | `#2D2926` | espresso |
| Text muted | `#7A6F69` | driftwood |
| Success | `#5B8C5A` | forest |
| Error | `#B54A4A` | cranberry |

### Design principles

- Cream background, white cards with soft shadows
- Rounded corners (12-16px)
- Big, obvious buttons
- One primary action per screen
- Generous whitespace
- Mobile-first responsive layout
- System font stack (fast, native)
- No hover-only interactions (mobile support)

## Edge cases (decisions made)

- **Player disconnects mid-game**: mark as disconnected, allow rejoin immediately (they jump into current round with 0 points)
- **Photo fails to load**: skip to next photo, don't penalize anyone
- **Everyone guesses wrong**: no points awarded (except +50 for photo owner), show answer, move on
- **Tie for fastest**: first guess received by host wins the +50 bonus
- **Photo owner guesses themselves**: allowed — they get +100 like anyone else (plus +50 for being featured)
- **No guess submitted**: 0 points, no penalty, shown as "(no guess)" in results
- **Photo pool exhausted**: allow repeats if needed (shuffle used photos back in)
- **Same photo from multiple players**: possible if same Google account on multiple devices — treat as belonging to whichever player submitted it
- **Spectators**: not supported — everyone in the room plays
- **Streaks**: no streak bonuses — each round is independent
- **Late joiners**: can join lobby anytime, but once game starts, no new players (reconnects OK)
- **Connection quality indicator**: (low priority) if easy to implement, show warning icon on player card when connection is unstable — only visible to that player
