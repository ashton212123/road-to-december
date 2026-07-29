# MILES OS — UI integration spec

Reference implementation: `Miles OS UI Kit.dc.html` (open in a browser; all four screens work via the top nav).
Copy tokens and component recipes from here; copy exact markup from the reference file.

## Fonts

```
JetBrains Mono   200,300,400,500,700   — everything except display accents
Instrument Serif italic                 — greetings, name accents, weekday words
```

```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@200;300;400;500;700&family=Instrument+Serif:ital@1&display=swap" rel="stylesheet">
```

## Color tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#080808` | page |
| `--bg-nav` | `#0b0b0b` | top bar |
| `--panel` | `#101010` | panel / card surface |
| `--panel-2` | `#141414` | inset field, kanban card, sub-tile |
| `--panel-3` | `#151515` | metric sub-tile |
| `--chip` | `#1e1e1d` | active pill / avatar chip |
| `--border` | `rgba(255,255,255,.055)` | panel border |
| `--border-row` | `rgba(255,255,255,.04)` | row divider |
| `--border-field` | `rgba(255,255,255,.05)` | inset field border |
| `--fg` | `#e6e6e2` | primary text |
| `--fg-strong` | `#f2f2ee` | display figures |
| `--fg-2` | `#c8c8c4` | body text |
| `--fg-3` | `#8a8a86` | secondary |
| `--fg-dim` | `#4e4e4c` | section labels |
| `--fg-dimmer` | `#3f3f3d` | meta |
| `--rule` | `#333331` | the `//` separator glyph |
| `--green` | `#4fd18b` | positive, online, focus |
| `--green-line` | `#3ee0a4` | chart stroke |
| `--green-fill` | `rgba(45,212,168,.28) → 0` | chart area gradient |
| `--red` | `#ff8578` (line `#e0655a`) | HOT, liabilities |
| `--amber` | `#d9ab6b` | WARM, cutoff |
| `--blue` | `#8ec5f0` | primary action, COOL |

Status chip pattern (bg / border / text):

```
HOT   rgba(255,107,94,.09)  rgba(255,107,94,.26)  #ff8578
WARM  rgba(212,160,95,.09)  rgba(212,160,95,.26)  #d9ab6b
COOL  rgba(110,168,216,.09) rgba(110,168,216,.26) #7fb4e0
```

## Type scale

| Role | Spec |
|---|---|
| Section label | `500 8.5px/1`, `letter-spacing:.16em`, uppercase, `--fg-dim` |
| Micro label | `500 8px/1`, `.15em`, `--fg-dimmer` |
| Meta / counts | `400 8–8.5px/1`, `.11em` |
| Row title | `400 10.5–11px/1.3` |
| Body in field | `400 10.5px/1.6` |
| Metric small | `300 13–17px/1` |
| Metric large | `200 25–33px/1`, `letter-spacing:-.02em` |
| Serif display | Instrument Serif italic, 23–26px |

Rule: **all uppercase mono text is letterspaced** (`.10em`–`.20em`). Never letterspace body text.

## Geometry

- Panel radius `6px`; inset field / sub-tile radius `5px`; chip & badge radius `3px`; button radius `4–5px`
- Panel padding `11px 13px 14px` (narrow column) / `11px 15px 15px` (wide column)
- Grid gap `13–14px`; internal stacks `9–11px`
- Top bar height `34px`, sticky
- Row dividers, not row backgrounds, separate list items
- Section header = label on the left, meta on the right, sometimes a `1px` hairline filling the space between

## Screen layouts

**Home** — `grid-template-columns: 262px minmax(0,1fr) 262px`, gap 14, `align-items:start`.
Left: Operator (01), Finance Pulse (07), Key Blockers (08). Center: Session (02), Habits (03), Calendar (04). Right: Nutrition (06).

**CRM** — filter bar panel, then board panel with a `KANBAN | LIST` toggle right-aligned and 4 equal columns (`OVERDUE / TODAY / THIS WEEK / LATER`), each with a dot + name + count header over a hairline, cards stacked at gap 10.

**Finance** — KPI row `1.55fr 1fr 1fr 1fr` (net worth w/ area chart, runway, income, burn); bucket row of 3 equal cards (chart + 2×2 sub-metrics); snapshot table with a 6-col grid `1.1fr 1fr 1fr 1fr 1fr 1fr`, first col left-aligned, all others right-aligned.

**Review** — max width 1280. Header panel (`WEEKLY REVIEW · W17`, serif date range, `✓ SEAL WEEK`), a 2-col grid of 6 labelled text blocks, then a full-width `NEXT WEEK — TOP 3` block.

## Component recipes

**Section header**
```html
<div style="font:500 8.5px/1 'JetBrains Mono',monospace;letter-spacing:.16em;color:#4e4e4c">
  01 <span style="color:#333331">//</span> OPERATOR
</div>
```

**Status badge**
```html
<span style="padding:2px 6px;border-radius:3px;font:500 8px/1.4 'JetBrains Mono',monospace;
letter-spacing:.11em;background:rgba(255,107,94,.09);border:1px solid rgba(255,107,94,.26);color:#ff8578">HOT</span>
```

**Inset field**
```html
<div style="background:#141414;border:1px solid rgba(255,255,255,.05);border-radius:5px;padding:9px 11px">…</div>
```

**Primary button** — `border:1px solid rgba(122,184,232,.22); background:rgba(122,184,232,.10); color:#8ec5f0; font:500 8.5px/1 mono; letter-spacing:.12em`

**Sparkline** — inline SVG, `preserveAspectRatio="none"`, `stroke-width:1.2`, optional area path with a vertical gradient at 26–30% top opacity. Rising = `#3ee0a4`, falling/liability = `#e0655a`.

**Live dot** — 4–5px circle in `--green`, `animation: msPulse 2.6s ease-in-out infinite` (opacity 1 → .35 → 1).

## Content conventions

- Unfilled data renders as a bracketed placeholder: `[FIRST]`, `[NET WORTH]`, `$[—]`, `[TAG]`, `+X.XX%` — not zeros or lorem
- Numeric placeholders keep their unit and sign: `$[DAY]`, `[—]% OF NET`
- Panels are numbered (`01 //`, `#4 //`) and the numbering is not necessarily contiguous per screen
- Copy is terse, lowercase-sentence, no exclamation: "Start with one.", "Set today's one thing…"
