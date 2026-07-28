import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rawCaptures } from "@/lib/db/schema";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { runCapturePipeline } from "@/lib/capture/pipeline";

export const maxDuration = 60;

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

/** Session cookie (normal browser calls from the capture bar) or an
 * x-api-secret header checked against MCP_BEARER_TOKEN (reusing the same
 * secret the MCP server already uses for non-interactive callers, rather
 * than inventing a second undocumented one). */
async function isAuthed(req: NextRequest): Promise<boolean> {
  const apiSecret = req.headers.get("x-api-secret");
  const expectedSecret = process.env.MCP_BEARER_TOKEN;
  if (apiSecret && expectedSecret && timingSafeStringEqual(apiSecret, expectedSecret)) return true;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token && (await verifySessionToken(token))) return true;

  return false;
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed(req))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  const [inserted] = await db.insert(rawCaptures).values({ source: "web", rawText: text, status: "pending" }).returning();

  try {
    const result = await runCapturePipeline({ captureId: inserted.id, text, source: "web" });
    return Response.json({
      captureId: inserted.id,
      status: result.status,
      routedTo: result.routedTo,
      routedIds: result.routedIds,
      errors: result.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(rawCaptures).set({ status: "failed", error: message }).where(eq(rawCaptures.id, inserted.id));
    return Response.json({ error: "processing failed", captureId: inserted.id }, { status: 500 });
  }
}
