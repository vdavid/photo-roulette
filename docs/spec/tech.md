# Bunny photoroulette game thing — technical spec

## What is this?

A browser-based Photo Roulette clone for 8 friends. One host, seven players. Everyone connects their Google Photos, and the game shows random photos — guess whose photo it is to score points.

## Architecture

```
Host (you) ←── WebRTC DataChannel ──→ 7 friends
                     │
              PeerJS Cloud (signaling)
                     │
              Google Photos CDN (images)
```

**Star topology**: host maintains all connections and game state. No mesh, no complexity.

## Tech stack

| Layer     | Choice                                |
| --------- | ------------------------------------- |
| Frontend  | Svelte 5 + TypeScript                 |
| Language  | TypeScript (strict mode)              |
| P2P       | PeerJS                                |
| Signaling | PeerJS Cloud (free)                   |
| Photos    | Google Photos Picker API              |
| Backend   | None (Go server optional as fallback) |
| Hosting   | Static files anywhere                 |

**TypeScript everywhere**: all `.svelte` files use `<script lang="ts">`, all game logic in `.ts` files. Strict mode enabled, no `any` types unless absolutely necessary.

## Google Photos integration

**API**: Picker API (not Library API — that's restricted since April 2025)

**Flow**:

1. Player clicks "connect photos"
2. Opens Google Photos in new tab via `pickerUri`
3. Player selects 20-30 photos manually
4. App receives list of `baseUrl`s from Picker API
5. **Photos are fetched immediately** using player's OAuth token
6. Each photo is resized (max 1600x1600) and compressed (JPEG 80%)
7. Image data (base64) is sent to host via WebRTC
8. Host stores image data in memory and broadcasts during rounds

**Why transfer image data, not URLs?**

Google Photos URLs are tied to the OAuth token of the user who picked them. Other players can't access those URLs directly — they'd get 403 errors. By downloading and transferring the actual image bytes, all players can view any photo.

**Constraints**:

- No iframe (security restriction)
- Use `/autoclose` suffix for better UX
- OAuth not verified — friends see warning, click through

## P2P with PeerJS

**Connection model**:

- Host creates room → gets peer ID (used as room code)
- Friends join by entering room code
- Each friend connects only to host (7 connections total)
- All game state lives on host, broadcast to players

**Data transferred**:

- Photo image data (base64 JPEG, ~150-300 KB each)
- Player names, scores, guesses
- Game state updates (current phase, timer, results)

**Reliability**:

- Handle disconnects gracefully
- Host can kick/reconnect players
- If host dies, game dies (acceptable for friend group)

## Player limits

- 1 host + 7 players = 8 total
- Data-only (no video/audio via WebRTC — use Zoom separately)
- Primary: Chrome on laptops, home networks
- Also: mobile browsers for testing and casual play

## Testing requirements

**Multiple connections from same Google account**: The same person may join from multiple devices (e.g., laptop + phone) to test the game solo. Each connection is treated as a separate player — they just happen to share the same photo pool. No special handling needed, but don't break if photo URLs are duplicated across players.

**Mobile UI required**: Even though friends will mostly use laptops, the UI must work on mobile because:

- Easier to test with multiple "players" using one laptop + phone
- Some friends might join from their phone anyway
- Google Photos Picker works fine on mobile

Mobile considerations:

- Touch-friendly tap targets (min 44px)
- Responsive layout (single column on narrow screens)
- No hover-dependent interactions
- Test on iOS Safari + Android Chrome

## What we're NOT building

- User accounts or persistence
- Photo upload/storage
- Video chat
- Native mobile app (but mobile web works)
- Public matchmaking
- OAuth verification (friends only)
