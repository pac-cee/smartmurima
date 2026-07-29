# SmartMurima — Frontend Build Prompt

> Paste this into a fresh coding session (or hand to a frontend agent) to build the SmartMurima web client.

## Role
You are a senior frontend engineer and product designer. Build the **SmartMurima** web
application — the client for an AI-driven precision agriculture platform serving smallholder
farmers and cooperatives in Bugesera District, Rwanda.

## Stack (non-negotiable)
- **Next.js 14** (App Router) + **TypeScript** (strict).
- **Tailwind CSS** + **shadcn/ui** components.
- **TanStack Query** for server state, **Zod** for validation, **React Hook Form** for forms.
- **Recharts** for charts, **lucide-react** for icons, **next-intl** for i18n (Kinyarwanda + English, `rw` default).
- **Sonner** for toasts. Containerized with Docker (Node 20 alpine).

## Design language — READ `docs/DESIGN_SYSTEM.md` AND FOLLOW IT EXACTLY
Three colors only: **green, white, black**. Green is brand + action, white is space, black is
text. No other hues anywhere — semantic states use green shades/black/opacity. Agriculture feel:
clean, calm, generous whitespace, soft green-tinted shadows, rounded cards, big readable numbers.
Load the `frontend-design` skill mindset: intentional, non-templated, distinctive but restrained.

Implement the color tokens as CSS variables in `globals.css`, wire them into
`tailwind.config.ts` (`colors: { green: {...}, ink: {...}, paper, line }`), and restyle every
shadcn component to these tokens. Support light + dark via `data-theme`.

## Information architecture / routes
```
/(auth)/login, /register, /verify-otp, /forgot-password        <- OTP flow, split-screen w/ green hero
/(app)/dashboard            <- KPI stat row, sensor trend chart, recommendations feed, alerts, disease strip
/(app)/farms                <- farms list + create; /farms/[id] farm detail (fields, map, nodes)
/(app)/fields/[id]          <- field detail: live gauges, history charts, recs, disease reports
/(app)/recommendations      <- irrigation / fertilizer / yield, request + history, confidence bars
/(app)/diseases             <- image upload dropzone -> CNN result card (disease, confidence, treatment)
/(app)/assistant            <- RAG chat: message bubbles, source chips, streaming, language toggle
/(app)/alerts               <- notification center
/(app)/reports              <- summaries + export (pdf/csv)
/(app)/admin                <- (admin) users, sensor nodes, knowledge documents
/(app)/settings             <- profile, language, security
```

## App shell
- Fixed left **sidebar** (`green-800`, collapsible icon rail), nav with lucide icons + labels.
- **Top bar** (white, hairline border): farm/field switcher, `rw/en` language toggle, alerts bell
  with unread count, theme toggle, user menu.
- Mobile: sidebar → bottom tab bar; large touch targets (≥44px); icon+label everywhere.
- Design for **low digital literacy**: plain language, icons, charts over dense text.

## Key components to build (in `components/`)
StatTile (icon, label, tabular-nums value, trend delta), SensorGauge (radial green fill),
SensorTrendChart (Recharts green ramp, range selector), RecommendationCard (type icon, decision,
confidence bar, details), DiseaseUploadCard (drag-drop, preview, result with confidence + treatment),
AssistantChat (bubbles: farmer=green-50, assistant=white bordered, source chips, streaming, typing
indicator), AlertItem, OtpInput (6 cells, auto-advance/paste), LanguageToggle, AppSidebar, TopBar,
DataTable (sortable/paginated), EmptyState, Skeletons, FarmFieldSwitcher.

## Data layer
- `lib/api.ts`: typed fetch client, base `NEXT_PUBLIC_API_URL`, JWT in memory + refresh interceptor,
  401 → refresh → retry → redirect to login.
- `lib/schemas.ts`: Zod schemas mirroring `docs/API_CONTRACT.md`.
- `hooks/`: `useAuth`, `useFarms`, `useFields`, `useSensorReadings`, `useRecommendations`,
  `useDiseaseDetect`, `useAssistant`, `useAlerts` — all TanStack Query.
- Follow every endpoint in `docs/API_CONTRACT.md`. Build a `mocks/` MSW layer so the UI runs
  standalone before the backend is up.

## Auth & OTP UX
Register → "we sent a 6-digit code" → OtpInput (resend timer) → verified → dashboard.
Login with optional OTP 2FA step. Password reset via OTP. Store role, gate routes/nav by role
(`farmer|coop_admin|extension|admin`).

## Quality bar
- TypeScript strict, no `any`. ESLint + Prettier clean.
- Loading skeletons + optimistic updates where sensible; error boundaries + empty states everywhere.
- Fully responsive, keyboard accessible, WCAG AA, `prefers-reduced-motion` respected.
- Subtle motion only (150–200ms). Number count-up on stats, chart draw-in.
- README with `pnpm install && pnpm dev`, env vars, and Docker instructions.

## Deliverables
A complete, runnable `frontend/` Next.js app: all routes above (real UI, wired to the API client
with MSW fallback), the full component library, i18n rw/en, the green/white/black design system
applied throughout, and a `Dockerfile` + `.dockerignore`. Prioritize dashboard, assistant,
disease detection, and the auth/OTP flow as the showcase screens.
