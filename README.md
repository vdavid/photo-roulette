# Photo Roulette

A browser-based photo guessing game for friends.
Connect your Google Photos, and guess whose photo is on screen. Fast, chaotic, hilarious.

As a tribute to https://photoroulette.app/ which I couldn't use with friends in a remote setting. 

## How to play

1. **Host a game**: One person creates a room and shares the 4-character code
2. **Join the room**: Everyone else enters the code to join
3. **Connect photos**: Each player connects their Google Photos and picks 15-30 photos
4. **Play**: A random photo appears. Everyone guesses whose photo it is. Fastest correct guess wins bonus points!

**Scoring:**

- Correct guess: +100 points
- Fastest correct guess: +50 bonus
- Your photo was shown: +50 points

## Tech stack

- **Frontend**: Svelte 5 + TypeScript
- **Networking**: PeerJS (WebRTC peer-to-peer)
- **Photos**: Google Photos Picker API
- **Backend**: None — it's all client-side!

The game uses a star topology: the host maintains all connections and game state, players connect only to the host.

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Run tests
pnpm test

# Lint and format
pnpm lint
pnpm format
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed architecture and code style guidelines.

## Test mode

For testing without Google Photos, use a player name with 3 identical uppercase letters (AAA, BBB, CCC, etc.). The game will generate test images automatically — no OAuth required.

## Deployment

See [docs/releasing.md](docs/releasing.md) for build and deployment instructions.

## License

MIT
