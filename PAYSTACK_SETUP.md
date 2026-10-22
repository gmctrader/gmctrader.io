# Account and Paystack setup

## What's included

- New users can create free accounts from the terminal sign-in screen.
- Paid prices are in ZAR: Pro R499, Elite R1,199, Premium R1,999 per 30 days. Payments are one-time; users renew manually.
- The admin panel can grant a selected account a paid tier with **Complimentary · no payment**. That grant has no expiry and does not auto-renew.
- The `paystack-checkout` Supabase Edge Function initializes checkout on the server, validates the signed-in account and package, verifies successful Paystack transactions, and applies a 30-day entitlement to that account.

## Enable test mode

1. Deploy the updated static files to Firebase Hosting.
2. Deploy `supabase/functions/paystack-checkout` to the Supabase project already used by the app (`euvfoyxntkqxoydgpqjq`).
3. In Supabase project settings, set the Edge Function secret `PAYSTACK_SECRET_KEY` with the test or live secret key for the selected Paystack mode. Set `PAYSTACK_CURRENCY` to `ZAR`. The function defaults to ZAR, but an existing USD secret overrides that default and must be changed or removed.
4. In Supabase Auth settings, allow public email/password sign-ups and set the site's redirect URL to the deployed `app.html` URL. Decide whether email confirmation should be required.
5. Test a new free account, the complimentary admin grant, and each plan using Paystack test credentials before sharing checkout with users.

Keep the secret key only in Supabase Function secrets. Never add it to HTML, client JavaScript, a ZIP shared publicly, or source control. The public/test key is not needed by this server-hosted checkout flow.

## Live approval

After Paystack approves the account, create/use the separate **live secret key** in the Paystack dashboard and replace the function's `PAYSTACK_SECRET_KEY` secret in Supabase. A test key does not become live when the account is approved. Verify a small real transaction before announcing paid access.

## Billing behavior and requirements

Each successful checkout currently grants 30 days from the time the payment is verified. It does not create a recurring subscription or automatically charge again; the admin can renew an account manually. This keeps the first checkout flow testable without live recurring-plan codes or webhook setup. Paystack requires server-side initialization with a secret key, and recurring billing needs additional subscription plan setup and webhook handling.

The database must already have `trader_data` columns `tier`, `billing_cycle`, and `paid_until`, as used by this app's existing subscription and admin features. The verification function expects a trader row to exist before checkout. Sign-up creates the row when the user first enters the app.

For South African Paystack accounts, use ZAR for transaction currency. International customers can pay by card, with their bank converting the ZAR amount. The app displays ZAR prices and the checkout verifies the same ZAR amount and currency.
