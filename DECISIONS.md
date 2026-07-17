# Decisions log — Phase 2.1 overnight autonomous build

Every judgment call made without asking, per your "don't block on questions" instruction. Review and correct anything you'd have called differently — nothing here is precious.

## ⚠️ Needs your action

- **Canvas access token is rejected by Canvas directly** (confirmed via a raw `curl` against `https://dpp.instructure.com/api/v1/courses` — Canvas itself returns `401 Invalid access token`, not a bug in this app's code). `CANVAS_BASE_URL` is correct and reachable. The School page and `get_school_summary` MCP tool both correctly show "Canvas token expired or invalid" rather than crashing, exactly as designed for this scenario. **You'll need to generate a fresh token**: Canvas → Account → Settings → "+ New Access Token", then tell me the new value and I'll update it in both `.env.local` and Vercel production and redeploy — no other code changes needed.

## Nutrition NL quick-log

- **Food database: USDA FoodData Central**, not Open Food Facts. Open Food Facts is barcode/packaged-product-oriented and would badly under-cover generic home-cooked dishes ("chicken rice", "adobo"); FDC's Foundation/SR Legacy datasets have plain-ingredient entries that fuzzy-match better against short English food names. Neither has good coverage for specific Filipino home-cooked dishes as single entries (there's no USDA entry for "adobo" as a dish) — this is a real limitation, which is exactly why the review step shows top-3 candidates instead of auto-picking one, with a "no match, enter manually" fallback always available.
- **API key: using USDA's public `DEMO_KEY`**, not a personal key — it works immediately with no signup, at a lower rate limit (~30 req/hour/IP vs a real key's much higher limit). I can't sign up for a personal key on your behalf (needs your email). If you hit rate limits, get a free key in ~2 minutes at https://fdc.nal.usda.gov/api-key-signup and set `USDA_FDC_API_KEY` — the code already reads it if present, `DEMO_KEY` is just the fallback.
- **Quantity/serving size isn't parsed** ("2 cups chicken rice" parses as one item "2 cups chicken rice" and gets matched/estimated as if it were a single standard serving). No unit-conversion logic — the review step's editable kcal/protein/carbs/fat fields are the correction path, same one used when USDA has no good match at all.
- **Macro targets for carbs/fat are derived, not sourced from program.md** (only kcal + protein are specified there): ~25% of kcal from fat (standard athletic guidance for hormone health without crowding out training fuel), protein fixed from the existing protein-target formula, remainder to carbs. Adjust `computeCarbsAndFatTargetG` in `src/lib/fuel/targets.ts` if a coach specifies a different split.

## Target times / meet readiness

- **Readiness projection method**: plain least-squares linear regression on logged times for an event vs date, projected forward to the meet date. No paid LLM/ML calls, so this is a simple trend fit, not a real predictive model. Confidence is a heuristic on sample size + R² fit quality (`low`/`medium`/`high`/`none`), not a calibrated probability — labeled as such in the UI.
- **Training load and gym progression are shown as separate supporting context, not blended into the projection number.** There's no principled way to weight swim-time trend vs training load vs gym tonnage into one composite score without real outcome data to calibrate the weights against — a fabricated composite would look precise but wouldn't mean anything. Athlete/coach interprets the three signals together instead.
- **"Current" time on a meet event** defaults to your most recent logged `swimTimes` entry for that event when you add the meet (editable), rather than requiring manual entry.
- Seeded one meet, "NCAA Philippines," dated to the existing `seasonData.meta.targets.ncaaDate`, with the 5 target times you gave me (50 Breast 29.78, 100 Breast 1:05.49, 200 Breast 2:23.95, 200 IM 2:09.96, 400 IM 4:45.13).

## Swim daily logging: sets parsing scope

- "Parse distance/stroke/intervals where possible" — I only parse **total distance** out of free-text sets (matching `<count>x<distance>` patterns like "10x100" and summing them), not stroke or interval structure. Stroke/interval free-text is too varied to parse reliably without real NLP (no paid LLM calls allowed per the constraint), and a wrong guess would silently show incorrect structured data next to your actual notes. The raw text is always kept and shown verbatim; distance is the one number I'm confident enough to extract automatically.

## Swim Page placement

- The goal doc calls this "Swim Page" but doesn't explicitly say "make it a new top-level nav tab." Nav is already at 7 items (Home/Train/Fuel/Analytics/Business/School/More) after Phase 1. I kept swim living inside the existing Analytics → Swim tab rather than promoting it to an 8th top-level tab, and built the hero/logging/target-times additions inside that tab. "Hero section at top" reads fine as "top of the Swim tab's content," not necessarily a standalone route. Easy to split into its own top-level tab later if you'd rather — the components are self-contained.

## Carried over from Phase 1

- Deployed Phase 1 (MCP completion, checkbox gym logging, swim logging, business tracker) to production before starting Phase 2.1.
- Added a training-day streak to Home (Phase 1's Dashboard spec asked for "streaks," which nothing tracked) — see entry below for definition.
