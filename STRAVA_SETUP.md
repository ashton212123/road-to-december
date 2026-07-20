# Optional: Strava export

Entirely optional. With none of the three env vars below set, the "Send to
Strava" button on the import-session confirmation simply never renders —
no errors, no nags, nothing else in the app changes.

This only supports **manual activity creation** (name, type, description,
duration) — imported sessions have no GPS/track data, so there's nothing
to upload as a `.fit`/`.gpx` file.

## 1. Register a Strava API application

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api)
   and create an application (any name/website/callback URL — for a
   single-user integration these don't matter beyond passing validation;
   `http://localhost` works fine as the Authorization Callback Domain).
2. Note the **Client ID** and **Client Secret** shown on that page.

## 2. Get a refresh token

Strava's OAuth requires a one-time browser authorization to mint a refresh
token scoped to `activity:write`. With `CLIENT_ID` from step 1:

1. Visit this URL (replace `CLIENT_ID`), then authorize:
   ```
   https://www.strava.com/oauth/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=http://localhost&approval_prompt=force&scope=activity:write
   ```
2. After authorizing, Strava redirects to `http://localhost/?state=&code=AUTHORIZATION_CODE&scope=activity:write` —
   the page itself will fail to load (nothing's listening on localhost),
   that's expected. Copy the `code` value out of the URL bar.
3. Exchange it for tokens:
   ```bash
   curl -X POST https://www.strava.com/oauth/token \
     -d client_id=CLIENT_ID \
     -d client_secret=CLIENT_SECRET \
     -d code=AUTHORIZATION_CODE \
     -d grant_type=authorization_code
   ```
4. The response includes `refresh_token` — that's the long-lived value
   this app needs. (Strava's `access_token`s expire in ~6 hours; the app
   always exchanges the refresh token for a fresh one per request rather
   than storing an access token, so there's nothing to renew manually.)

## 3. Set the env vars

Locally, add to `.env.local`:

```
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
STRAVA_REFRESH_TOKEN=...
```

On Vercel, same three variables via the CLI (matches DEPLOY.md's pattern —
use `printf`, never a PowerShell pipe, so no trailing newline sneaks into
the secret):

```bash
printf '%s' 'your-client-id' | npx vercel env add STRAVA_CLIENT_ID production
printf '%s' 'your-client-secret' | npx vercel env add STRAVA_CLIENT_SECRET production
printf '%s' 'your-refresh-token' | npx vercel env add STRAVA_REFRESH_TOKEN production
```

Redeploy after adding them (`npx vercel deploy --prod`) — Vercel only picks
up new env vars on the next build.

## 4. Verify

Import a session (Train's today header, or Home's Today's Plan card),
confirm & save it, and the post-save confirmation should now show a "Send
to Strava" button. If it doesn't appear, double-check all three vars are
set in the environment you're testing against (`.env.local` for `npm run
dev`, Vercel's dashboard for production).
