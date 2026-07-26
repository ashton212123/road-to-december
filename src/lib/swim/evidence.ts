/**
 * Canonical evidence table for every science claim this app makes about
 * swimming/training/nutrition. Every user-facing scientific string pulls its
 * strength label from here so copy never drifts from what was actually
 * cited when it was written.
 */

export type EvidenceStrength = "strong" | "moderate" | "coaching convention" | "extrapolated";

export type EvidenceNote = {
  id: string;
  claim: string;
  strength: EvidenceStrength;
  source: string;
  caveat?: string;
};

export const EVIDENCE: Record<string, EvidenceNote> = Object.freeze({
  E1: {
    id: "E1",
    claim: "Taper: reduce volume 41–60% over 8–14 days, hold intensity and frequency",
    strength: "strong",
    source: "Bosquet et al. 2007, MSSE",
  },
  E2: {
    id: "E2",
    claim: "Over a 100 BR, clean speed falls via loss of stroke length; stroke rate is preserved",
    strength: "moderate",
    source: "Coventry thesis; Sports Med Open 2022 systematic review",
  },
  E3: {
    id: "E3",
    claim: "Breaststroke has the highest intra-cyclic velocity variation and lowest mean velocity of the four strokes",
    strength: "strong",
    source: "Sports Med Open 2022 systematic review",
  },
  E4: {
    id: "E4",
    claim: "Breaststroker's knee affects 73–86% of specialists; risk tracks breaststroke-kick volume and exposure years",
    strength: "moderate",
    source: "Breaststroker's knee epidemiology; Mayo Clin Proc swimming injuries",
  },
  E5: {
    id: "E5",
    claim: "ACWR has mathematical coupling, no demonstrated causal link to injury, poor standalone prediction",
    strength: "strong",
    source: "Impellizzeri et al. 2020, IJSPP 15(6):907",
  },
  E6: {
    id: "E6",
    claim: "Critical swim speed approximates MLSS and is a usable threshold anchor",
    strength: "moderate",
    source: "Wakayoshi et al. 1992/1993",
    caveat: "Validated in front crawl only; breaststroke application is extrapolated.",
  },
  E7: {
    id: "E7",
    claim: "Combined dryland + in-water beats either alone for 25/50/100 m, stroke rate and stroke length",
    strength: "moderate",
    source: "Front Physiol 2025 two-tier NMA",
  },
  E8: {
    id: "E8",
    claim: "Plyometrics 2–4×/wk, 20–25 min, 6–10 wks improves turn performance",
    strength: "moderate",
    source: "IJERPH 2021 dryland-and-turns review",
  },
  E9: {
    id: "E9",
    claim: "Carbohydrate 5–12 g/kg/day; 8–10 g/kg for >12 h/wk moderate-to-high training",
    strength: "strong",
    source: "IOC / contemporary CHO reviews",
  },
  E10: {
    id: "E10",
    claim: "Protein 1.2–2.1 g/kg/d for athletes; youth ~1.5 g/kg; distribute ~0.3 g/kg × 4–5 feedings",
    strength: "strong",
    source: "IOC consensus; youth-athlete nutrition reviews",
  },
  E11: {
    id: "E11",
    claim: "SCM→LCM conversion is event- and stroke-specific and is an estimate, not a measurement",
    strength: "coaching convention",
    source: "Standard federation conversion tables",
  },
  E12: {
    id: "E12",
    claim: "7-zone energy classification (REC/EN1–3/SP1–3) is a coaching framework; boundaries are conventions, not measured thresholds",
    strength: "coaching convention",
    source: "USA Swimming energy zones",
  },
  E13: {
    id: "E13",
    claim: "For maximal efforts of ~4–5 min, aerobic contribution is roughly 75–85%",
    strength: "moderate",
    source: "AOD literature on comparable-duration efforts",
    caveat: "Extrapolated to the 400 IM specifically.",
  },
});

/** e.g. "[strong] Bosquet 2007, MSSE" -- the label every UI string carrying a
 * scientific claim must render adjacent to that claim. */
export function evidenceLabel(id: string): string {
  const note = EVIDENCE[id];
  if (!note) return "";
  return `[${note.strength}] ${note.source}`;
}
