-- DevAtlas — Phase 2 supplement: four new Prompt categories
--
-- Purely additive to the shared `categories` table
-- (20260824130000_categories.sql) — no schema change, just new rows for
-- resource_type = 'prompt'. Closes real gaps found in the Phase 2b seed
-- research pass (security review, code review, database/migrations, and
-- legacy/modernization had zero prompts before this). Colors are new,
-- distinct hex values rather than reusing --cat-* CSS vars, since (unlike
-- Skills/Connectors) these categories share one filter legend with the
-- five existing Prompt categories and must stay visually distinguishable
-- from them, not just from each other.

insert into public.categories (resource_type, key, label, color, sort_order) values
  ('prompt', 'security_review', 'Security Review', '#cf5c8a', 6),
  ('prompt', 'code_review', 'Code Review', '#7fae4a', 7),
  ('prompt', 'db_migrations', 'Database / Migrations', '#4aa8b8', 8),
  ('prompt', 'legacy_modernization', 'Legacy / Modernization', '#b5793a', 9);
