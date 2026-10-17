-- Rascunhos temporários do editor Word: autosave a cada minuto e retenção de cinco dias.
create table if not exists public.laudos_temporarios (
  id uuid primary key default gen_random_uuid(),
  medico_id bigint not null references public.medicos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  conteudo_html text not null default '',
  conteudo_texto text not null default '',
  origem_tipo text not null default 'laudo' check (origem_tipo in ('laudo', 'ajuda', 'autotexto')),
  origem_id text,
  chave text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '5 days'),
  constraint laudos_temporarios_titulo_nao_vazio check (length(btrim(titulo)) > 0)
);

create index if not exists laudos_temporarios_usuario_expira_idx
  on public.laudos_temporarios (usuario_id, expira_em desc);
create unique index if not exists laudos_temporarios_usuario_chave_idx
  on public.laudos_temporarios (usuario_id, chave);
create index if not exists laudos_temporarios_medico_atualizado_idx
  on public.laudos_temporarios (medico_id, atualizado_em desc);

grant select, insert, update, delete on public.laudos_temporarios to authenticated;
alter table public.laudos_temporarios enable row level security;

drop policy if exists laudos_temporarios_select on public.laudos_temporarios;
create policy laudos_temporarios_select on public.laudos_temporarios
  for select to authenticated
  using (
    public.tem_modulo(auth.uid(), 'salas')
    and (usuario_id = auth.uid() or public.is_admin(auth.uid()))
  );

drop policy if exists laudos_temporarios_insert on public.laudos_temporarios;
create policy laudos_temporarios_insert on public.laudos_temporarios
  for insert to authenticated
  with check (
    public.pode_editar(auth.uid(), 'salas')
    and usuario_id = auth.uid()
    and exists (select 1 from public.laudos_medicos lm where lm.medico_id = laudos_temporarios.medico_id)
  );

drop policy if exists laudos_temporarios_update on public.laudos_temporarios;
create policy laudos_temporarios_update on public.laudos_temporarios
  for update to authenticated
  using (public.pode_editar(auth.uid(), 'salas') and (usuario_id = auth.uid() or public.is_admin(auth.uid())))
  with check (
    public.pode_editar(auth.uid(), 'salas')
    and (usuario_id = auth.uid() or public.is_admin(auth.uid()))
  );

drop policy if exists laudos_temporarios_delete on public.laudos_temporarios;
create policy laudos_temporarios_delete on public.laudos_temporarios
  for delete to authenticated
  using (usuario_id = auth.uid() or public.is_admin(auth.uid()));

-- Permite que a aplicação limpe registros vencidos antes de listar a pasta.
create or replace function public.limpar_laudos_temporarios_expirados()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  total integer;
begin
  delete from public.laudos_temporarios
   where expira_em < now()
     and (usuario_id = auth.uid() or public.is_admin(auth.uid()));
  get diagnostics total = row_count;
  return total;
end;
$$;

grant execute on function public.limpar_laudos_temporarios_expirados() to authenticated;
