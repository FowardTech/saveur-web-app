# Saveur Web

The web counterpart to the Saveur mobile app (AI career coaching: mock interviews,
coding practice, resume tools, career roadmap, job alerts, learning courses).
Same backend, same users, same Firebase project — this is purely a new UI
surface, built with Next.js (App Router) + TypeScript + Tailwind CSS.

Every sidebar section has a real page wired to the actual backend (auth,
onboarding, dashboard, AI Coach, Practice, Career Tools, Resume Tools,
Learning, Job Alerts, Referral, Subscription, Settings, Live Support), backed
by the same Firebase project and Flask API as mobile. A handful of screens are
honest, deliberate placeholders rather than full ports of mobile's richest
flows — most notably the live, real-time voice/video interview and
interactive-scenario experiences (Mock Interviews / Practical Scenarios show
the session was created and explain the full live flow is a future pass;
Coding Practice lists real problems without in-browser code execution yet;
Live Support is a static contact page, no chat backend exists for it yet on
either platform). Everything else — AI Coach chat, Career Roadmap/DNA/Dream
Companies, Resume Builder/Cover Letters/LinkedIn Optimizer/Variants,
Salary Negotiation, Job Alerts, Referral, Subscription/Stripe billing,
2FA, LinkedIn OAuth — is fully functional, not a stub.

The app is also fully localized: 12 languages (English, Spanish, French,
German, Italian, Portuguese, Russian, Arabic, Hindi, Japanese, Korean,
Chinese) via `i18n/`, with a language switcher in the sidebar and RTL support
for Arabic.

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
   app uses both). LinkedIn sign-in is a separate, hand-rolled OAuth flow
   against the backend (`/api/v1/auth/linkedin/start` → LinkedIn → the
   backend's `/callback` → this app's `/auth/linkedin/callback`), not a
   Firebase-native provider — Firebase has no built-in LinkedIn provider.
7. Under Authentication → Settings → **Authorized domains**, add
   `localhost` (usually already there) and, once deployed, your real domain
   — otherwise Google sign-in's popup flow will reject the request.

## Backend CORS

The backend's `CORS_ORIGINS` env var controls which origins the Flask API
will accept requests from at all — a request from an origin not in that list
fails at the browser/network level (CORS preflight rejection) before it ever
reaches Flask, which surfaces in this app as apiClient's "No internet
connection" message (see `lib/apiClient.ts`'s `request()`), NOT as a normal
HTTP error response. If AI-feature calls (or any API call) on the deployed
site show that message even though the backend itself is healthy, the first
thing to check is `CORS_ORIGINS` on the droplet — it needs to explicitly
include this app's real deployed origin (defaulting to `"*"` only works for
local dev / no-credential requests in most setups). This has been flagged
before as a droplet configuration item, not a web app code issue.

## Project structure

```
app/
  page.tsx                    landing page (/)
  login/, register/, onboarding/   auth + onboarding flow
  auth/linkedin/callback/     lands here after the backend's LinkedIn OAuth redirect
  dashboard/                  authenticated home
  ai-coach/                   AI Coach chat (text + browser-voice mode)
  practice/                   Mock Interviews, Coding Practice, Practical Scenarios
  career/                     Roadmap, DNA, Networking, Dream Companies,
                               Company Intelligence, Salary Negotiation
  resume/                     Builder, Cover Letter, LinkedIn Optimizer, Variants
  learning/, job-alerts/, referral/, support/
  subscription/, subscription/success/   plans + checkout + post-checkout redirect
  settings/                   hub, Profile, Payment Method, Security (2FA)
  not-found.tsx, error.tsx    themed 404 / root error boundary
  providers/                  AuthProvider, ThemeProvider, I18nProvider
  globals.css                 design tokens (light/dark CSS variables) + Tailwind v4 @theme
components/
  shell/                      Sidebar, Topbar, AppShell, ThemeToggle, UserMenu
  landing/                    CookieBar, WelcomeModal, HeroBanner
  auth/                       AuthLayout, RequireAuth, GoogleButton, LinkedInButton
  ui/                         Button, TextField, SelectField, ActionCard, PageHeader
  icons/                      EvaIcon.tsx (renders lib/eva-icons.generated.ts)
lib/
  firebase.ts                 Firebase Web SDK init
  apiClient.ts                 fetch wrapper, attaches Firebase ID token, real error messages
  errors.ts                    getErrorMessage() — surfaces real apiClient/Firebase error text
  billingService.ts            plans / checkout / portal calls
  types.ts                     UserProfile + wire<->camelCase translation
  navigation.ts                 sidebar + quick-action taxonomy
  eva-icons.generated.ts        AUTO-GENERATED, see scripts/generate-icons.mjs
i18n/
  config.ts                    i18next setup, supported/RTL language lists
  locales/<lang>/               common.json + web.json per language (12 languages)
scripts/generate-icons.mjs      regenerate the icon set above after adding a new EvaIcon name
```

## Design system

- **Font**: Plus Jakarta Sans, self-hosted via `next/font/local` (the
  `@fontsource/plus-jakarta-sans` package) rather than `next/font/google`, so
  builds don't need network access to fonts.googleapis.com. Montserrat
  Alternates (Black, 900) is a second, dedicated wordmark-only font for the
  "Saveur" brand text (`font-brand`), matching mobile's `BrandWordmark`.
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
npm run lint
```
