import { CSSProperties, ReactNode } from "react";
import clsx from "clsx";

export function GlassCard({
  children,
  className,
  padded = true,
  as: Tag = "div",
  style,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: "div" | "section" | "article";
  style?: CSSProperties;
}) {
  return (
    <Tag className={clsx("rtd-glass", padded && "p-4", className)} style={style}>
      {children}
    </Tag>
  );
}
