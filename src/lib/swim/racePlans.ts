/**
 * Race-strategy targets transcribed from the athlete's own Obsidian vault
 * research (03 Knowledge/Race Strategy.md) -- static, not derived from any
 * logged data. "Every insight that helps me should become a feature."
 */

export type RacePlan = {
  event: string;
  targetSplits: number[] | null; // seconds per 50, in race order; null when the event isn't tracked at that granularity
  targetLabel: string; // what time the split shape targets
  strategy: string;
};

export const RACE_PLANS: RacePlan[] = [
  {
    event: "200 Breast",
    targetSplits: [32, 35, 36, 37],
    targetLabel: "for 2:20",
    strategy: "Controlled first 50 — the most commonly overspent 50 in the sport. The race is decided in 50s 2 and 3.",
  },
  {
    event: "100 Breast",
    targetSplits: [30.5, 33.5],
    targetLabel: "for sub-1:04",
    strategy: "Fast but controlled first 50; the second 50 is the race — hold rate as length decays. Known issue: back-half fade.",
  },
  {
    event: "50 Breast",
    targetSplits: null,
    targetLabel: "",
    strategy: "The start and pullout are the highest-percentage gains for this event.",
  },
];

export const RACE_SKILL_NOTE = "The 100 rewards stroke rate. The 200 rewards stroke length — near-different skills.";

export const TAPER_NOTE = "Taper: volume −41–60% over 8–14 days, intensity maintained (Bosquet 2007).";
