-- Clients describe each upload in their own words instead of following a
-- fixed checklist (Crown's decision, 2026-11-24). Checklist columns remain for
-- compatibility but the client page no longer shows them.
alter table portal_files add column if not exists description text;
