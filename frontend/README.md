# SmartMurima — Web Client

The frontend for **SmartMurima**, an AI-driven precision agriculture platform for smallholder
farmers and cooperatives in **Bugesera District, Rwanda**. Live soil, weather, and crop-health
data; ML advice on irrigation, fertilizer and yield; photo-based disease detection; and a
Kinyarwanda-first RAG assistant.

Built with **Next.js 14 (App Router)**, **TypeScript (strict)**, **Tailwind CSS**, **shadcn/ui**,
**TanStack Query**, **Zod**, **React Hook Form**, **Recharts**, **next-intl**, and **Sonner**.

## Design

A restrained, agriculture-forward system in **three colors only — green, white, black**. Green
carries identity and action, white is space, black is text. Semantic states are expressed through
green shades, black, and opacity (never new hues). Tokens live as CSS variables in
`src/app/globals.css` and are wired into `tailwind.config.ts` (`green.*`, `ink.*`, `paper`,
`line`). Light and dark themes are driven by `data-theme`. See `docs/DESIGN_SYSTEM.md`.

## Getting started

Requires **Node 20+** and **pnpm**.

```bash
pnpm install
cp .env.example .env.local   # already present; adjust if needed
pnpm dev                     # http://localhost:3000
```

The app boots into a **mock backend (MSW)** so the entire UI is usable with no server running.

### Sign in (mock mode)

Any email + password signs you in. Include `2fa` anywhere in the password to exercise the OTP
step. On the OTP screen, **any 6-digit code** verifies. Registration and password reset flow
through the same OTP screen.

## Environment

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the API (see `docs/API_CONTRACT.md`) | `http://localhost:8000/api/v1` |
| `NEXT_PUBLIC_API_MOCKING` | `enabled` runs the MSW mock layer; `disabled` talks to the real backend | `enabled` |

To run against the real Django backend, set `NEXT_PUBLIC_API_MOCKING=disabled` and point
`NEXT_PUBLIC_API_URL` at it.

## Scripts

```bash
pnpm dev      # dev server
pnpm build    # production build (standalone output)
pnpm start    # serve the production build
pnpm lint     # ESLint (clean)
pnpm format   # Prettier
```

## Docker

```bash
docker build -t smartmurima-frontend .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 smartmurima-frontend
```

Or via the repo-root compose file (service `frontend`, port 3000):

```bash
docker compose up frontend
```

The image is a multi-stage `node:20-alpine` build producing Next.js standalone output.

## Project structure

```
src/
  app/
    (auth)/          login, register, verify-otp, forgot-password  (split-screen green hero)
    (app)/           dashboard, farms, farms/[id], fields/[id], recommendations,
                     diseases, assistant, alerts, reports, admin, settings
    layout.tsx       root: fonts, i18n provider, theme, query client, MSW gate
    providers.tsx    client providers
  components/        StatTile, SensorGauge, SensorTrendChart, RecommendationCard,
                     DiseaseUploadCard, AssistantChat, AlertItem, OtpInput, LanguageToggle,
                     AppSidebar, TopBar, BottomTabBar, DataTable, EmptyState, Skeletons,
                     FarmFieldSwitcher, ThemeToggle, CountUp, ConfidenceBar, ErrorBoundary
    ui/              shadcn/ui primitives restyled to the token system
  hooks/             useAuth, useFarms, useFields, useSensorReadings, useRecommendations,
                     useDiseaseDetect, useAssistant, useAlerts, useReports, useAdmin
  lib/               api.ts (typed client + JWT refresh interceptor), schemas.ts (Zod),
                     token-store.ts, query-client.ts, utils.ts
  i18n/              next-intl config + rw/en messages (Kinyarwanda default)
  mocks/             MSW handlers + realistic sample data (Bugesera farms, sensors, etc.)
```

## Data layer

- `lib/api.ts` — a typed fetch client. The access token is held **in memory**; the refresh token
  is persisted. On a `401` it transparently refreshes and retries once, then redirects to
  `/login`.
- `lib/schemas.ts` — Zod schemas mirroring every payload in `docs/API_CONTRACT.md`; responses are
  parsed and validated.
- `hooks/*` — one TanStack Query hook module per resource.

## Accessibility & quality

TypeScript strict (no `any`), ESLint + Prettier clean. Loading skeletons, error boundaries, and
empty states throughout. Fully responsive (sidebar → bottom tab bar on mobile, ≥44px touch
targets), keyboard accessible with visible focus rings, WCAG AA contrast, and
`prefers-reduced-motion` respected (count-up, chart draw-in, and streaming all degrade to instant).

## Internationalization

Kinyarwanda (`rw`) is the default; English (`en`) is available via the toggle in the top bar and
settings. Locale is stored in a cookie and applied server-side by next-intl — no URL prefix.
