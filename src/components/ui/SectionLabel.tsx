import { ReactNode } from "react";
import clsx from "clsx";

export function SectionLabel({
  children,
  right,
  className,
}: {
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center justify-between mb-2", className)}>
      <span className="rtd-micro-label">{children}</span>
      {right}
    </div>
  );
}
