-- ExtracTerre v1.1.6 — journal d'amélioration partagé
-- À exécuter une seule fois dans l'éditeur SQL d'un projet Supabase.
-- AUCUN mot de passe en clair n'est stocké ici : uniquement des empreintes de preuves dérivées.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.extracterre_journal_secrets (
  id bigserial primary key,
  access_role text not null check (access_role in ('owner','team','pack')),
  proof_hash text not null unique
);

truncate table private.extracterre_journal_secrets;
insert into private.extracterre_journal_secrets(access_role, proof_hash) values
  ('owner','023ca07d5f05fbc26941a69cb251584b1969f62b62b40a41c584195b81c62bbb'),
  ('team','92d4af0ae8f92a76821f09050c70bb8951f808bd8f37ab4d71435e6fc385d045'),
  ('team','a29afc7ccee63392343aa88a05051af0cdee82d882907437e931b0bafbd0e50a'),
  ('pack','d9fed6b3e652370176955b01d2244e8e17c573ed7211f9be97fc9361c3486d80');

create table if not exists public.extracterre_learning_events (
  id text primary key,
  schema_version integer not null default 1,
  app_version text not null,
  created_at_ms bigint not null,
  received_at timestamptz not null default now(),
  event_type text not null,
  project_ref text,
  instance_id text,
  access_role text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists extracterre_learning_events_created_idx on public.extracterre_learning_events(created_at_ms);
create index if not exists extracterre_learning_events_type_idx on public.extracterre_learning_events(event_type);
alter table public.extracterre_learning_events enable row level security;
revoke all on table public.extracterre_learning_events from anon, authenticated;

create or replace function private.extracterre_role(p_proof text)
returns text
language sql
stable
security definer
set search_path = private, public, extensions, pg_catalog
as $$
  select access_role
  from private.extracterre_journal_secrets
  where access_role in ('owner','team')
    and encode(digest(coalesce(p_proof,''::text),'sha256'::text),'hex'::text) = proof_hash
  limit 1
$$;

create or replace function private.extracterre_pack_ok(p_pack_proof text)
returns boolean
language sql
stable
security definer
set search_path = private, public, extensions, pg_catalog
as $$
  select exists(
    select 1 from private.extracterre_journal_secrets
    where access_role='pack'
      and encode(digest(coalesce(p_pack_proof,''::text),'sha256'::text),'hex'::text) = proof_hash
  )
$$;

create or replace function public.extracterre_journal_append(p_proof text, p_events jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog
as $$
declare
  v_role text;
  v_event jsonb;
  v_count integer := 0;
begin
  v_role := private.extracterre_role(p_proof);
  if v_role is null then raise exception 'Accès journal refusé'; end if;
  if jsonb_typeof(p_events) <> 'array' then raise exception 'Format événements invalide'; end if;

  for v_event in select value from jsonb_array_elements(p_events)
  loop
    if coalesce(v_event->>'id','') = '' then continue; end if;
    insert into public.extracterre_learning_events(
      id,schema_version,app_version,created_at_ms,event_type,project_ref,instance_id,access_role,payload
    ) values (
      v_event->>'id',
      coalesce((v_event->>'schema')::integer,1),
      coalesce(v_event->>'appVersion',''),
      coalesce((v_event->>'createdAt')::bigint,(extract(epoch from clock_timestamp())*1000)::bigint),
      coalesce(v_event->>'eventType','event'),
      nullif(v_event->>'projectRef',''),
      nullif(v_event->>'instanceId',''),
      v_role,
      coalesce(v_event->'payload','{}'::jsonb)
    ) on conflict (id) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;
  return jsonb_build_object('ok',true,'inserted',v_count,'role',v_role);
end;
$$;

create or replace function public.extracterre_journal_status(p_proof text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog
as $$
declare v_role text; v_count bigint;
begin
  v_role := private.extracterre_role(p_proof);
  if v_role is null then raise exception 'Accès journal refusé'; end if;
  select count(*) into v_count from public.extracterre_learning_events;
  return jsonb_build_object('ok',true,'role',v_role,'events',v_count);
end;
$$;

create or replace function public.extracterre_journal_export(p_proof text, p_pack_proof text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog
as $$
declare v_role text; v_result jsonb;
begin
  v_role := private.extracterre_role(p_proof);
  if v_role is null then raise exception 'Accès journal refusé'; end if;
  if v_role='team' and not private.extracterre_pack_ok(p_pack_proof) then
    raise exception 'Autorisation pack requise';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,
    'schema',schema_version,
    'appVersion',app_version,
    'createdAt',created_at_ms,
    'eventType',event_type,
    'projectRef',coalesce(project_ref,''),
    'instanceId',coalesce(instance_id,''),
    'accessRole',coalesce(access_role,''),
    'payload',payload,
    'remoteReceivedAt',received_at
  ) order by created_at_ms),'[]'::jsonb)
  into v_result
  from public.extracterre_learning_events;
  return v_result;
end;
$$;

revoke all on function public.extracterre_journal_append(text,jsonb) from public;
revoke all on function public.extracterre_journal_status(text) from public;
revoke all on function public.extracterre_journal_export(text,text) from public;
grant execute on function public.extracterre_journal_append(text,jsonb) to anon, authenticated;
grant execute on function public.extracterre_journal_status(text) to anon, authenticated;
grant execute on function public.extracterre_journal_export(text,text) to anon, authenticated;
