-- Corrige o escopo da funcionalidade: os múltiplos itens pertencem à escala de enfermagem.
-- A escala de operações volta a usar apenas public.escalas.sala_id e medico_id.

drop table if exists public.escala_procedimentos cascade;
drop table if exists public.escala_salas cascade;
drop table if exists public.escala_medicos cascade;

create table if not exists public.escala_enfermagem_procedimentos (
  escala_id bigint not null references public.escalas_enfermagem(id) on delete cascade,
  procedimento_id bigint not null references public.procedimentos_enfermagem(id) on delete cascade,
  primary key (escala_id, procedimento_id)
);

create table if not exists public.escala_enfermagem_salas (
  escala_id bigint not null references public.escalas_enfermagem(id) on delete cascade,
  sala_id bigint not null references public.salas(id) on delete cascade,
  primary key (escala_id, sala_id)
);

create table if not exists public.escala_enfermagem_medicos (
  escala_id bigint not null references public.escalas_enfermagem(id) on delete cascade,
  medico_id bigint not null references public.medicos(id) on delete cascade,
  primary key (escala_id, medico_id)
);

grant select, insert, update, delete on public.escala_enfermagem_procedimentos to authenticated;
grant select, insert, update, delete on public.escala_enfermagem_salas to authenticated;
grant select, insert, update, delete on public.escala_enfermagem_medicos to authenticated;
grant all on public.escala_enfermagem_procedimentos to service_role;
grant all on public.escala_enfermagem_salas to service_role;
grant all on public.escala_enfermagem_medicos to service_role;

alter table public.escala_enfermagem_procedimentos enable row level security;
alter table public.escala_enfermagem_salas enable row level security;
alter table public.escala_enfermagem_medicos enable row level security;

drop policy if exists "escala_enfermagem_procedimentos_select" on public.escala_enfermagem_procedimentos;
drop policy if exists "escala_enfermagem_procedimentos_insert" on public.escala_enfermagem_procedimentos;
drop policy if exists "escala_enfermagem_procedimentos_delete" on public.escala_enfermagem_procedimentos;
drop policy if exists "escala_enfermagem_salas_select" on public.escala_enfermagem_salas;
drop policy if exists "escala_enfermagem_salas_insert" on public.escala_enfermagem_salas;
drop policy if exists "escala_enfermagem_salas_delete" on public.escala_enfermagem_salas;
drop policy if exists "escala_enfermagem_medicos_select" on public.escala_enfermagem_medicos;
drop policy if exists "escala_enfermagem_medicos_insert" on public.escala_enfermagem_medicos;
drop policy if exists "escala_enfermagem_medicos_delete" on public.escala_enfermagem_medicos;

create policy "escala_enfermagem_procedimentos_select" on public.escala_enfermagem_procedimentos for select to authenticated using (public.tem_modulo(auth.uid(), 'escala_enfermagem_visualizar'));
create policy "escala_enfermagem_procedimentos_insert" on public.escala_enfermagem_procedimentos for insert to authenticated with check (public.pode_editar(auth.uid(), 'escala_enfermagem_editar'));
create policy "escala_enfermagem_procedimentos_delete" on public.escala_enfermagem_procedimentos for delete to authenticated using (public.pode_editar(auth.uid(), 'escala_enfermagem_editar'));
create policy "escala_enfermagem_salas_select" on public.escala_enfermagem_salas for select to authenticated using (public.tem_modulo(auth.uid(), 'escala_enfermagem_visualizar'));
create policy "escala_enfermagem_salas_insert" on public.escala_enfermagem_salas for insert to authenticated with check (public.pode_editar(auth.uid(), 'escala_enfermagem_editar'));
create policy "escala_enfermagem_salas_delete" on public.escala_enfermagem_salas for delete to authenticated using (public.pode_editar(auth.uid(), 'escala_enfermagem_editar'));
create policy "escala_enfermagem_medicos_select" on public.escala_enfermagem_medicos for select to authenticated using (public.tem_modulo(auth.uid(), 'escala_enfermagem_visualizar'));
create policy "escala_enfermagem_medicos_insert" on public.escala_enfermagem_medicos for insert to authenticated with check (public.pode_editar(auth.uid(), 'escala_enfermagem_editar'));
create policy "escala_enfermagem_medicos_delete" on public.escala_enfermagem_medicos for delete to authenticated using (public.pode_editar(auth.uid(), 'escala_enfermagem_editar'));
