export const ANALYTICS_TABS = ["overview", "train", "fuel", "recovery"] as const;
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number];

export function parseAnalyticsTab(raw: string | undefined): AnalyticsTab {
  return (ANALYTICS_TABS as readonly string[]).includes(raw ?? "") ? (raw as AnalyticsTab) : "overview";
}

/** Where a matrix row's metric deep-links. Swim is a top-level page (not an
 * Analytics tab); bodyweight sits with Fuel — the bulk-window pairing Ashton
 * actually reasons about, weight <-> kcal. */
export function matrixHref(key: string, period: string, offset: number): string {
  if (key.startsWith("swim-")) return "/swim";
  const tab: AnalyticsTab =
    key.startsWith("strength-") || key === "tonnage" || key === "gym-sessions"
      ? "train"
      : key === "bodyweight" || key === "protein-adherence" || key === "kcal-adherence"
        ? "fuel"
        : "recovery";
  return `/analytics?tab=${tab}&period=${period}&offset=${offset}`;
}
