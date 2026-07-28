import type { NextRequest } from "next/server";
import { searchMemory } from "@/lib/memory/search";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { query?: string; limit?: number } | null;
  const query = body?.query?.trim();
  if (!query) {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  const results = await searchMemory(query, body?.limit ?? 20);
  return Response.json({ results });
}
