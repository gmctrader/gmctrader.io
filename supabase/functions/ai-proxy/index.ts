// ai-proxy: server-side Gemini gateway for Ghost Discipline + SciFe.
//
// Why this exists: the shared Gemini key must NEVER ship in browser code. The
// client (app.html, scife.html, gd-trade-import.js) POSTs a Gemini-style body
// here with the user's Supabase JWT; this function adds the key and forwards.
//
// Secrets (set with `supabase secrets set`, never commit them):
//   GEMINI_API_KEY   required
//
// Behaviour:
//   - Requires a valid signed-in Supabase user.
//   - Only allow-listed models. Unknown models fall back to the default.
//   - The Premium model is only honoured for tier = 'premium'.
//   - Google 429/500/503/504 ("high demand") are retried, then the next model
//     in the chain is tried, so one overloaded model no longer kills a request.
//   - The key goes in the x-goog-api-key header (not the URL), and request
//     bodies / keys are never logged.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-ai-model-used',
};

const DEFAULT_MODEL = 'gemini-3.8-flash';
const PREMIUM_MODEL = 'gemini-3.1-pro-preview';
// gemini-3.6-flash is intentionally excluded: it retires on 2026-11-19.
const STANDARD_CHAIN = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'];
const ALLOWED = new Set([...STANDARD_CHAIN, 'gemini-3.5-flash-lite', PREMIUM_MODEL]);

const MAX_BODY_BYTES = 24 * 1024 * 1024;
const PER_CALL_MS = 25_000;
const TOTAL_BUDGET_MS = 55_000;
const TRANSIENT = new Set([429, 500, 502, 503, 504, 529]);

function reply(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', ...extra },
  });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: { message: 'POST required.' } }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!supabaseUrl || !anonKey) return reply({ error: { message: 'Supabase function configuration is incomplete.' } }, 500);
  if (!geminiKey) return reply({ error: { message: 'AI is not configured yet. Set the GEMINI_API_KEY function secret.' } }, 503);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return reply({ error: { message: 'Sign in to continue.' } }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user?.id) return reply({ error: { message: 'Your session could not be verified. Please sign in again.' } }, 401);

  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) return reply({ error: { message: 'Request too large. Use fewer or smaller screenshots.' } }, 413);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: { message: 'Invalid request.' } }, 400); }
  if (!body || typeof body !== 'object' || !Array.isArray((body as { contents?: unknown }).contents)) {
    return reply({ error: { message: 'Invalid request.' } }, 400);
  }

  // Decide the model chain. Premium model is gated on the server, not just the UI.
  let requested = typeof body.model === 'string' ? body.model : DEFAULT_MODEL;
  if (!ALLOWED.has(requested)) requested = DEFAULT_MODEL;
  if (requested === PREMIUM_MODEL) {
    let tier = 'free';
    try {
      const { data } = await userClient.from('trader_data').select('tier').eq('user_id', user.id).maybeSingle();
      tier = String(data?.tier || 'free');
    } catch { /* default to free */ }
    if (tier !== 'premium') requested = DEFAULT_MODEL;
  }
  const chain = [requested, ...STANDARD_CHAIN.filter((m) => m !== requested)];

  const { model: _drop, ...upstreamBody } = body; // Gemini rejects unknown top-level fields
  const payload = JSON.stringify(upstreamBody);
  const started = Date.now();
  let lastStatus = 503;

  for (const model of chain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() - started > TOTAL_BUDGET_MS) break;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PER_CALL_MS);
      try {
        const upstream = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
            body: payload,
            signal: ctrl.signal,
          },
        );
        if (upstream.ok) {
          return new Response(upstream.body, {
            status: 200,
            headers: { ...cors, 'Content-Type': 'application/json', 'x-ai-model-used': model },
          });
        }
        lastStatus = upstream.status;
        if (!TRANSIENT.has(upstream.status)) {
          // A real error (bad request, bad key, safety, wrong model id). Model-id problems
          // move to the next model; everything else is returned as-is.
          const text = await upstream.text();
          if ((upstream.status === 400 || upstream.status === 404) && /model/i.test(text) && !/image|payload|content/i.test(text)) break;
          console.error('ai-proxy upstream error', upstream.status, model);
          return new Response(text, { status: upstream.status, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        await upstream.body?.cancel();
      } catch {
        lastStatus = 504; // timeout / network
      } finally {
        clearTimeout(timer);
      }
      if (attempt === 0) await sleep(800 + Math.floor(Math.random() * 400));
    }
  }

  console.error('ai-proxy exhausted all models, last status', lastStatus);
  return reply({
    error: {
      code: 503,
      status: 'UNAVAILABLE',
      message: 'The AI is overloaded right now. Please try again in a minute.',
    },
  }, 503);
});
