-- Record each verified Paystack reference once so replaying a callback cannot
-- repeatedly extend a trader's paid access.
create table if not exists public.paystack_payment_receipts (
  reference text primary key check (reference ~ '^gd-[a-f0-9]{32}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('pro', 'elite', 'premium')),
  amount integer not null check (amount > 0),
  currency text not null check (currency = upper(currency)),
  paid_until timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.paystack_payment_receipts enable row level security;
revoke all on table public.paystack_payment_receipts from public, anon, authenticated;
grant select, insert on table public.paystack_payment_receipts to service_role;

create or replace function public.apply_verified_paystack_payment(
  p_reference text,
  p_user_id uuid,
  p_tier text,
  p_amount integer,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt public.paystack_payment_receipts%rowtype;
  inserted boolean;
begin
  if p_tier not in ('pro', 'elite', 'premium') then
    raise exception 'Unsupported paid tier.';
  end if;

  insert into public.paystack_payment_receipts (
    reference, user_id, tier, amount, currency, paid_until
  ) values (
    p_reference, p_user_id, p_tier, p_amount, upper(p_currency), now() + interval '30 days'
  )
  on conflict (reference) do nothing
  returning * into receipt;

  inserted := found;
  if not inserted then
    select * into receipt
    from public.paystack_payment_receipts
    where reference = p_reference;

    if not found
      or receipt.user_id <> p_user_id
      or receipt.tier <> p_tier
      or receipt.amount <> p_amount
      or receipt.currency <> upper(p_currency) then
      raise exception 'Payment reference does not match the verified payment.';
    end if;

    return jsonb_build_object(
      'success', true,
      'tier', receipt.tier,
      'paid_until', receipt.paid_until,
      'already_applied', true
    );
  end if;

  update public.trader_data
  set tier = receipt.tier,
      billing_cycle = 'monthly',
      paid_until = receipt.paid_until
  where user_id = p_user_id;

  if not found then
    raise exception 'Trader account does not exist.';
  end if;

  return jsonb_build_object(
    'success', true,
    'tier', receipt.tier,
    'paid_until', receipt.paid_until,
    'already_applied', false
  );
end;
$$;

revoke all on function public.apply_verified_paystack_payment(text, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.apply_verified_paystack_payment(text, uuid, text, integer, text) to service_role;
