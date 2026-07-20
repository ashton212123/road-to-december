# Road to December — Redesign Prompt Pack

Run these in **Claude Code, in this repo** (`C:\Users\Ashton\Documents\road-to-december`), one prompt per session (use `/clear` between them). Commit after each phase. Deploys are **CLI-only**: `npx vercel deploy --prod` (pushing to GitHub does NOT deploy).

Order matters: 1 (tokens) → 2 (desktop) → 3 (mobile) → 4 (Quick Log v2) → 5 (polish). Prompt 0 is optional visual exploration in Claude Design before touching code.

---

## Prompt 0 (optional — Claude Design, visual exploration only)

> Design a dark-mode dashboard concept for "Road to December", a personal training app for a competitive swimmer (countdown to a Dec 4 NCAA meet, training phases, nutrition tracking with calorie/protein/water rings, recovery readiness). Follow Apple's Human Interface Guidelines exactly: pure black background with a subtle radial glow, iOS dark system colors (blue #0A84FF, green #30D158, orange #FF9F0A, red #FF453A, cyan #5AC8FA, purple #BF5AF2), SF Pro-style typography using the Apple type scale (Large Title 34, Title 22, Headline 17 semibold, Body 17, Subhead 15, Footnote 13, Caption 11 — nothing smaller than 11px), translucent "material" cards with 0.5px hairline borders and inner top highlight, 8pt spacing grid, 20px card radius. Design TWO screens in TWO sizes each: (1) Home — countdown hero, coach alert cards, needs-attention list, today's schedule, quick stats; (2) Fuel — calorie/protein/water progress rings, macro donut, an AI meal quick-log, meal timeline. Desktop 1280px should be a true multi-column dashboard grid (not a stretched phone column); mobile 390px a single column with a 5-item bottom tab bar. It must feel like a native Apple app in dark mode: calm, precise, high contrast, generous whitespace, no gradients except the background glow.

Use the result as taste reference only — implementation happens in Claude Code below.

---

## Prompt 1 — Design-system foundation (type, contrast, tokens)

