import { ZONES, type Zone, type ZoneDistance } from "@/lib/swim/zones";

export const ZONE_ORDER: Zone[] = ["REC", "EN1", "EN2", "EN3", "SP1", "SP2", "SP3", "TECH"];

/** One session (or one week)'s metres, as a single bar of zone-colored
 * segments proportional to share of total -- the at-a-glance "what was this"
 * visual, reused on the session detail page, the sessions-history week
 * headers, and the Log page's 8-week trend. */
export function ZoneDistributionBar({ zoneDistance, totalM, height = 10 }: { zoneDistance: ZoneDistance; totalM: number; height?: number }) {
  if (totalM <= 0) {
    return <div className="rounded-full bg-white/[0.06]" style={{ height }} />;
  }
  return (
    <div className="flex rounded-full overflow-hidden bg-white/[0.06]" style={{ height }}>
      {ZONE_ORDER.filter((z) => (zoneDistance[z] ?? 0) > 0).map((z) => (
        <div
          key={z}
          style={{ width: `${((zoneDistance[z] ?? 0) / totalM) * 100}%`, backgroundColor: ZONES[z].color }}
          title={`${ZONES[z].label}: ${Math.round(zoneDistance[z] ?? 0)}m`}
        />
      ))}
    </div>
  );
}
