/**
 * The 7-zone (+ technique) energy classification framework this app uses to
 * describe what a swim session actually trained. Zone boundaries are a
 * coaching convention (EVIDENCE.E12), not measured physiological
 * thresholds -- tuned to this athlete's 9-swims-a-week schedule.
 */

import type { SwimSessionInterval } from "@/lib/db/schema";

export type Zone = "REC" | "EN1" | "EN2" | "EN3" | "SP1" | "SP2" | "SP3" | "TECH";

export type ZoneMeta = {
  zone: Zone;
  label: string;
  purpose: string;
  whenToUse: string;
  whenNotToUse: string;
  color: string;
};

export type ZoneDistance = Partial<Record<Zone, number>>;

export const ZONES: Record<Zone, ZoneMeta> = Object.freeze({
  REC: {
    zone: "REC",
    label: "Recovery",
    purpose: "Blood flow without added metabolic stress; clears the previous session rather than adding to it",
    whenToUse: "Day after a hard SP session; between Sat's double",
    whenNotToUse: "When you haven't done enough hard work to need recovering from",
    color: "var(--rtd-green)",
  },
  EN1: {
    zone: "EN1",
    label: "Aerobic base",
    purpose:
      "Builds capillary density, mitochondrial volume and stroke economy at sustainable cost — the aerobic floor the 400 IM sits on",
    whenToUse: "The bulk of weekly volume, especially Jul–Sep",
    whenNotToUse: "As a substitute for quality when a race-pace session was planned",
    color: "var(--rtd-cyan)",
  },
  EN2: {
    zone: "EN2",
    label: "Threshold",
    purpose: "Trains at/near maximal lactate steady state — raises the pace you can hold before lactate accumulates",
    whenToUse: "1–2×/week; the highest-yield aerobic work for the 400 IM",
    whenNotToUse: "Twice in one day, or the day before a race-pace session",
    color: "var(--rtd-blue)",
  },
  EN3: {
    zone: "EN3",
    label: "VO2 / overload",
    purpose: "Maximal aerobic power; short rest, high oxygen demand",
    whenToUse: "Sep–Oct build; 1×/week max",
    whenNotToUse: "During taper, or when readiness is red",
    color: "var(--rtd-teal)",
  },
  SP1: {
    zone: "SP1",
    label: "Race pace",
    purpose: "Rehearses the exact velocity and stroke rate you intend to race, under accumulating fatigue",
    whenToUse: "Wed/Fri AM race-pace sessions; the core of Oct–Nov",
    whenNotToUse: 'On tired legs — a slow "race-pace" set rehearses the wrong pace',
    color: "var(--rtd-lilac)",
  },
  SP2: {
    zone: "SP2",
    label: "Lactate power",
    purpose: "Maximal 25–75 m efforts; trains peak power and lactate production",
    whenToUse: "1–2×/week in speed blocks",
    whenNotToUse: "In volume blocks with no recovery built around it",
    color: "var(--rtd-purple)",
  },
  SP3: {
    zone: "SP3",
    label: "Alactic speed",
    purpose: "≤15 m bursts, starts, breakouts, turns — creatine-phosphate system, full recovery between reps",
    whenToUse: "Year-round, small doses, always fresh",
    whenNotToUse: "Ever, when fatigued — fatigued speed work trains slow speed",
    color: "var(--rtd-red)",
  },
  TECH: {
    zone: "TECH",
    label: "Technique / drill",
    purpose: "Motor pattern work at low metabolic cost",
    whenToUse: "Every session, especially before quality",
    whenNotToUse: "As the only content of a session that was supposed to build fitness",
    color: "var(--rtd-butter)",
  },
});

function normalizeStroke(raw: string): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (s.startsWith("br") || s === "breast" || s === "breaststroke") return "breast";
  if (s.startsWith("fr") || s === "free" || s === "freestyle") return "freestyle";
  if (s.startsWith("bk") || s === "back" || s === "backstroke") return "backstroke";
  if (s.startsWith("fl") || s === "fly" || s === "butterfly") return "butterfly";
  if (s === "im" || s === "medley") return "im";
  return s;
}

function isKickInterval(iv: SwimSessionInterval): boolean {
  const note = (iv.note ?? "").toLowerCase();
  const stroke = (iv.stroke ?? "").toLowerCase();
  return note.includes("kick") || stroke.includes("kick");
}

/** Breaststroke-kick metres in a session -- the injury-relevant number
 * (EVIDENCE.E4). Full kick sets count at full weight; whole-stroke
 * breaststroke sets count at 0.5x weight, since the kick is roughly half of
 * a breaststroke cycle [coaching convention] -- a modelling assumption, not
 * a measurement. */
export function breastKickMetres(intervals: SwimSessionInterval[]): number {
  let total = 0;
  for (const iv of intervals) {
    if (normalizeStroke(iv.stroke) !== "breast") continue;
    const metres = iv.reps * iv.distanceM;
    total += isKickInterval(iv) ? metres : metres * 0.5;
  }
  return Math.round(total);
}
