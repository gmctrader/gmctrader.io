-- OPTIONAL, run by hand in the Supabase SQL editor. NOT a migration.
--
-- Older SciFe builds saved users' personal provider keys (Gemini / OpenAI /
-- Anthropic ...) inside trader_data.scife.apiKeys. Current code keeps them in
-- the browser only and strips them on save, but any user who has not opened
-- SciFe since that change may still have a plaintext key in their row.
--
-- 1) See how many rows are affected (no changes):
select count(*) as rows_with_legacy_keys
from public.trader_data
where scife ?| array['apiKeys', 'apiKey'];

-- 2) Remove them. Affected users simply paste their key again in SciFe settings.
--    Uncomment to run:
-- update public.trader_data
-- set scife = scife - 'apiKeys' - 'apiKey'
-- where scife ?| array['apiKeys', 'apiKey'];
