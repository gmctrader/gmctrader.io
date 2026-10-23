import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const plans = { pro: 299, elite: 1199, premium: 1999 } as const;
type Tier = keyof typeof plans;

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'POST required.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return reply({ error: 'Supabase function configuration is incomplete.' }, 500);
  if (!paystackSecret) return reply({ error: 'Paystack is not configured yet. Add the test secret key to Supabase function secrets.' }, 503);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return reply({ error: 'Sign in to continue.' }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user?.id || !user.email) return reply({ error: 'Your session could not be verified. Please sign in again.' }, 401);

  let input: { action?: string; tier?: string; reference?: string };
  try { input = await req.json(); } catch { return reply({ error: 'Invalid request.' }, 400); }

  if (input.action === 'initialize') {
    const tier = input.tier as Tier;
    if (!Object.hasOwn(plans, tier)) return reply({ error: 'Choose a valid package.' }, 400);
    const origin = req.headers.get('origin') || 'https://ghost-discipline.web.app';
    const reference = `gd-${crypto.randomUUID().replaceAll('-', '')}`;
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${paystackSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        amount: String(plans[tier] * 100),
        currency: Deno.env.get('PAYSTACK_CURRENCY') || 'ZAR',
        reference,
        callback_url: `${origin}/app.html?signin=1&payment=success`,
        metadata: { user_id: user.id, tier, product: 'Ghost Discipline' },
      }),
    });
    const result = await response.json();
    if (!response.ok || !result?.status || !result?.data?.authorization_url) {
      console.error('Paystack initialize failed:', result?.message || response.status);
      return reply({ error: 'Paystack could not start checkout. Check the test key and account currency.' }, 502);
    }
    return reply({ authorization_url: result.data.authorization_url });
  }

  if (input.action === 'verify') {
    const reference = String(input.reference || '');
    if (!/^gd-[a-f0-9]{32}$/.test(reference)) return reply({ error: 'Invalid payment reference.' }, 400);
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
    });
    const result = await response.json();
    const payment = result?.data;
    const tier = payment?.metadata?.tier as Tier;
    const expectedAmount = plans[tier] * 100;
    const expectedCurrency = Deno.env.get('PAYSTACK_CURRENCY') || 'ZAR';
    if (!response.ok || !result?.status || payment?.status !== 'success') {
      return reply({ success: false, message: 'Payment is not confirmed yet.' });
    }
    if (payment.reference !== reference || payment.metadata?.user_id !== user.id || !Object.hasOwn(plans, tier) || Number(payment.amount) !== expectedAmount || payment.currency !== expectedCurrency) {
      return reply({ error: 'Payment details did not match this account and package.' }, 403);
    }

    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: applied, error: applyError } = await service.rpc('apply_verified_paystack_payment', {
      p_reference: reference,
      p_user_id: user.id,
      p_tier: tier,
      p_amount: Number(payment.amount),
      p_currency: payment.currency,
    });
    if (applyError || !applied?.success) {
      console.error('Could not apply verified payment:', applyError?.message || 'RPC returned no success result');
      return reply({ error: 'Payment was verified, but access could not be updated. Contact support with your Paystack reference.' }, 500);
    }
    return reply({ success: true, tier: applied.tier, paid_until: applied.paid_until, already_applied: !!applied.already_applied });
  }

  return reply({ error: 'Unsupported action.' }, 400);
});
