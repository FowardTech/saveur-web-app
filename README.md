# Saveur Web

The web counterpart to the Saveur mobile app (AI career coaching: mock interviews,
coding practice, resume tools, career roadmap, job alerts, learning courses).
Same backend, same users, same Firebase project — this is purely a new UI
surface, built with Next.js (App Router) + TypeScript + Tailwind CSS.

This first pass covers the **foundation only**: design system, app shell
(sidebar + topbar), auth, onboarding, and the Home dashboard. The other 60+
screens from the mobile app are intentionally not built yet — sidebar links to
those sections (Mock Interviews, Coding Practice, Resume Builder, etc.) will
404 until later passes fill them in.

## Getting started

```bash
cd /Users/ayotunde/Documents/ReactNativeProjects/Saveur-Web
npm install
cp .env.local.example .env.local   # then fill in the two Firebase values, see below
npm run dev
```

Open http://localhost:3000.

## What you need to do before auth works

Sign-in/sign-up won't work until you register a **Web app** for the existing
`saveur-ac8ec` Firebase project (this app already knows the project's other
config — authDomain, projectId, storageBucket, messagingSenderId — since
those are shared with the mobile app):

1. Go to the [Firebase Console](https://console.firebase.google.com/) → the
   `saveur-ac8ec` project → **Project settings** → **General**.
2. Under "Your apps", click **Add app** → the `</>` (Web) icon.
3. Give it a nickname (e.g. "Saveur Web") — you don't need Firebase Hosting.
4. Copy the generated `apiKey` and `appId` values.
5. Paste them into `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=<the apiKey you copied>
   NEXT_PUBLIC_FIREBASE_APP_ID=<the appId you copied>
   ```
6. Make sure **Email/Password** and **Google** sign-in are enabled under
   Authentication → Sign-in method (they should already be, since the mobile
   app uses both).
7. Under Authentication → Settings → **Authorized domains**, add
   `localhost` (usually already there) and, once deployed, your real domain
   — otherwise Google sign-in's popup flow will reject the request.

## Backend CORS

The backend's `CORS_ORIGINS` env var currently defaults to `"*"`, so this app
should be able to call `https://api.saveurnow.com` out of the box from
`localhost`. Once you know the real domain this gets deployed to, it's worth
confirming `CORS_ORIGINS` on the backend droplet either still allows `*` or
explicitly includes that domain.

## Project structure

```
app/
  page.tsx                landing page (/)
  login/page.tsx           /login
  register/page.tsx        /register
  onboarding/page.tsx       /onboarding
  dashboard/page.tsx        /dashboard (authenticated home)
  subscription/page.tsx     /subscription (plans + checkout)
  subscription/success/     /subscription/success (post-checkout redirect target)
  providers/                AuthProvider, ThemeProvider
  globals.css                design tokens (light/dark CSS variables) + Tailwind v4 @theme
components/
  shell/                    Sidebar, Topbar, AppShell, ThemeToggle, UserMenu
  landing/                  CookieBar, WelcomeModal
  auth/                     AuthLayout, GoogleButton
  ui/                       Button, TextField, ActionCard
  icons/                    EvaIcon.tsx (renders lib/eva-icons.generated.ts)
lib/
  firebase.ts                Firebase Web SDK init
  apiClient.ts                fetch wrapper, attaches Firebase ID token
  billingService.ts           plans / checkout / portal calls
  types.ts                    UserProfile + wire<->camelCase translation
  navigation.ts                sidebar + quick-action taxonomy
  eva-icons.generated.ts       AUTO-GENERATED, see scripts/generate-icons.mjs
scripts/generate-icons.mjs     regenerate the icon set above after adding a new EvaIcon name
```

## Design system

- **Font**: Plus Jakarta Sans (`next/font/google`), the app's only typeface.
- **Colors**: CSS variables on `:root` (light) / `.dark` (dark, default
  theme), re-exposed to Tailwind via `@theme inline` in `app/globals.css` —
  e.g. `bg-page`, `text-primary`, `text-hint`, `bg-brand`, `bg-surface-2`,
  `bg-tint-mint` / `text-tint-mint-text`, etc. Dark mode is class-based
  (`next-themes` toggles `.dark` on `<html>`), not OS-preference-based.
- **Radius**: `rounded-card` (12px) for cards, `rounded-pill` (999px) for
  buttons/chips.
- **Icons**: [`eva-icons`](https://www.npmjs.com/package/eva-icons) — the
  same set the mobile app uses via `@ui-kitten/eva-icons`. Only the icon
  names actually used in this app are pre-extracted into
  `lib/eva-icons.generated.ts` (via `scripts/generate-icons.mjs`) to keep the
  bundle small; add a new name to that script's `ICONS` list and re-run it
  if you need an icon that isn't there yet.

## Backend contract notes

- Auth/profile: `POST /api/users/me` (sync/provision after Firebase sign-in),
  `GET /api/users/me`, `PATCH /api/users/me` — confirmed against
  `Saveur-Backend/app/api/users.py`.
- Billing: `GET /api/v1/billing/plans`, `POST /api/v1/billing/checkout`,
  `POST /api/v1/billing/portal` — confirmed against
  `Saveur-Backend/app/api/billing.py`. Note these live under the `/api/v1/`
  prefix (billing has no un-versioned alias the way `/api/users/me` does).

## Build

```bash
npm run build
```
