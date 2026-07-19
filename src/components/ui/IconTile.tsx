import { ReactNode } from "react";

export function IconTile({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div
      className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      {children}
    </div>
  );
}
