-- Permite que cada usuário oculte uma ajuda da biblioteca-base sem apagá-la para os demais.
create table if not exists public.laudos_materiais_ocultos (
  material_id bigint not null references public.laudos_materiais(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  ocultado_em timestamptz not null default now(),
  primary key (material_id, usuario_id)
);

grant select, insert, delete on public.laudos_materiais_ocultos to authenticated;
alter table public.laudos_materiais_ocultos enable row level security;

drop policy if exists laudos_materiais_ocultos_select on public.laudos_materiais_ocultos;
create policy laudos_materiais_ocultos_select on public.laudos_materiais_ocultos
  for select to authenticated
  using (public.tem_modulo(auth.uid(), 'laudos') and usuario_id = auth.uid());

drop policy if exists laudos_materiais_ocultos_insert on public.laudos_materiais_ocultos;
create policy laudos_materiais_ocultos_insert on public.laudos_materiais_ocultos
  for insert to authenticated
  with check (public.pode_editar(auth.uid(), 'laudos') and usuario_id = auth.uid());

drop policy if exists laudos_materiais_ocultos_delete on public.laudos_materiais_ocultos;
create policy laudos_materiais_ocultos_delete on public.laudos_materiais_ocultos
  for delete to authenticated
  using (public.pode_editar(auth.uid(), 'laudos') and usuario_id = auth.uid());

drop policy if exists laudos_materiais_select on public.laudos_materiais;
create policy laudos_materiais_select on public.laudos_materiais
  for select to authenticated
  using (
    public.tem_modulo(auth.uid(), 'laudos')
    and (criado_por is null or criado_por = auth.uid())
    and not exists (
      select 1 from public.laudos_materiais_ocultos oculto
      where oculto.material_id = laudos_materiais.id and oculto.usuario_id = auth.uid()
    )
    and (
      medico_id is null
      or exists (select 1 from public.laudos_medicos lm where lm.medico_id = laudos_materiais.medico_id)
    )
  );
