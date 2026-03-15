# Like2Gig

Find upcoming gigs near you for artists in your Spotify 'Liked Songs' playlist.

## Local Development

### Prerequisites

- Node.js 22+
- pnpm

### Setup

1. Create a Spotify app at <https://developer.spotify.com/dashboard>
   - Add `http://127.0.0.1:5173/auth/callback` as a redirect URI

2. Create a `.env` file in the project root:

   ```bash
   CLIENT_ID=your_spotify_client_id
   CLIENT_SECRET=your_spotify_client_secret
   ```

3. Install dependencies and start:

   ```bash
   pnpm install
   pnpm dev
   ```

The client runs at `http://127.0.0.1:5173` and the server at `http://127.0.0.1:3001`.

## Deployment

Deployed on a Hetzner VPS (CX22, Ubuntu) at <https://like2gig.evangriffiths.org>.

### Server setup

1. **Provision a VPS** on Hetzner with primary IPv4, add your SSH key during creation.

2. **SSH in and install dependencies:**

   ```bash
   ssh root@<your-ip>

   # Node.js 22
   curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
   apt install -y nodejs sqlite3

   # pnpm
   npm install -g pnpm

   # Caddy (reverse proxy + auto-SSL)
   apt install -y caddy
   ```

3. **Set up the app directory and bare git repo (for push-to-deploy):**

   ```bash
   mkdir -p /opt/like2gig
   cd /opt/like2gig.git && git init --bare
   git symbolic-ref HEAD refs/heads/main
   ```

4. **Create the deploy hook** at `/opt/like2gig.git/hooks/post-receive`:

   ```bash
   #!/bin/bash
   set -e

   APP_DIR=/opt/like2gig
   GIT_DIR=/opt/like2gig.git

   echo "==> Deploying like2gig..."

   git --work-tree=$APP_DIR --git-dir=$GIT_DIR checkout -f main

   cd $APP_DIR
   pnpm install
   cd client && pnpm run build && cd ..
   cd server && pnpm run build && cd ..

   systemctl restart like2gig
   echo "==> Deploy complete!"
   ```

   Then `chmod +x /opt/like2gig.git/hooks/post-receive`.

5. **Allow native build scripts** (needed for `better-sqlite3`):

   ```bash
   # In /opt/like2gig/package.json, add:
   # "pnpm": { "onlyBuiltDependencies": ["better-sqlite3", "esbuild"] }
   # Then:
   pnpm rebuild better-sqlite3
   ```

6. **Create the systemd service** at `/etc/systemd/system/like2gig.service`:

   ```ini
   [Unit]
   Description=Like2Gig
   After=network.target

   [Service]
   Type=simple
   WorkingDirectory=/opt/like2gig/server
   ExecStart=/usr/bin/node dist/index.js
   Restart=on-failure
   RestartSec=5
   EnvironmentFile=/opt/like2gig/.env
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

   Then:

   ```bash
   systemctl daemon-reload
   systemctl enable like2gig
   ```

### Domain and HTTPS

1. **Add a DNS A record** pointing your subdomain to the server IP (e.g. `like2gig` -> `204.168.132.106`).

2. **Configure Caddy** at `/etc/caddy/Caddyfile`:

   ```
   like2gig.evangriffiths.org {
       root * /opt/like2gig/client/dist
       file_server

       handle /auth/* {
           reverse_proxy localhost:3001
       }

       handle /api/* {
           reverse_proxy localhost:3001
       }

       handle {
           try_files {path} /index.html
       }
   }
   ```

   Then `systemctl restart caddy`. Caddy auto-provisions the SSL certificate.

3. **Add the production redirect URI** in the Spotify Developer Dashboard:
   `https://like2gig.evangriffiths.org/auth/callback`

### Environment variables

Create `/opt/like2gig/.env` on the server:

```bash
CLIENT_ID=your_spotify_client_id
CLIENT_SECRET=your_spotify_client_secret
SESSION_SECRET=<generate with: openssl rand -hex 32>
BASE_URL=https://like2gig.evangriffiths.org
```

### Deploying changes

Pushing to `main` on GitHub automatically triggers a deploy via GitHub Actions. The workflow SSHs into the server and pushes to the bare git repo, which runs the post-receive hook.

**One-time setup for CI:**

```bash
# Add your SSH private key as a GitHub secret
gh secret set DEPLOY_SSH_KEY < ~/.ssh/id_ed25519
```

Then just push to GitHub as normal:

```bash
git push origin main
```

**Manual deploy** (bypasses GitHub):

```bash
# One-time: add the deploy remote
git remote add deploy root@204.168.132.106:/opt/like2gig.git

# Deploy directly
git push deploy main
```

### Copying the local database to the server

To avoid re-syncing from scratch:

```bash
# Checkpoint WAL so all data is in the main .db file
sqlite3 server/data/like2gig.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Stop app, copy, clean WAL files, restart
ssh root@204.168.132.106 'systemctl stop like2gig'
scp server/data/like2gig.db root@204.168.132.106:/opt/like2gig/server/data/like2gig.db
ssh root@204.168.132.106 'rm -f /opt/like2gig/server/data/like2gig.db-wal /opt/like2gig/server/data/like2gig.db-shm && systemctl start like2gig'
```

## TODO

- Add a sync button/icon on the gigs page for syncing with the Songkick backend
