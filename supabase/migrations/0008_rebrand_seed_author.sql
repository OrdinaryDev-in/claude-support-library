-- DevAtlas — Phase 1: production readiness pass.
--
-- The seed account (00000000-0000-0000-0000-000000000001,
-- seed@devatlas.internal) authors all 48 starter prompts and is live in
-- this project's actual database, not just local dev instances seeded via
-- `supabase db reset`. Decision: keep it rather than reassign/delete —
-- but its display name should read as an intentional system author, not
-- a leftover test account, since real users will see "by DevAtlas Seed"
-- on every starter prompt otherwise.

update public.profiles
set full_name = 'DevAtlas Team'
where id = '00000000-0000-0000-0000-000000000001'
  and email = 'seed@devatlas.internal';
