-- Escala semanal: permite vários procedimentos, salas e médicos por escala.
-- As colunas antigas de public.escalas permanecem para compatibilidade com dados e relatórios legados.
create table if not exists public.escala_procedimentos (
  escala_id bigint not null references public.escalas(id) on delete cascade,
  procedimento_id bigint not null references public.procedimentos_enfermagem(id) on delete cascade,
  primary key (escala_id, procedimento_id)
);

create table if not exists public.escala_salas (
  escala_id bigint not null references public.escalas(id) on delete cascade,
  sala_id bigint not null references public.salas(id) on delete cascade,
  primary key (escala_id, sala_id)
);

create table if not exists public.escala_medicos (
  escala_id bigint not null references public.escalas(id) on delete cascade,
  medico_id bigint not null references public.medicos(id) on delete cascade,
  primary key (escala_id, medico_id)
);

insert into public.escala_salas (escala_id, sala_id)
select id, sala_id from public.escalas where sala_id is not null
on conflict do nothing;

insert into public.escala_medicos (escala_id, medico_id)
select id, medico_id from public.escalas where medico_id is not null
on conflict do nothing;

grant select, insert, update, delete on public.escala_procedimentos to authenticated;
grant select, insert, update, delete on public.escala_salas to authenticated;
grant select, insert, update, delete on public.escala_medicos to authenticated;
grant all on public.escala_procedimentos to service_role;
grant all on public.escala_salas to service_role;
grant all on public.escala_medicos to service_role;

alter table public.escala_procedimentos enable row level security;
alter table public.escala_salas enable row level security;
alter table public.escala_medicos enable row level security;

drop policy if exists "escala_procedimentos_select" on public.escala_procedimentos;
drop policy if exists "escala_procedimentos_insert" on public.escala_procedimentos;
drop policy if exists "escala_procedimentos_delete" on public.escala_procedimentos;
drop policy if exists "escala_salas_select" on public.escala_salas;
drop policy if exists "escala_salas_insert" on public.escala_salas;
drop policy if exists "escala_salas_delete" on public.escala_salas;
drop policy if exists "escala_medicos_select" on public.escala_medicos;
drop policy if exists "escala_medicos_insert" on public.escala_medicos;
drop policy if exists "escala_medicos_delete" on public.escala_medicos;

create policy "escala_procedimentos_select" on public.escala_procedimentos for select to authenticated using (public.tem_modulo(auth.uid(), 'escalas'));
create policy "escala_procedimentos_insert" on public.escala_procedimentos for insert to authenticated with check (public.pode_editar(auth.uid(), 'escalas'));
create policy "escala_procedimentos_delete" on public.escala_procedimentos for delete to authenticated using (public.pode_editar(auth.uid(), 'escalas'));
create policy "escala_salas_select" on public.escala_salas for select to authenticated using (public.tem_modulo(auth.uid(), 'escalas'));
create policy "escala_salas_insert" on public.escala_salas for insert to authenticated with check (public.pode_editar(auth.uid(), 'escalas'));
create policy "escala_salas_delete" on public.escala_salas for delete to authenticated using (public.pode_editar(auth.uid(), 'escalas'));
create policy "escala_medicos_select" on public.escala_medicos for select to authenticated using (public.tem_modulo(auth.uid(), 'escalas'));
create policy "escala_medicos_insert" on public.escala_medicos for insert to authenticated with check (public.pode_editar(auth.uid(), 'escalas'));
create policy "escala_medicos_delete" on public.escala_medicos for delete to authenticated using (public.pode_editar(auth.uid(), 'escalas'));
