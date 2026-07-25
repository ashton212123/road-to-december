/**
 * Templates remount on every navigation within this route group (unlike
 * layout.tsx, which persists) -- that's what makes a CSS entry animation
 * fire on every page change instead of only on first load. Replaces every
 * page's own hand-rolled rtd-fade-in root wrapper (removed page-by-page to
 * avoid double-animating with this).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="rtd-page-enter">{children}</div>;
}
