# SmartMurima — Design System

A restrained, agriculture-forward system. **Only three hues: green, white, black.** Green
carries identity and action; white is space; black is text and structure. No blues, no reds,
no purples. Semantic states (success/warning/danger) are expressed through *shades of green +
black + opacity*, never through new hues.

## 1. Color tokens

Define these as CSS variables on `:root` and consume through Tailwind. Green is the brand and
the only chroma in the system.

```css
:root {
  /* Green scale — the single hue */
  --green-50:  #ECFDF3;
  --green-100: #D1FADF;
  --green-200: #A6F4C5;
  --green-300: #6CE9A6;
  --green-400: #32D583;
  --green-500: #12B76A;   /* accent / highlights */
  --green-600: #16A34A;   /* PRIMARY — buttons, active nav, key CTAs */
  --green-700: #15803D;   /* hover / pressed */
  --green-800: #166534;   /* deep surfaces, sidebar */
  --green-900: #14532D;   /* darkest green, headings on light */

  /* Neutrals — white + black only */
  --white:     #FFFFFF;
  --paper:     #FBFDFB;   /* app background, a whisper of green-tinted white */
  --ink-900:   #0A0F0C;   /* primary text (near-black, faint green undertone) */
  --ink-700:   #2C332E;   /* secondary text */
  --ink-500:   #667065;   /* muted text, captions */
  --line:      #E4EAE5;   /* hairline borders (black @ ~10% over paper) */
}
```

Dark mode inverts to black surfaces with green as the sole accent:
```css
:root[data-theme="dark"] {
  --paper:   #0A0F0C;  --white: #10161200;
  --ink-900: #F2F7F3;  --ink-700: #C4CDC6;  --ink-500: #8A948C;
  --line:    #1E2621;
  /* green scale unchanged; green-500/600 read as the accent on black */
}
```

### Usage rules
- **Primary actions**: `--green-600` bg, white text. Hover → `--green-700`.
- **Sidebar / topbar brand strip**: `--green-800` bg, white/`--green-100` text.
- **Success**: `--green-600`. **Warning/attention**: `--green-800` outline + `--green-50` fill.
  **Danger/critical alert**: black (`--ink-900`) text/icon on `--green-50`, never red.
- **Charts**: sequential green ramp (`--green-200 → --green-700`); categorical series use
  green shades + black + white with distinct patterns/opacity, never invented hues.
- Text is always `--ink-900/700/500`. Never colored text except green links/labels.

## 2. Typography
- UI/body: **Inter** (or `Geist`), system-ui fallback.
- Display/headings: **Inter** tight tracking, `font-weight: 650–750`.
- Scale (rem): 0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.875, 2.25, 3.
- Numbers in stats/dashboards: `font-variant-numeric: tabular-nums`.
- Line-height: 1.5 body, 1.15 display.

## 3. Shape, elevation, spacing
- Radius: cards `16px`, buttons/inputs `10px`, pills `999px`, chart tiles `12px`.
- Spacing scale (Tailwind default 4px base): use 2, 3, 4, 6, 8, 12, 16, 24.
- Elevation via **soft green-tinted shadows**, not gray:
  `--shadow-sm: 0 1px 2px rgba(20,83,45,.06)`
  `--shadow-md: 0 6px 20px -6px rgba(20,83,45,.12)`
  `--shadow-lg: 0 18px 40px -12px rgba(20,83,45,.18)`
- Borders: 1px `--line`. Focus ring: 2px `--green-600` + 2px offset.

## 4. Layout & topology
- **App shell**: fixed left sidebar (`--green-800`, 264px, collapsible to 72px icon rail) +
  top bar (white, hairline bottom border, farm/field switcher + language toggle rw/en + user).
- **Content**: max-width 1280px, 24–32px gutters, 12-col responsive grid.
- **Dashboard**: KPI stat row (soil moisture, temp, humidity, active alerts) → 2-col
  (sensor trend chart | recommendations feed) → disease reports strip → assistant launcher.
- Mobile-first: sidebar becomes bottom tab bar; cards stack; charts scroll in `overflow-x`.
- Designed for **low digital literacy**: big touch targets (≥44px), icons + plain-language
  labels, Kinyarwanda default with English toggle.

## 5. Core components (shadcn/ui, restyled to tokens)
Card, StatTile (icon + label + big tabular number + trend delta), Button (primary/outline/ghost,
all green-based), Badge (green fills), Sidebar + nav, TopBar, DataTable, Charts (Recharts,
green ramp), SensorGauge (radial, green fill on track), RecommendationCard (type icon +
decision + confidence bar), DiseaseUploadCard (dropzone → result with confidence), ChatPanel
(assistant, message bubbles: farmer = `--green-50`, assistant = white bordered, source
chips), AlertItem, OtpInput (6-cell), LanguageToggle, EmptyState, Skeleton loaders.

## 6. Motion
Subtle only: 150–200ms ease-out on hover/press; number count-up on stat load; chart draw-in.
Respect `prefers-reduced-motion`.

## 7. Accessibility
WCAG AA contrast (green-600 on white passes for large/UI; use ink for body). Full keyboard
nav, visible focus, ARIA on interactive widgets, alt text on all imagery.
