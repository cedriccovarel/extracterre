-- ExtracTerre v2.24.0 — registre de l'import massif (script tools/import).
-- Confidentialité :
--  * contenu chiffré côté poste (AES-256-GCM, clé dérivée de votre phrase secrète, jamais envoyée) ;
--  * identifiants (contrat, chemin, empreinte) remplacés par des HMAC ;
--  * RLS activée SANS aucune politique + droits retirés aux rôles anon / authenticated : seules la clé de service
--    (sur votre ordinateur, fichier .env) et l'administration du projet atteignent les lignes, illisibles sans la phrase.
-- Idempotent : peut être relancé.

create table if not exists public.extracterre_import_keys (
  id smallint primary key default 1 check (id = 1),
  salt text not null,
  iterations integer not null default 310000,
  check_value text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.extracterre_import_files (
  file_key text primary key,              -- HMAC(contrat|chemin relatif)
  contract_key text not null,             -- HMAC(contrat)
  content_key text,                       -- HMAC(SHA-256 du fichier)
  family text,                            -- cctp | thermique | carbone
  status text not null,                   -- nouveau | à traiter | traité | ignoré | à vérifier | erreur
  is_current boolean not null default false,
  missing boolean not null default false,
  payload text not null,                  -- métadonnées chiffrées (nom, chemin, taille, dates, type, méthode, version, motif…)
  first_seen_at timestamptz not null default now(),
  processed_at timestamptz,
  missing_since timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists extracterre_import_files_contract on public.extracterre_import_files (contract_key);
create index if not exists extracterre_import_files_content on public.extracterre_import_files (content_key);
create index if not exists extracterre_import_files_status on public.extracterre_import_files (status);

create table if not exists public.extracterre_import_operations (
  contract_key text primary key,          -- HMAC(contrat)
  status text,                            -- complet | interrompu
  fingerprint text,
  payload text not null,                  -- chiffré (dossier, compteurs, sous-dossiers retenus, dernier passage)
  updated_at timestamptz not null default now()
);

alter table public.extracterre_import_keys enable row level security;
alter table public.extracterre_import_files enable row level security;
alter table public.extracterre_import_operations enable row level security;
alter table public.extracterre_import_keys force row level security;
alter table public.extracterre_import_files force row level security;
alter table public.extracterre_import_operations force row level security;

revoke all on public.extracterre_import_keys from anon, authenticated;
revoke all on public.extracterre_import_files from anon, authenticated;
revoke all on public.extracterre_import_operations from anon, authenticated;
grant all on public.extracterre_import_keys to service_role;
grant all on public.extracterre_import_files to service_role;
grant all on public.extracterre_import_operations to service_role;
