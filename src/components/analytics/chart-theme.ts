// WS3d §2: hairline mono chart language -- axes/grid/tooltips restyled onto
// the existing Miles OS tokens (--rtd-mos-* panel/fg scale, --rtd-border/
// --rtd-mos-border-row for hairlines) rather than the hardcoded hex/rgba
// values this file used before. Recharts still renders its own chart types
// unchanged (spec: "charts keep recharts"), only their color/font inputs
// route through tokens now.
export const chartTheme = {
  grid: { stroke: "var(--rtd-mos-border-row)", vertical: false },
  axis: {
    tick: { fill: "var(--rtd-mos-fg-3)", fontSize: 11, fontFamily: "var(--rtd-font-mono)" },
    stroke: "var(--rtd-border)",
  },
  tooltip: {
    contentStyle: {
      background: "var(--rtd-mos-panel-2)",
      border: "0.5px solid var(--rtd-border)",
      borderRadius: "var(--rtd-radius-card)",
      fontSize: 11,
      fontFamily: "var(--rtd-font-mono)",
      color: "var(--rtd-mos-fg-strong)",
    },
    labelStyle: { color: "var(--rtd-mos-fg-2)", fontFamily: "var(--rtd-font-mono)" },
    itemStyle: { fontFamily: "var(--rtd-font-mono)" },
  },
};

/** V3.1R chart language -- dotted gridlines, no axis/tick lines, capsule
 * bars. Used by the retrofitted detail charts (e1RM, ACWR, bodyweight,
 * sleep) instead of the older solid-tooltip `chartTheme` above. */
export const gridDotted = { stroke: "var(--rtd-mos-border-row)", strokeDasharray: "2 6", vertical: false };
export const axisClean = {
  tick: { fill: "var(--rtd-mos-fg-3)", fontSize: 11, fontFamily: "var(--rtd-font-mono)" },
  axisLine: false,
  tickLine: false,
};

/** `radius = half of barSize` produces a true capsule/stadium bar; pair
 * with the matching `background` fill below for the full-height track. */
export const CAPSULE_BAR_SIZE = 14;
export const CAPSULE_BAR_RADIUS: [number, number, number, number] = [7, 7, 7, 7];
export const barTrack = { fill: "var(--rtd-mos-border-field)", radius: CAPSULE_BAR_RADIUS[0] };

export const PATTERN_COLORS = {
  squat: "var(--rtd-blue)",
  hinge: "var(--rtd-green)",
  press: "var(--rtd-orange)",
  pull: "var(--rtd-purple)",
};
