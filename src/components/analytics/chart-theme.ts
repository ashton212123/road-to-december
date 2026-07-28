export const chartTheme = {
  grid: { stroke: "rgba(255,255,255,0.06)", vertical: false },
  axis: {
    tick: { fill: "rgba(235,235,245,0.45)", fontSize: 11 },
    stroke: "rgba(255,255,255,0.08)",
  },
  tooltip: {
    contentStyle: {
      background: "#1c1c1e",
      border: "0.5px solid rgba(255,255,255,0.1)",
      borderRadius: "var(--rtd-radius-card)",
      fontSize: 11,
      fontFamily: "var(--rtd-font-mono)",
      color: "#F5F5F7",
    },
    labelStyle: { color: "rgba(235,235,245,0.6)", fontFamily: "var(--rtd-font-mono)" },
    itemStyle: { fontFamily: "var(--rtd-font-mono)" },
  },
};

/** V3.1R chart language -- dotted gridlines, no axis/tick lines, capsule
 * bars. Used by the retrofitted detail charts (e1RM, ACWR, bodyweight,
 * sleep) instead of the older solid-tooltip `chartTheme` above. */
export const gridDotted = { stroke: "rgba(255,255,255,0.06)", strokeDasharray: "2 6", vertical: false };
export const axisClean = {
  tick: { fill: "rgba(235,235,245,0.45)", fontSize: 11 },
  axisLine: false,
  tickLine: false,
};

/** `radius = half of barSize` produces a true capsule/stadium bar; pair
 * with the matching `background` fill below for the full-height track. */
export const CAPSULE_BAR_SIZE = 14;
export const CAPSULE_BAR_RADIUS: [number, number, number, number] = [7, 7, 7, 7];
export const barTrack = { fill: "rgba(255,255,255,0.04)", radius: CAPSULE_BAR_RADIUS[0] };

export const PATTERN_COLORS = {
  squat: "#0A84FF",
  hinge: "#30D158",
  press: "#FF9F0A",
  pull: "#BF5AF2",
};
