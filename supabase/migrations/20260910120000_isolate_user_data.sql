-- Isolamento definitivo dos dados pessoais por usuário.
-- Esta migration é idempotente para permitir sincronização segura pelo Lovable.

-- ==================== SENHAS ====================
alter table public.senhas
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

update public.senhas
set owner_user_id = criado_por
where owner_user_id is null
  and criado_por is not null;

create index if not exists senhas_owner_user_idx on public.senhas (owner_user_id);

grant select, insert, update, delete on public.senhas to authenticated;

drop policy if exists "Usuarios com modulo senhas podem ver" on public.senhas;
drop policy if exists "senhas_select_owner_or_admin" on public.senhas;
drop policy if exists "senhas_insert_owner" on public.senhas;
drop policy if exists "senhas_update_owner_or_admin" on public.senhas;
drop policy if exists "senhas_delete_owner_or_admin" on public.senhas;

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

-- ==================== BLOCO DE NOTAS ====================
-- Notas são privadas: cada usuário só lê, altera e exclui as próprias notas.
-- Mesmo administradores não recebem acesso às notas de terceiros por esta policy.
drop policy if exists "notas_select" on public.notas;
drop policy if exists "notas_insert" on public.notas;
drop policy if exists "notas_update" on public.notas;
drop policy if exists "notas_delete" on public.notas;

create policy "notas_select_owner"
on public.notas for select to authenticated
using (
  created_by = auth.uid()
  and public.tem_modulo(auth.uid(), 'notas')
);

create policy "notas_insert_owner"
on public.notas for insert to authenticated
with check (
  created_by = auth.uid()
  and public.pode_editar(auth.uid(), 'notas')
);

create policy "notas_update_owner"
on public.notas for update to authenticated
using (
  created_by = auth.uid()
  and public.pode_editar(auth.uid(), 'notas')
)
with check (
  created_by = auth.uid()
  and public.pode_editar(auth.uid(), 'notas')
);

create policy "notas_delete_owner"
on public.notas for delete to authenticated
using (
  created_by = auth.uid()
  and public.pode_editar(auth.uid(), 'notas')
);
