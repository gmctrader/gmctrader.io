# Private trade screenshot storage setup

The app now stores a screenshot object path in each trade and requests a short-lived signed URL when it needs to display the image. The bucket must be private and the migration must be applied before this frontend change is deployed.

## Apply

1. Confirm the Supabase project is the one used by this deployment.
2. Review existing policies on `storage.objects`, especially any policy that grants broad access to `trade-screenshots`.
3. Apply `supabase/migrations/20261023000200_private_trade_screenshot_storage.sql` with the project's authorized Supabase CLI or SQL editor.
4. Confirm the `trade-screenshots` bucket is private and accepts only PNG, JPEG and WebP files up to 8 MB.
5. Deploy the frontend after the migration succeeds.

Firebase Hosting ignores `supabase/**`; publishing the GitHub repository or deploying Hosting will not apply this migration. Do not commit a Supabase service key.

## Verify access

With two separate authenticated test accounts, upload a screenshot from each account. Confirm each owner can view their own image, the other account cannot create a signed URL for it, and an unauthenticated browser cannot retrieve the stored object. Test old screenshot records too. Do not describe screenshot storage as private until these checks pass.
