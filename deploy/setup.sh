#!/bin/bash
# One-time server setup for Like2Gig
# Run this on a fresh Ubuntu VPS as root
set -e

echo "==> Installing dependencies..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs sqlite3 caddy
npm install -g pnpm

echo "==> Setting up git bare repo..."
mkdir -p /opt/like2gig /opt/like2gig.git
cd /opt/like2gig.git && git init --bare
git symbolic-ref HEAD refs/heads/main

echo "==> Installing deploy hook..."
cp /dev/stdin /opt/like2gig.git/hooks/post-receive << 'HOOK'
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

cp deploy/like2gig.service /etc/systemd/system/like2gig.service
systemctl daemon-reload

systemctl restart like2gig
echo "==> Deploy complete!"
HOOK
chmod +x /opt/like2gig.git/hooks/post-receive

echo "==> Installing systemd service..."
# Service file will be copied from repo on first deploy

echo "==> Creating .env template..."
if [ ! -f /opt/like2gig/.env ]; then
  cat > /opt/like2gig/.env << ENV
CLIENT_ID=
CLIENT_SECRET=
SESSION_SECRET=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 16)
BASE_URL=https://like2gig.evangriffiths.org
ENV
  echo "    Edit /opt/like2gig/.env with your Spotify credentials"
fi

echo ""
echo "==> Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit /opt/like2gig/.env with your Spotify CLIENT_ID and CLIENT_SECRET"
echo "  2. Copy deploy/Caddyfile to /etc/caddy/Caddyfile (update password hash)"
echo "  3. Run: systemctl restart caddy"
echo "  4. From your local machine: git push deploy main"
echo "  5. Set up cron: crontab deploy/crontab (update CRON_SECRET)"
