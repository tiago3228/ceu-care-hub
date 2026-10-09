-- Edições específicas das particularidades usadas pelo assistente de Agendamento.
-- A permissão de edição é independente do acesso de consulta e pode ser dada a outro setor.

create table if not exists public.agendamento_medicos_particularidades (
  chave text primary key,
  nome_medico text not null,
  dados jsonb not null default '{}'::jsonb,
  atualizado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.agendamento_medicos_particularidades to authenticated;
grant all on public.agendamento_medicos_particularidades to service_role;

alter table public.agendamento_medicos_particularidades enable row level security;

drop policy if exists agendamento_particularidades_select on public.agendamento_medicos_particularidades;
drop policy if exists agendamento_particularidades_insert on public.agendamento_medicos_particularidades;
drop policy if exists agendamento_particularidades_update on public.agendamento_medicos_particularidades;
drop policy if exists agendamento_particularidades_delete on public.agendamento_medicos_particularidades;

create policy agendamento_particularidades_select
on public.agendamento_medicos_particularidades
for select to authenticated
using (
  public.tem_modulo(auth.uid(), 'agendamento_marcacao')
  or public.pode_editar(auth.uid(), 'agendamento_marcacao_particularidades_editar')
);

create policy agendamento_particularidades_insert
on public.agendamento_medicos_particularidades
for insert to authenticated
with check (
  public.pode_editar(auth.uid(), 'agendamento_marcacao_particularidades_editar')
  and atualizado_por = auth.uid()
);

create policy agendamento_particularidades_update
on public.agendamento_medicos_particularidades
for update to authenticated
using (public.pode_editar(auth.uid(), 'agendamento_marcacao_particularidades_editar'))
with check (
  public.pode_editar(auth.uid(), 'agendamento_marcacao_particularidades_editar')
  and atualizado_por = auth.uid()
);

create policy agendamento_particularidades_delete
on public.agendamento_medicos_particularidades
for delete to authenticated
using (public.pode_editar(auth.uid(), 'agendamento_marcacao_particularidades_editar'));

create or replace function public.agendamento_particularidades_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  new.atualizado_por = auth.uid();
  return new;
end;
$$;

drop trigger if exists agendamento_particularidades_updated_at on public.agendamento_medicos_particularidades;
create trigger agendamento_particularidades_updated_at
before insert or update on public.agendamento_medicos_particularidades
for each row execute function public.agendamento_particularidades_set_updated_at();
