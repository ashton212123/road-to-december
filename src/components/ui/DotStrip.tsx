export type DotStatus = "improved" | "declined" | "flat";

const DOT_COLOR: Record<DotStatus, string> = {
  improved: "var(--rtd-green)",
  declined: "var(--rtd-red)",
  flat: "rgba(255,255,255,0.16)",
};

export function DotStrip({ periods }: { periods: { status: DotStatus; label: string }[] }) {
  return (
    <div className="flex items-center gap-1">
      {periods.map((p, i) => (
        <div
          key={i}
          title={p.label}
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: DOT_COLOR[p.status] }}
        />
      ))}
    </div>
  );
}
