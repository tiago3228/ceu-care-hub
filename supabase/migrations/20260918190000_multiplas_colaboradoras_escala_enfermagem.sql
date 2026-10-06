-- Permite várias colaboradoras no mesmo registro da escala de enfermagem.
create table if not exists public.escala_enfermagem_colaboradoras (
  escala_id bigint not null references public.escalas_enfermagem(id) on delete cascade,
  colaboradora_id bigint not null references public.colaboradoras(id) on delete cascade,
  primary key (escala_id, colaboradora_id)
);

insert into public.escala_enfermagem_colaboradoras (escala_id, colaboradora_id)
select id, colaboradora_id from public.escalas_enfermagem
on conflict do nothing;

grant select, insert, update, delete on public.escala_enfermagem_colaboradoras to authenticated;
grant all on public.escala_enfermagem_colaboradoras to service_role;

alter table public.escala_enfermagem_colaboradoras enable row level security;

drop policy if exists "escala_enfermagem_colaboradoras_select" on public.escala_enfermagem_colaboradoras;
drop policy if exists "escala_enfermagem_colaboradoras_insert" on public.escala_enfermagem_colaboradoras;
drop policy if exists "escala_enfermagem_colaboradoras_delete" on public.escala_enfermagem_colaboradoras;

create policy "escala_enfermagem_colaboradoras_select" on public.escala_enfermagem_colaboradoras for select to authenticated using (public.tem_modulo(auth.uid(), 'escala_enfermagem_visualizar'));
create policy "escala_enfermagem_colaboradoras_insert" on public.escala_enfermagem_colaboradoras for insert to authenticated with check (public.pode_editar(auth.uid(), 'escala_enfermagem_editar'));
create policy "escala_enfermagem_colaboradoras_delete" on public.escala_enfermagem_colaboradoras for delete to authenticated using (public.pode_editar(auth.uid(), 'escala_enfermagem_editar'));
