/**
 * Deterministic keyword classification of a gym exercise's transfer target
 * to swimming (E7/E8) -- makes the app answer "why does this session matter
 * for my events" for the gym side of training, not just swim sessions.
 */

export type TransferTarget =
  | "start-and-breakout"
  | "turn-and-pushoff"
  | "pullout-force"
  | "stroke-force"
  | "trunk-stiffness"
  | "general-base";

const WHY: Record<TransferTarget, string> = {
  "start-and-breakout":
    "Lower-body triple extension trains the same force production that drives the dive and the breakout kick [moderate].",
  "turn-and-pushoff":
    "Plyometrics 2–4×/wk over 6–10 weeks improve turn performance [moderate — IJERPH 2021 dryland-and-turns review] — this loads the wall-contact and push-off pattern directly.",
  "pullout-force":
    "Vertical pulling loads the same chain that drives the breaststroke pullout — the highest-leverage 3 metres of your 50 and 100 [moderate].",
  "stroke-force": "Horizontal pressing trains the same force pattern as the breaststroke arm pull [moderate].",
  "trunk-stiffness":
    "Anti-rotation/anti-extension core work builds the trunk stiffness that transfers force from kick to pull without leaking through the midline [moderate].",
  "general-base": "General strength base — supports overall force capacity without a specific stroke-mechanical transfer claim.",
};

const RULES: { keywords: string[]; target: TransferTarget }[] = [
  { keywords: ["box jump", "broad jump", "plyo"], target: "turn-and-pushoff" },
  { keywords: ["squat", "trap bar", "trap-bar", "jump"], target: "start-and-breakout" },
  { keywords: ["chin-up", "chin up", "pulldown", "row"], target: "pullout-force" },
  { keywords: ["press", "fly", "pullover"], target: "stroke-force" },
  { keywords: ["hollow", "plank", "pallof", "dead bug"], target: "trunk-stiffness" },
];

export function classifyTransfer(
  exerciseName: string,
  movementPattern: string | null,
  isExplosive: boolean
): { target: TransferTarget; why: string } {
  const haystack = `${exerciseName} ${movementPattern ?? ""}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => haystack.includes(k))) {
      return { target: rule.target, why: WHY[rule.target] };
    }
  }
  // No keyword matched, but explosive-intent movements not named above
  // (med-ball throws, etc.) still carry a power-transfer claim rather than
  // falling through to the generic base-strength copy.
  if (isExplosive) return { target: "turn-and-pushoff", why: WHY["turn-and-pushoff"] };
  return { target: "general-base", why: WHY["general-base"] };
}
