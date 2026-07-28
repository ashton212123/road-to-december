import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

// Paths that must stay reachable without a session: the login page/action,
// the MCP endpoint (guarded separately by its own bearer token), the
// capture pipeline's two entry points (Telegram can't present a session
// cookie at all; both are guarded by their own secret inside the route --
// see api/telegram/webhook and api/capture), the Vercel cron entry point
// (same story -- cron calls carry a CRON_SECRET bearer token, never a
// session cookie, checked inside api/cron/journal-rollup itself), and the
// PWA/static assets so the install prompt and offline shell keep working
// even when the session cookie has expired.
const PUBLIC_PATHS = [
  "/login",
  "/api/mcp",
  "/api/telegram/webhook",
  "/api/capture",
  "/api/cron/journal-rollup",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname === "/icon.png") return true;
  if (pathname.startsWith("/_next/")) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authed = token ? await verifySessionToken(token) : false;

  if (!authed) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
