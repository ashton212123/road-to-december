/**
 * Optional Strava export (V4 P4) -- entirely feature-flagged by env vars.
 * With no STRAVA_* vars set, isStravaConfigured() is false and nothing in
 * the UI ever renders or nags about it. Manual-activity creation only
 * (no GPS/file upload) since imported sessions have no track data.
 */

const TOKEN_URL = "https://www.strava.com/oauth/token";
const ACTIVITIES_URL = "https://www.strava.com/api/v3/activities";

export function isStravaConfigured(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET && process.env.STRAVA_REFRESH_TOKEN);
}

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/** Creates a manual (no GPS) Strava activity. Returns the activity id on
 * success, null on any failure -- callers show a plain "couldn't send"
 * state rather than throwing, this is a nice-to-have, not core logging. */
export async function sendManualActivityToStrava(input: {
  name: string;
  type: "Swim" | "WeightTraining";
  description: string;
  startDateLocalISO: string; // e.g. "2026-07-20T07:00:00"
  elapsedSeconds: number;
}): Promise<number | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  try {
    const res = await fetch(ACTIVITIES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: input.name,
        type: input.type,
        sport_type: input.type,
        start_date_local: input.startDateLocalISO,
        elapsed_time: input.elapsedSeconds,
        description: input.description,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: number };
    return data.id ?? null;
  } catch {
    return null;
  }
}
