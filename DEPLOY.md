# Deploying Saveur-Web to the droplet

DNS is already set: `app.saveurnow.com -> 134.209.218.170`.

I don't have SSH access to the droplet, so this is a copy-paste runbook for
you to run yourself: `ssh root@134.209.218.170`, then paste each block below
in order.

## 1. Check what's serving TLS today

```bash
sudo ss -tlnp | grep -E ':80|:443'
```

Look for `caddy` or `nginx` in the output. Use the matching step 4 below.

## 2. Get the code onto the droplet

```bash
cd ~
git clone <your Saveur-Web repo URL> Saveur-Web   # or however Saveur-Backend got here — scp, etc.
cd Saveur-Web
```

## 3. Create the production env file and start the container

Paste this whole block as one command — it writes `.env` with every real
value already filled in (Firebase config + the VAPID key you just gave me),
then builds and starts the container:

```bash
cat > .env <<'EOF'
NEXT_PUBLIC_API_BASE_URL=https://api.saveurnow.com
NEXT_PUBLIC_SITE_URL=https://app.saveurnow.com
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=saveur-ac8ec.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=saveur-ac8ec
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=saveur-ac8ec.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=679326954548
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCQ-hJKws1IHxBrKZ3V4Lk8Z0sbRvT7770
NEXT_PUBLIC_FIREBASE_APP_ID=1:679326954548:web:3acc7f6cf84baef1024661
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BHjnmHvtNIsUU1ZRgxQ4lm87X0nYDq6HS8vtdUGV5YXfqVQW4HZ_eZKA--NDyV0sKW5r1NzLsQ23AWTDn5xvySU
EOF

docker compose build web
docker compose up -d web
docker compose logs -f web
```

Wait for a line like `Ready in ...ms` / `Listening on port 3000`, then
Ctrl+C (the container keeps running in the background — `-f` just follows
the log).

## 4. Point the reverse proxy at it

**If step 1 showed Caddy:**

```bash
sudo tee -a /etc/caddy/Caddyfile <<'EOF'

app.saveurnow.com {
	reverse_proxy 127.0.0.1:3000
}
EOF
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy issues the TLS cert automatically on reload — nothing else to run.

**If step 1 showed nginx instead:**

```bash
sudo cp ~/Saveur-Web/deploy/nginx.app-saveurnow.conf /etc/nginx/sites-available/app.saveurnow.com
sudo ln -s /etc/nginx/sites-available/app.saveurnow.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.saveurnow.com
```

## 5. Update the backend to trust the new domain

This is the step that actually fixes the CORS errors from before — without
it the site loads but every sign-in/API call still fails with "No internet
connection," just on the real domain instead of localhost.

```bash
cd ~/Saveur-Backend   # wherever it lives on this droplet
grep -q '^CORS_ORIGINS=' .env && sed -i 's|^CORS_ORIGINS=.*|CORS_ORIGINS=https://app.saveurnow.com|' .env || echo 'CORS_ORIGINS=https://app.saveurnow.com' >> .env
grep -q '^WEB_APP_BASE_URL=' .env && sed -i 's|^WEB_APP_BASE_URL=.*|WEB_APP_BASE_URL=https://app.saveurnow.com|' .env || echo 'WEB_APP_BASE_URL=https://app.saveurnow.com' >> .env
docker compose restart api
```

If you ever need more than one allowed origin (e.g. still testing from a LAN
IP too), edit `.env` directly — it's comma-separated:
`CORS_ORIGINS=https://app.saveurnow.com,http://192.168.2.55:3000`.

## 6. Add the domain to Firebase

Firebase Console → project `saveur-ac8ec` → Authentication → Settings →
Authorized domains → Add domain → `app.saveurnow.com`.

Skipping this gives `Firebase: Error (auth/unauthorized-domain)` on Google
sign-in on the live site.

## 7. Test

Visit `https://app.saveurnow.com` and try: registering a new account, Google
sign-in, LinkedIn sign-in — and confirm the new user shows up in the admin
dashboard. All of those were failing purely because of the CORS/domain
issues above, not app bugs, so they should all work now.

## Redeploying later

```bash
cd ~/Saveur-Web
git pull
docker compose build web
docker compose up -d web
```

Any change to a value in `.env` needs a rebuild (`docker compose build
web`), not just a restart — `NEXT_PUBLIC_*` values get baked into the
JS bundle at build time.
