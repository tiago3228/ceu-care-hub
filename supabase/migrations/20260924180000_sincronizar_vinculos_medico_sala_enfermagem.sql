-- Sincroniza os vínculos de médicos e salas da Enfermagem em uma operação única.
-- A validação impede vínculos cruzados com o módulo Salas operacional.
create or replace function public.sincronizar_salas_do_medico_enfermagem(
  p_medico_id bigint,
  p_sala_ids bigint[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ids bigint[] := coalesce(p_sala_ids, '{}'::bigint[]);
  quantidade_validas integer;
begin
  if not (public.is_admin(auth.uid()) or public.pode_editar(auth.uid(), 'enfermagem')) then
    raise exception 'Você não tem permissão para editar vínculos da Enfermagem.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.medicos
    where id = p_medico_id and setor = 'enfermagem'
  ) then
    raise exception 'O médico não pertence ao setor Enfermagem.' using errcode = '23514';
  end if;

  select count(*) into quantidade_validas
  from public.salas
  where id = any(ids) and setor = 'enfermagem';

  if quantidade_validas <> cardinality(array(select distinct unnest(ids))) then
    raise exception 'Todas as salas devem pertencer ao setor Enfermagem.' using errcode = '23514';
  end if;

  delete from public.medico_salas where medico_id = p_medico_id;

  insert into public.medico_salas (medico_id, sala_id)
  select p_medico_id, sala_id
  from unnest(ids) as sala_id;
end;
$$;

grant execute on function public.sincronizar_salas_do_medico_enfermagem(bigint, bigint[]) to authenticated;

create or replace function public.sincronizar_medicos_da_sala_enfermagem(
  p_sala_id bigint,
  p_medico_ids bigint[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ids bigint[] := coalesce(p_medico_ids, '{}'::bigint[]);
  quantidade_validos integer;
begin
  if not (public.is_admin(auth.uid()) or public.pode_editar(auth.uid(), 'enfermagem')) then
    raise exception 'Você não tem permissão para editar vínculos da Enfermagem.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.salas
    where id = p_sala_id and setor = 'enfermagem'
  ) then
    raise exception 'A sala não pertence ao setor Enfermagem.' using errcode = '23514';
  end if;

  select count(*) into quantidade_validos
  from public.medicos
  where id = any(ids) and setor = 'enfermagem';

  if quantidade_validos <> cardinality(array(select distinct unnest(ids))) then
    raise exception 'Todos os médicos devem pertencer ao setor Enfermagem.' using errcode = '23514';
  end if;

  delete from public.medico_salas where sala_id = p_sala_id;

  insert into public.medico_salas (medico_id, sala_id)
  select medico_id, p_sala_id
  from unnest(ids) as medico_id;
end;
$$;

grant execute on function public.sincronizar_medicos_da_sala_enfermagem(bigint, bigint[]) to authenticated;
