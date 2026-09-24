-- Persiste a ordem escolhida por cada usuário sem alterar a ordem padrão/admin do menu.
create table if not exists public.menu_ordens_usuario (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo varchar(10) not null,
  chave text not null,
  ordem integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (usuario_id, tipo, chave),
  constraint menu_ordens_usuario_tipo_valido check (tipo in ('grupo', 'item')),
  constraint menu_ordens_usuario_ordem_valida check (ordem >= 0)
);

comment on table public.menu_ordens_usuario is
  'Ordem personalizada dos grupos e itens do menu principal por usuário.';

create index if not exists menu_ordens_usuario_ordem_idx
  on public.menu_ordens_usuario (usuario_id, tipo, ordem);

grant select, insert, update, delete on public.menu_ordens_usuario to authenticated;
alter table public.menu_ordens_usuario enable row level security;

drop policy if exists menu_ordens_usuario_select on public.menu_ordens_usuario;
create policy menu_ordens_usuario_select
  on public.menu_ordens_usuario for select to authenticated
  using (usuario_id = auth.uid() and public.is_ativo(auth.uid()));

drop policy if exists menu_ordens_usuario_insert on public.menu_ordens_usuario;
create policy menu_ordens_usuario_insert
  on public.menu_ordens_usuario for insert to authenticated
  with check (usuario_id = auth.uid() and public.is_ativo(auth.uid()));

drop policy if exists menu_ordens_usuario_update on public.menu_ordens_usuario;
create policy menu_ordens_usuario_update
  on public.menu_ordens_usuario for update to authenticated
  using (usuario_id = auth.uid() and public.is_ativo(auth.uid()))
  with check (usuario_id = auth.uid() and public.is_ativo(auth.uid()));

drop policy if exists menu_ordens_usuario_delete on public.menu_ordens_usuario;
create policy menu_ordens_usuario_delete
  on public.menu_ordens_usuario for delete to authenticated
  using (usuario_id = auth.uid() and public.is_ativo(auth.uid()));
