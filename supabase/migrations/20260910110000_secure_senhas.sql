-- Segurança da aba Senhas: isolamento por proprietário e permissões granulares.
alter table public.senhas
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

-- Registros existentes ficam atribuídos ao criador quando possível; registros sem criador
-- permanecem sem acesso de usuários comuns até revisão administrativa.
update public.senhas
set owner_user_id = criado_por
where owner_user_id is null and criado_por is not null;

create index if not exists senhas_owner_user_idx on public.senhas (owner_user_id);
create index if not exists senhas_search_idx on public.senhas (nome, login, categoria);

-- O cliente usa as funções server-side para INSERT/UPDATE/DELETE, mas os grants e
-- policies permanecem restritivos mesmo em chamadas diretas à API.
grant select, insert, update, delete on public.senhas to authenticated;
grant usage, select on sequence public.senhas_id_seq to authenticated;

drop policy if exists "Usuarios com modulo senhas podem ver" on public.senhas;
create policy "senhas_select_owner_or_admin"
on public.senhas for select to authenticated
using (
  public.tem_modulo(auth.uid(), 'senhas')
  and (owner_user_id = auth.uid() or public.is_admin(auth.uid()))
);

create policy "senhas_insert_owner"
on public.senhas for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and public.tem_modulo(auth.uid(), 'senhas')
  and (public.is_admin(auth.uid()) or public.tem_modulo(auth.uid(), 'senhas_adicionar'))
);

create policy "senhas_update_owner_or_admin"
on public.senhas for update to authenticated
using (
  (owner_user_id = auth.uid() or public.is_admin(auth.uid()))
  and public.tem_modulo(auth.uid(), 'senhas')
  and (public.is_admin(auth.uid()) or public.tem_modulo(auth.uid(), 'senhas_editar'))
)
with check (
  (owner_user_id = auth.uid() or public.is_admin(auth.uid()))
  and public.tem_modulo(auth.uid(), 'senhas')
  and (public.is_admin(auth.uid()) or public.tem_modulo(auth.uid(), 'senhas_editar'))
);

create policy "senhas_delete_owner_or_admin"
on public.senhas for delete to authenticated
using (
  (owner_user_id = auth.uid() or public.is_admin(auth.uid()))
  and public.tem_modulo(auth.uid(), 'senhas')
  and (public.is_admin(auth.uid()) or public.tem_modulo(auth.uid(), 'senhas_excluir'))
);

comment on column public.senhas.owner_user_id is 'Proprietário do registro; usuários comuns só acessam seus próprios registros.';
