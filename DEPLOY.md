# Deploying Saveur-Web to the droplet

You've already added the DNS A record: `app.saveurnow.com -> 134.209.218.170`.
Everything below runs **on the droplet itself over SSH** — I don't have SSH
access to it, so these are copy-paste commands for you to run.

## 0. Confirm what's serving api.saveurnow.com today

```bash
sudo ss -tlnp | grep -E ':80|:443'
```

Look at the process name in the output — `caddy` or `nginx`. Use the
matching section below. (If it's something else entirely, e.g. a managed
load balancer, stop here and tell me what you see.)

## 1. Get the code onto the droplet

Same pattern as Saveur-Backend presumably already used — clone as a sibling
directory:

```bash
cd ~
git clone <your Saveur-Web repo URL/path> Saveur-Web
cd Saveur-Web
```

(If Saveur-Backend was deployed by `scp`-ing a local copy instead of
`git clone`, do the same here — whichever you used before.)

## 2. Create the production env file

```bash
cp .env.production.example .env
nano .env   # fill in NEXT_PUBLIC_FIREBASE_VAPID_KEY if you have it yet — see the file's own comment; everything else is already filled in correctly
```

## 3. Build and start the container

```bash
docker compose build web
docker compose up -d web
docker compose logs -f web   # Ctrl+C once you see it listening on port 3000
```

## 4. Point the reverse proxy at it

### If it's Caddy
Open `/etc/caddy/Caddyfile` and add the block from `deploy/Caddyfile.snippet`
in this repo (just the `app.saveurnow.com { ... }` part). Then:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy issues the TLS certificate automatically on reload — nothing else to run.

### If it's nginx
```bash
sudo cp deploy/nginx.app-saveurnow.conf /etc/nginx/sites-available/app.saveurnow.com
sudo ln -s /etc/nginx/sites-available/app.saveurnow.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.saveurnow.com
```

## 5. Update the backend so it trusts this new origin

This is the step that actually fixes the CORS errors from earlier — without
it, the site will load but every sign-in/API call will still fail with "No
internet connection" exactly as before, just on the real domain instead of
localhost.

```bash
cd ~/Saveur-Backend   # or wherever it lives on this droplet
nano .env
```

Update (or add) these two lines:

```
CORS_ORIGINS=https://app.saveurnow.com
WEB_APP_BASE_URL=https://app.saveurnow.com
```

If `CORS_ORIGINS` needs to allow more than one origin later (e.g. you keep
testing from a LAN IP too), it's comma-separated: `CORS_ORIGINS=https://app.saveurnow.com,http://192.168.2.55:3000`.

Then restart the backend so it picks up the change:

```bash
docker compose restart api
```

## 6. Tell Firebase about the new domain

Firebase Console -> your saveur-ac8ec project -> Authentication -> Settings ->
Authorized domains -> Add domain -> `app.saveurnow.com`.

Without this, Google/email sign-in will fail with
`Firebase: Error (auth/unauthorized-domain)` on the live site — the same
error seen earlier when testing from an unlisted dev origin.

## 7. Test

Visit `https://app.saveurnow.com` and try: registering a new account, Google
sign-in, LinkedIn sign-in, and confirm the new user shows up in the admin
dashboard. All four were broken locally purely because of the CORS/domain
issues above — they should all work now that the real domain is allow-listed
end to end.

## Redeploying after future code changes

```bash
cd ~/Saveur-Web
git pull
docker compose build web
docker compose up -d web
```

Remember: any change to a `NEXT_PUBLIC_*` value in `.env` requires a rebuild
(`docker compose build web`), not just a restart — see the Dockerfile's own
comment for why.
