# Multi-stage build for a self-contained Next.js production server —
# mirrors the shape of Saveur-Backend's own Dockerfile (same droplet, same
# "build once, run a slim final image" idea), adapted for Next's
# "standalone" output (see next.config.ts's `output: "standalone"` comment).
#
# IMPORTANT — NEXT_PUBLIC_* variables are baked in at BUILD time, not read
# at container start. Next.js inlines every `process.env.NEXT_PUBLIC_*`
# reference directly into the client JS bundle during `next build`, so
# these must be passed as Docker build ARGs (see docker-compose.yml's
# `build.args`), not just listed in an env_file — an env_file only affects
# the running container's process env, which is too late for anything
# NEXT_PUBLIC_-prefixed. If you ever change one of these values, you must
# rebuild the image (`docker compose build web`), not just restart it.

# BUG FIX (droplet report: "no space left on device" mid-build) — this used
# to be a separate `deps` stage whose /app/node_modules got COPY'd into this
# `builder` stage. Docker keeps both stages' filesystem layers on disk
# during the build (only unused ones get garbage-collected after), so that
# pattern briefly needs roughly 2x node_modules' size on disk at once. This
# droplet is a 512MB RAM / 10GB disk box already running Postgres+Redis+the
# backend's own images — real headroom is thin, so installing directly in
# this one stage (no separate deps stage, no duplicate COPY) instead of
# optimizing for rebuild-cache speed is the right tradeoff here.
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_VAPID_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_VAPID_KEY=$NEXT_PUBLIC_FIREBASE_VAPID_KEY \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --- Final, slim runtime image -----------------------------------------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user, same convention as most Next.js Docker guides — this
# process only ever serves already-built static/SSR output, no reason to
# run it as root.
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
