# AI scan fix: what changed and how to deploy

## The bug
The screenshot scan showed "This model is currently experiencing high demand".
That is Google's temporary 503 (UNAVAILABLE) for an overloaded Gemini model.
The old code made ONE request, failed on the first 503, and also spent one of
the user's daily imports before the AI had even answered.

## Client fix (already in gd-trade-import.js, goes live with the normal push)
- Retries with backoff, then falls back: gemini-3.8-flash > 3.7-flash > 3.5-flash
  (Premium starts at gemini-3.1-pro-preview). gemini-3.6-flash is skipped because it retires 2026-11-19.
- A scan is only counted AFTER it succeeds. Failed or overloaded scans cost nothing.
- Images downscaled to 1800px / q0.85, output tokens raised to 8192, JSON mode on.
- sw.js cache bumped to gd-shell-v50 and the script tag to ?v=50 so phones pick it up.

## Server fix (optional but recommended): supabase/functions/ai-proxy
The live ai-proxy was never in this repo, so it could not be reviewed. This is a
drop-in version that matches what the client sends. It keeps the Gemini key in a
secret, allow-lists models, gates the Premium model by tier, and retries/falls
back on Google overloads.

Before deploying, compare with the function currently live in the Supabase
dashboard (Edge Functions > ai-proxy). If the live one has extra logic you
rely on, merge it instead of overwriting.

```
supabase login
supabase link --project-ref euvfoyxntkqxoydgpqjq
supabase secrets set GEMINI_API_KEY=YOUR_NEW_KEY
supabase functions deploy ai-proxy
```

## API key audit (repo + full git history)
- No Gemini / OpenAI / Anthropic / OpenRouter / Paystack / GitHub / service_role keys found.
- The only JWT is the Supabase ANON key (role: anon). That is public by design; safety
  comes from Row Level Security. Make sure RLS is ON for trader_data and the storage bucket.
- SciFe personal keys are stored in localStorage only and stripped before saving to the DB.
- Legacy rows may still hold plaintext keys: see supabase/maintenance/strip_legacy_scife_keys.sql.
- Admin and tier gates are client-side (the code says so). The Premium model is now gated
  server-side in ai-proxy, but free daily limits are still client-enforced.
- If the shared Gemini key was ever pasted into the old front-end, rotate it in Google AI Studio.
