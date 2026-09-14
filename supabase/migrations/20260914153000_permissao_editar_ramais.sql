-- Separa leitura de ramais da edição.
-- Administrador Master sempre pode editar; os demais precisam da permissão ramais_editar.
drop policy if exists "ramais_insert" on public.ramais;
drop policy if exists "ramais_update" on public.ramais;
drop policy if exists "ramais_delete" on public.ramais;

create policy "ramais_insert" on public.ramais for insert to authenticated
  with check (public.is_master(auth.uid()) or public.tem_modulo(auth.uid(), 'ramais_editar'));

create policy "ramais_update" on public.ramais for update to authenticated
  using (public.is_master(auth.uid()) or public.tem_modulo(auth.uid(), 'ramais_editar'))
  with check (public.is_master(auth.uid()) or public.tem_modulo(auth.uid(), 'ramais_editar'));

create policy "ramais_delete" on public.ramais for delete to authenticated
  using (public.is_master(auth.uid()) or public.tem_modulo(auth.uid(), 'ramais_editar'));

-- Deixa a permissão explícita no perfil do usuário mestre, além do acesso automático.
insert into public.usuario_permissoes (user_id, modulo)
select ur.user_id, 'ramais_editar'
from public.user_roles ur
where ur.role = 'admin_master'::public.app_role
  and not exists (
    select 1 from public.usuario_permissoes up
    where up.user_id = ur.user_id and up.modulo = 'ramais_editar'
  );
