/**
 * The AI proposes a zone per interval; the session's TYPE is then computed
 * deterministically here, never by the model, so the same session always
 * classifies the same way and the athlete can audit it. Precedence and
 * thresholds are [coaching convention], tuned to this athlete's 9-swims-a-
 * week schedule, not measured cut-points.
 */

import type { Zone, ZoneDistance } from "./zones";

export type SessionType = "speed" | "race_pace" | "vo2" | "threshold" | "aerobic" | "recovery" | "technique" | "mixed";

export type SessionSupport =
  | "breaststroke-sprint"
  | "breaststroke-middle"
  | "400IM-aerobic"
  | "400IM-fatigue-resistance"
  | "recovery";

export type SessionClassification = {
  type: SessionType;
  label: string;
  why: string;
  qualityM: number;
  totalM: number;
  zoneDistance: ZoneDistance;
  supports: SessionSupport[];
};

// [coaching convention] -- precedence thresholds, as percentages of totalM.
const THRESHOLDS = {
  SPEED_PCT: 0.12, // SP2+SP3
  RACE_PACE_PCT: 0.18, // SP1
  VO2_PCT: 0.18, // EN3
  THRESHOLD_PCT: 0.22, // EN2
  TECH_PCT: 0.4, // TECH
  RECOVERY_PCT: 0.6, // REC
  RECOVERY_MAX_M: 3000,
  AEROBIC_PCT: 0.5, // EN1
};

const TYPE_LABELS: Record<SessionType, string> = {
  speed: "Speed session",
  race_pace: "Race-pace session",
  vo2: "VO2 session",
  threshold: "Threshold session",
  aerobic: "Aerobic session",
  recovery: "Recovery session",
  technique: "Technique session",
  mixed: "Mixed session",
};

function metres(zoneDistance: ZoneDistance, zone: Zone): number {
  return zoneDistance[zone] ?? 0;
}

function share(part: number, totalM: number): number {
  return totalM > 0 ? part / totalM : 0;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function buildWhy(type: SessionType, zoneDistance: ZoneDistance, totalM: number): string {
  if (totalM <= 0) return "No distance logged for this session yet.";

  if (type === "speed") {
    const spM = metres(zoneDistance, "SP2") + metres(zoneDistance, "SP3");
    const p = Math.round(share(spM, totalM) * 100);
    return `${fmt(spM)}m of ${fmt(totalM)}m (${p}%) at SP2/SP3 — the largest quality block.`;
  }
  if (type === "mixed") {
    return `${fmt(totalM)}m spread across zones with no single zone dominant — a genuinely mixed session.`;
  }

  const zoneForType: Partial<Record<SessionType, Zone>> = {
    race_pace: "SP1",
    vo2: "EN3",
    threshold: "EN2",
    technique: "TECH",
    recovery: "REC",
    aerobic: "EN1",
  };
  const zone = zoneForType[type];
  if (!zone) return `${fmt(totalM)}m logged.`;
  const zm = metres(zoneDistance, zone);
  const p = Math.round(share(zm, totalM) * 100);
  return `${fmt(zm)}m of ${fmt(totalM)}m (${p}%) at ${zone} — the largest quality block.`;
}

function supportsFor(type: SessionType): SessionSupport[] {
  const supports = new Set<SessionSupport>();
  // "speed" always supports breaststroke-sprint. The plan's race_pace ->
  // breaststroke-sprint qualifier (breast volume >= 40% of quality) needs
  // stroke-distance data this function doesn't receive -- see
  // strokeDistanceM at the call site for that finer-grained check instead.
  if (type === "speed") supports.add("breaststroke-sprint");
  if (type === "race_pace" || type === "threshold") supports.add("breaststroke-middle");
  if (type === "aerobic" || type === "threshold" || type === "vo2") supports.add("400IM-aerobic");
  if (type === "race_pace" || type === "vo2") supports.add("400IM-fatigue-resistance");
  if (type === "recovery") supports.add("recovery");
  return [...supports];
}

export function classifySession(zoneDistance: ZoneDistance, totalM: number): SessionClassification {
  const spQuality = metres(zoneDistance, "SP2") + metres(zoneDistance, "SP3");
  const sp1 = metres(zoneDistance, "SP1");
  const en3 = metres(zoneDistance, "EN3");
  const en2 = metres(zoneDistance, "EN2");
  const tech = metres(zoneDistance, "TECH");
  const rec = metres(zoneDistance, "REC");
  const en1 = metres(zoneDistance, "EN1");

  let type: SessionType;
  if (share(spQuality, totalM) >= THRESHOLDS.SPEED_PCT) type = "speed";
  else if (share(sp1, totalM) >= THRESHOLDS.RACE_PACE_PCT) type = "race_pace";
  else if (share(en3, totalM) >= THRESHOLDS.VO2_PCT) type = "vo2";
  else if (share(en2, totalM) >= THRESHOLDS.THRESHOLD_PCT) type = "threshold";
  else if (share(tech, totalM) >= THRESHOLDS.TECH_PCT) type = "technique";
  else if (share(rec, totalM) >= THRESHOLDS.RECOVERY_PCT && totalM < THRESHOLDS.RECOVERY_MAX_M) type = "recovery";
  else if (share(en1, totalM) >= THRESHOLDS.AEROBIC_PCT) type = "aerobic";
  else type = "mixed";

  const qualityM = en2 + en3 + sp1 + spQuality;

  return {
    type,
    label: TYPE_LABELS[type],
    why: buildWhy(type, zoneDistance, totalM),
    qualityM,
    totalM,
    zoneDistance,
    supports: supportsFor(type),
  };
}
