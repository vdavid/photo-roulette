# Photo download and transfer — implementation plan

## The problem

Google Photos Picker API base URLs are **tied to the OAuth token** of the user who picked them. When Player A picks photos, those URLs only work with Player A's token. Other players get 403 errors trying to view them.

This means we can't just share URLs — we need to share the actual image data.

## The solution

When a player picks photos:

1. Immediately fetch each photo using their OAuth token
2. Resize to fit within a 1600×1600 bounding box (maintaining aspect ratio)
3. Compress as JPEG (80% quality)
4. Store the image data (as base64 or blob)
5. Send the actual image bytes to the host via WebRTC
6. Host stores all image data and broadcasts to players during rounds

## Image specifications

| Property       | Value                          |
| -------------- | ------------------------------ |
| Max dimensions | 1600×1600 bounding box         |
| Format         | JPEG                           |
| Quality        | 80%                            |
| Expected size  | ~150-300 KB per image          |
| Aspect ratio   | Preserved (letterboxed to fit) |

## Performance estimates

### Upload time (after picking photos)

| Photos | Size (~200KB avg) | Slow 4G (5 Mbps) | Good 4G (15 Mbps) |
| ------ | ----------------- | ---------------- | ----------------- |
| 15     | 3 MB              | ~5 sec           | ~2 sec            |
| 30     | 6 MB              | ~10 sec          | ~3 sec            |

Show a "Preparing photos..." progress indicator during this time.

### Host memory (8 players)

| Photos per player | Total photos | Memory |
| ----------------- | ------------ | ------ |
| 15                | 120          | ~24 MB |
| 30                | 240          | ~48 MB |
| 50                | 400          | ~80 MB |

Completely fine for any modern device.

### Round broadcast (1 photo to 7 players)

- ~200 KB × 7 = 1.4 MB
- At 5 Mbps: < 3 seconds
- At 15 Mbps: < 1 second

## Data flow

```
Player picks photos in Google Photos
    ↓
Player's browser fetches each photo with OAuth token
    ↓
Resize to 1600×1600 bounding box, compress to JPEG 80%
    ↓
Convert to base64 string
    ↓
Send to host via WebRTC data channel
    ↓
Host stores in memory (Map<photoId, imageData>)
    ↓
During round: host broadcasts imageData to all players
    ↓
Players display using data URL or blob URL
```

## Implementation steps

### Step 1: Create image processing utility

**New file:** `src/lib/photos/image-processor.ts`

```typescript
interface ProcessedImage {
	id: string;
	data: string; // base64 encoded JPEG
	width: number;
	height: number;
	originalFilename?: string;
}

/**
 * Fetch a photo with auth token and process it
 */
async function fetchAndProcessImage(
	baseUrl: string,
	accessToken: string,
	maxSize: number = 1600
): Promise<Blob>;

/**
 * Resize image to fit within bounding box, maintaining aspect ratio
 */
function resizeImage(img: HTMLImageElement, maxSize: number, quality: number = 0.8): Promise<Blob>;

/**
 * Convert blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string>;

/**
 * Process all picked photos
 * Returns processed images with progress callback
 */
async function processPickedPhotos(
	photos: PickedPhoto[],
	accessToken: string,
	onProgress?: (current: number, total: number) => void
): Promise<ProcessedImage[]>;
```

Implementation notes:

- Use `fetch()` with `Authorization: Bearer` header
- Create an `Image` element to load the blob
- Use `canvas.toBlob()` for resizing and compression
- Process images sequentially to avoid memory spikes (or batch 3-4 at a time)

### Step 2: Update photo types

**Modify:** `src/lib/game/types.ts`

```typescript
// Existing Photo type - update to include image data
interface Photo {
	id: string;
	ownerId: PlayerId;
	baseUrl: string; // Keep for reference, but won't be used for display
	imageData?: string; // base64 JPEG - the actual displayable image
}
```

### Step 3: Update the photo picking flow

**Modify:** `src/lib/photos/picker.ts`

After fetching media items from the Picker API, process each image:

```typescript
// In pickPhotos function, after fetching media items:
const processedPhotos = await processPickedPhotos(photos, token.accessToken, (current, total) => {
	callbacks?.onProgress?.(`Processing photo ${current}/${total}...`);
});
```

### Step 4: Update networking messages

**Modify:** `src/lib/networking/types.ts`

Update the `photos-ready` message to include image data:

```typescript
interface PhotosReadyMessage {
	type: 'photos-ready';
	photos: Array<{
		id: string;
		imageData: string; // base64 JPEG
	}>;
}
```

Update the `round-start` message to include image data instead of URL:

```typescript
interface RoundStartMessage {
	type: 'round-start';
	roundNumber: number;
	photoId: string;
	imageData: string; // base64 JPEG (instead of photoUrl)
	startTime: number;
}
```

### Step 5: Update host networking

**Modify:** `src/lib/networking/host.ts`

- Store received image data in a Map
- When broadcasting round start, send imageData instead of URL

### Step 6: Update player networking

**Modify:** `src/lib/networking/player.ts`

- Receive imageData in round-start message
- Pass to game state

### Step 7: Update game store

**Modify:** `src/lib/stores/game.svelte.ts`

- Store image data with photos
- When starting a round, use imageData instead of baseUrl
- Change `currentPhotoUrl` to `currentPhotoData` (or keep name but store data URL)

### Step 8: Update Game view

**Modify:** `src/lib/views/Game.svelte`

- Remove `AuthImage` component usage (no longer needed)
- Use regular `<img>` with `src="data:image/jpeg;base64,{imageData}"`
- Or convert base64 to blob URL for better performance

### Step 9: Clean up

**Remove or simplify:**

- `src/lib/photos/authenticated-fetch.ts` - no longer needed for gameplay
- `src/lib/components/AuthImage.svelte` - no longer needed for gameplay

These might still be useful for other features (e.g., photo preview in lobby), so consider keeping them.

### Step 10: Add progress UI in lobby

**Modify:** `src/lib/views/Lobby.svelte`

Show progress when photos are being processed:

- "Connecting to Google Photos..."
- "Processing photo 5/20..."
- "Done! 20 photos ready"

## Testing checklist

- [ ] Single player can pick and process photos
- [ ] Progress indicator shows during processing
- [ ] Photos are sent to host successfully
- [ ] Host receives and stores photo data
- [ ] Round displays photo correctly for host
- [ ] Round displays photo correctly for other players
- [ ] Memory usage is reasonable (check with DevTools)
- [ ] Works on slow connection (throttle in DevTools)
- [ ] Works on mobile browsers

## Error handling

- If a photo fails to fetch, skip it and continue with others
- If processing fails, show error but don't block the flow
- Minimum photo requirement (5) should account for potential failures
- If WebRTC transfer fails, implement retry logic

## Future optimizations (not for initial implementation)

- Use WebRTC binary data channels instead of base64 (33% smaller)
- Implement chunked transfer for large batches
- Add thumbnail generation for lobby preview
- Cache processed images in IndexedDB for reconnection scenarios
