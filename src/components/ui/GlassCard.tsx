import { ReactNode } from "react";
import clsx from "clsx";

export function GlassCard({
  children,
  className,
  padded = true,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={clsx("rtd-glass", padded && "p-4", className)}>
      {children}
    </Tag>
  );
}