> This repo is Road to December, a Next.js 16 + Tailwind 4 app (dark-only, Apple-HIG-flavored) deployed on Vercel. The design foundation lives in `src/app/globals.css` (`--rtd-*` tokens) and `src/components/ui/*`. The visual direction is right (black bg, iOS system colors, glass cards) — but the execution has three systemic problems I want fixed app-wide in this pass, WITHOUT changing any features, data flow, or server actions:
>
> 1. **Type scale is far too small.** The app uses `text-[9px]`, `text-[10px]`, `text-[11px]`, and `text-xs` as body text everywhere. Replace with an Apple HIG scale defined as CSS variables + Tailwind theme entries in globals.css: caption 11px (absolute minimum, sparingly), footnote 13px, subhead 15px, body 17px, headline 17px/semibold, title-3 20px, title-2 22px, title-1 28px, large-title 34px (clamp down slightly on mobile). Sweep every component and page under `src/` and re-map: 9–10px → 11–13px, 11–12px → 13px, most `text-xs`/`text-sm` body copy → 15px, card titles → 17px semibold, page section labels keep the uppercase micro-label style but at 12px. Big stat numbers (countdown, kcal, weight) should use the display style at 28–34px+.
> 2. **Contrast is too low.** `--rtd-text-secondary` (0.65 alpha) and `--rtd-text-tertiary` (0.45 alpha) are used for load-bearing text. Raise secondary to rgba(235,235,245,0.78) and tertiary to rgba(235,235,245,0.58), and audit that no text conveying real information falls below WCAG AA 4.5:1 against #1c1c1e. Tertiary is only for true decoration/hints.
> 3. **Interaction affordances are missing.** Add to the shared UI components (`Button.tsx`, `GlassCard.tsx`, `TabBar.tsx` sidebar, chips/selects): visible `:hover` states on desktop (background lighten ~4%, 150ms ease), `:focus-visible` rings (2px `--rtd-blue` offset 2), `cursor-pointer` on all interactive elements, and `active:scale-[0.98]` press feedback on buttons. All form inputs (`input`, `textarea`, `select`) must render at **16px font-size minimum** so iOS Safari doesn't auto-zoom on focus — fix the shared input styling and every inline input in `src/components/`.
>
> Also: minimum touch target 44×44px for all tap targets on mobile (pad small chips/× buttons via padding or ::after hit area, don't visually bloat them).
>
> Do NOT redesign layouts in this pass — same structure, same features, just the token/type/contrast/affordance sweep. Verify by running the dev server, screenshot Home, Fuel, Train, Analytics, Settings at mobile 390px and desktop 1280px, and check nothing overflows or wraps badly. Run lint + build before finishing.

---

## Prompt 2 — Desktop layout: real dashboard, not a stretched phone

> Road to December (this repo) was designed mobile-first at 430px, and on desktop the shell (`src/app/(app)/layout.tsx`) just removes the max-width — so every page becomes one giant stretched column: full-width cards with tiny content, huge dead space, full-bleed buttons. Rebuild the ≥`md` experience into a real dashboard while leaving the mobile (<md) layout EXACTLY as it is. Keep all server components/actions untouched — this is layout composition only.
>
> Shell: keep the left sidebar; give the content area a 12-column CSS grid, max-w-6xl, 24px gutters. Per page at ≥md:
> - **Home** (`home/page.tsx`): countdown hero spans 8 cols with quick stats (weight/kcal/protein/water) as a 2×2 grid in the remaining 4; below, coach alert cards and "Needs attention" side-by-side (6+6); today's schedule full-width.
> - **Fuel** (`fuel/page.tsx`): two columns — left (5 cols): rings card, macro donut, weekly review; right (7 cols): quick log, meal timeline, water. Rings should scale up (~96px) on desktop.
> - **Train** (`train/page.tsx`): phase list becomes a 2-col grid of cards (phase color, week range, dates, a thin progress bar for % complete, NOW badge), instead of full-width rows with a chevron.
> - **Analytics**: charts 2-up where present; segmented control stays top.
> - **Business / School / More / Settings / Recovery**: center content at max-w-xl — never full-bleed. Buttons on desktop get intrinsic width (px-8) and sit right-aligned or inline — no more 1000px-wide "Save settings" / "+ New venture" buttons.
> - **Empty states**: every empty state gets a real CTA button linking to where the data comes from (e.g. Analytics strength empty state → "Log sets in Train" as a Link-button to /train), not just grey text.
>
> Verify with the browser preview at 1280px and 1536px: screenshot every page, confirm the grid holds, no card stretches absurdly, and mobile at 390px is pixel-identical to before. Lint + build.

---

## Prompt 3 — Mobile polish: 5-tab bar, IA, PWA

> Road to December (this repo) currently shows SEVEN items in the mobile bottom tab bar (`src/app/(app)/layout.tsx` + `src/components/ui/TabBar.tsx`) with 9px labels — over Apple's 5-tab limit and cramped. Restructure mobile navigation without losing any screen:
>
> 1. **Tab bar → 5 items**: Home, Train, Fuel, Analytics, More. Business and School move into the More screen as rows (keep their routes working — only nav placement changes). Desktop sidebar KEEPS all seven entries. Bump tab labels to 11px; keep safe-area padding.
> 2. **More screen** (`more/page.tsx`): reorder rows by frequency of use — Recovery first (it's a daily-use screen for a training app), then School, Business, Settings, Coach AI, Log out. Give Business/School the same row style as existing entries.
> 3. **Active tab feedback**: subtle spring scale on the active icon (respect `prefers-reduced-motion`, which globals.css already handles).
> 4. **PWA audit**: check `public/manifest.webmanifest` — standalone display, `background_color`/`theme_color` #000000, correct icon sizes incl. 180px apple-touch-icon and maskable 512; add `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` and theme-color meta if missing so it feels native when added to the home screen.
> 5. Sweep mobile screens at 390×844 for horizontal overflow, text truncation, and any tap target under 44px that Prompt 1 missed.
>
> Verify in the browser preview at 390px: screenshot every tab plus More→Recovery and More→Settings. Lint + build.

---

## Prompt 4 — Quick Log v2: AI macro estimation

> Rebuild the Fuel quick log in this repo (Road to December) around AI macro estimation. Today: `src/components/fuel/MealQuickLog.tsx` + `parseMealTextAction` in `src/app/(app)/fuel/actions.ts` regex-split the text (`src/lib/nutrition/parseMealText.ts`) and fuzzy-match USDA (`src/lib/nutrition/usda.ts`). USDA-first is the wrong mechanic: matches are generic per-100g entries, portions are ignored, and mixed Filipino dishes (adobo, sinigang, tapsilog) match poorly. New mechanic — "type what I ate, AI thinks the macros, I can make it rethink or just type macros myself":
>
> **Estimation layer** — new `src/lib/nutrition/aiMacros.ts` calling the Groq API (free tier; env var `GROQ_API_KEY`, model `llama-3.3-70b-versatile`, JSON-schema/JSON-mode output, temperature 0.2). One call per parse handles the whole text. System prompt: a sports-nutrition macro estimator for a 63kg competitive swimmer in the Philippines — knows Filipino food (adobo, sinigang, tocino, rice portions in cups), always states portion assumptions, realistic cooked-weight estimates. Output per item: `{ timeSlot?, name, portionDesc, kcal, proteinG, carbsG, fatG, confidence: "high"|"medium"|"low", assumptions: string }`. Default missing time slots server-side from Manila hour (reuse `defaultTimeSlotForHour`). If the Groq call fails or the key is missing, fall back to the existing regex+USDA path so the feature never breaks; never throw to the client.
>
> **Review UI** (rework `MealQuickLog.tsx`, keep `GlassCard` style): textarea → "Estimate" → per-item review cards, nothing saves automatically (keep that trust line). Each card shows: editable name + time-slot select; the 4 macro fields always directly editable (numeric, 16px font); the AI's assumption as one secondary-text line (e.g. "assumed 1.5 cups cooked rice ≈ 280g"); a small confidence dot (green/orange/red); portion chips ×0.5 ×1.5 ×2 that scale all four macros; Remove. Actions per card: **Rethink** — reveals an optional hint input ("big serving", "no oil, air-fried") and re-estimates ONLY that item via a re-call with the hint; if the user has hand-edited macros, show a "manual" badge and require an explicit tap ("Rethink anyway") before overwriting. Below the list: **"+ Add item manually"** creates a blank card with no AI involved.
>
> **Recent foods**: above the textarea, show up to 6 frequency-sorted chips from the last 14 days of `foodLogs` (distinct description + macros, query in `src/lib/db/queries.ts`); tapping one adds a prefilled review card instantly, zero AI call. This is the fastest path for repeated meals.
>
> **Saving**: reuse `logMealBatchAction`; set `source: "ai"` for AI-estimated items and `"manual"` for hand-entered ones (schema already supports both). Loading state while estimating ("Thinking…" with a subtle pulse), and per-item spinners on rethink.
>
> Add `GROQ_API_KEY` to `.env.local` and remind me to add it to Vercel via CLI (Bash tool, `printf '%s' "$v" | npx vercel env add GROQ_API_KEY production` — PowerShell piping silently stores empty strings, see DEPLOY.md). Test end-to-end in the browser preview with: "breakfast: 3 eggs and garlic rice, lunch chicken adobo with 2 cups rice, gatorade after training" — verify multi-item parse, sane macros, rethink with a hint, manual edit protection, portion scaling, and batch save landing in the meal timeline. Lint + build.

---

## Prompt 5 — Final polish pass

> Road to December (this repo) just went through a token pass, desktop grid pass, mobile nav pass, and a new AI quick log. Do a final quality pass, no new features:
>
> 1. **Consistency sweep**: every screen uses the type scale from globals.css (no stray `text-[10px]`), consistent card padding (16/20px), consistent gap rhythm (8pt grid), all interactive elements have hover/focus-visible/active states.
> 2. **Motion**: staggered fade-in for card lists (existing `rtd-fade-in`, 30ms stagger), number tween on the Home countdown and ring values, smooth ring fill animation on load — all gated behind `prefers-reduced-motion`.
> 3. **Accessibility**: aria-labels on all icon-only buttons and progress rings (e.g. "Calories: 1200 of 3400"), alt text, focus order on the quick-log review flow, `aria-live="polite"` on the estimate results.
> 4. **Fuel history**: add a small ‹ today › date stepper on Fuel so previous days' logs are viewable (read-only is fine; queries already take a date).
> 5. **Screenshot audit**: browser preview at 390px and 1280px, every screen, both before/after fixes — call out anything that still looks off rather than silently leaving it.
>
> Lint + build, then remind me to deploy: `npx vercel deploy --prod`.

---

## Notes

- **Why Claude Code, not Claude Design, for the real work**: this app is a live Next.js + Supabase codebase with server actions, auth, and an MCP server. Claude Design builds standalone frontends — it can't edit your data layer. Use it only for Prompt 0 taste exploration.
- **The Apple `.sketch` kits**: the file you downloaded is the *watchOS* kit, and `.sketch` files need Sketch (macOS-only) — it won't open on Windows and wouldn't transfer to a web app anyway. Everything useful from Apple's resources (type scale, dark system colors, materials, spacing) is already encoded in these prompts. If you want a browsable kit, Apple's **Figma** kits on the same page open free in Figma's web app on Windows.
- **SF Pro on non-Apple devices**: the current font stack falls back to Arial on Windows/Android. If you want the SF look everywhere, add **Inter** (free, closest metrics) via `next/font` with `-0.01em` letter-spacing — worth folding into Prompt 1 if it bothers you.
- Your Claude MCP connector (More → Coach AI) is already a second quick-log path — "log adobo and rice for dinner" in the Claude app works today and stays untouched by all of this.
