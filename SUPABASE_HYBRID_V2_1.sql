-- ExtracTerre v2.1 — migration du pipeline hybride PDF/OCR.
-- À exécuter une seule fois dans Supabase SQL Editor.

alter table public.extracterre_jobs
  add column if not exists user_id uuid,
  add column if not exists storage_parts jsonb,
  add column if not exists options jsonb not null default '{}'::jsonb,
  add column if not exists result_storage_path text,
  add column if not exists result_compression text,
  add column if not exists cleaned_at timestamptz;

create index if not exists extracterre_jobs_user_id_idx
  on public.extracterre_jobs(user_id);

create index if not exists extracterre_jobs_user_status_idx
  on public.extracterre_jobs(user_id, status);

-- La table reste sous RLS sans policy publique :
-- le navigateur passe uniquement par les Edge Functions authentifiées.
alter table public.extracterre_jobs enable row level security;
