-- ExtracTerre v1.1.23 — migration facultative pour partager la mémoire d'apprentissage entre ordinateurs.
-- À exécuter UNE SEULE FOIS dans Supabase SQL Editor si le journal partagé est déjà installé.
create or replace function public.extracterre_learning_memory_pull(p_proof text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog
as $$
declare v_role text; v_result jsonb;
begin
  v_role := private.extracterre_role(p_proof);
  if v_role is null then raise exception 'Accès mémoire refusé'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,
    'createdAt',created_at_ms,
    'eventType',event_type,
    'payload',payload
  ) order by created_at_ms),'[]'::jsonb)
  into v_result
  from public.extracterre_learning_events
  where event_type in ('parser_location_learning','parser_location_rejection');
  return v_result;
end;
$$;
revoke all on function public.extracterre_learning_memory_pull(text) from public;
grant execute on function public.extracterre_learning_memory_pull(text) to anon, authenticated;
