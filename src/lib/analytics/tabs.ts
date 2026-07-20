export const ANALYTICS_TABS = ["overview", "train", "swim", "fuel", "recovery"] as const;
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number];

export function parseAnalyticsTab(raw: string | undefined): AnalyticsTab {
  return (ANALYTICS_TABS as readonly string[]).includes(raw ?? "") ? (raw as AnalyticsTab) : "overview";
}

/** Which tab a matrix row's metric lives on (bodyweight sits with Fuel — it's
 * the bulk-window pairing Ashton actually reasons about, weight <-> kcal). */
export function tabForMatrixKey(key: string): AnalyticsTab {
  if (key.startsWith("strength-") || key === "tonnage" || key === "gym-sessions") return "train";
  if (key.startsWith("swim-")) return "swim";
  if (key === "bodyweight" || key === "protein-adherence" || key === "kcal-adherence") return "fuel";
  return "recovery";
}
