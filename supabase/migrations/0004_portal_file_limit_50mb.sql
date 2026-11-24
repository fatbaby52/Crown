-- Per-file limit raised from 25 MB to 50 MB (Alex, 2026-11-24).
-- Netlify PORTAL_MAX_FILE_BYTES=52428800 is the matching runtime setting.
update storage.buckets set file_size_limit = 52428800 where id = 'client-uploads';
alter table portal_requests alter column max_file_bytes set default 52428800;
update portal_templates set instructions = replace(instructions, '25 MB per file', '50 MB per file');
