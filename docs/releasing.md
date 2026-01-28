# Releasing and deployment

This guide covers building and deploying Photo Roulette.

## Building for production

```bash
# Build the app
pnpm build

# Preview the production build locally
pnpm preview
```

The build output goes to the `build/` directory.

## Deploying to your server (Caddy)

The recommended approach is to clone the repo directly to your server.

### 1. Clone and build

```bash
# Clone to /opt (or wherever you prefer)
sudo mkdir -p /opt/photo-roulette
sudo chown $USER:$USER /opt/photo-roulette
git clone https://github.com/vdavid/photo-roulette.git /opt/photo-roulette

# Install dependencies and build
cd /opt/photo-roulette
pnpm install
pnpm build
```

### 2. Configure Caddy

Add to your Caddyfile:

```caddy
photos.yourdomain.com {
    root * /opt/photo-roulette/build
    file_server
    try_files {path} /index.html
}
```

Then reload Caddy:

```bash
sudo systemctl reload caddy
```

Caddy handles HTTPS automatically.

### 3. Updating

To deploy updates:

```bash
cd /opt/photo-roulette
git pull
pnpm install
pnpm build
```

No Caddy restart needed — it serves files directly from `build/`.

## Deploying to GitHub Pages

1. Update `svelte.config.js` to add your repo name as the base path:

   ```js
   kit: {
       adapter: adapter({
           pages: 'build',
           assets: 'build',
           fallback: 'index.html',
       }),
       paths: {
           base: '/photo-roulette', // your repo name
       },
   },
   ```

2. Build and push to `gh-pages` branch, or use a GitHub Action.

## Docker

Build and run the container:

```bash
docker build -t photo-roulette .
docker run -p 8080:80 photo-roulette
```

The app will be available at `http://localhost:8080`.

For production with HTTPS, run behind a reverse proxy (Caddy, Traefik, etc.) or use Docker Compose with your preferred setup.

## Vercel / Netlify / Cloudflare Pages

These platforms work automatically. Just connect your repo and deploy.

## HTTPS requirement

WebRTC (used for peer-to-peer connections) requires HTTPS in production. Caddy handles this automatically. Local development on `localhost` works without HTTPS.

## Environment variables

Photo Roulette has no required environment variables. All configuration is in the code.

To use a custom PeerJS server, edit `src/lib/networking/peer-manager.ts`.
