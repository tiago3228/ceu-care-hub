-- Garante que um médico só possa ser vinculado a uma sala do mesmo setor.
create or replace function public.validar_vinculo_medico_sala_setor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  setor_medico text;
  setor_sala text;
begin
  select setor into setor_medico from public.medicos where id = new.medico_id;
  select setor into setor_sala from public.salas where id = new.sala_id;

  if setor_medico is null or setor_sala is null or setor_medico <> setor_sala then
    raise exception 'Médico e sala devem pertencer ao mesmo setor.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_medico_sala_setor on public.medico_salas;
create trigger validar_medico_sala_setor
before insert or update on public.medico_salas
for each row execute function public.validar_vinculo_medico_sala_setor();

comment on function public.validar_vinculo_medico_sala_setor() is
  'Impede vínculos cruzados entre Salas e Enfermagem na tabela medico_salas.';
