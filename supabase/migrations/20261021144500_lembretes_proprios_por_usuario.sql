begin;

-- Cada conta pode consultar, editar e excluir somente os próprios lembretes,
-- inclusive quando autenticada como administrador master.
delete from public.usuario_permissoes
where modulo = 'lembretes_visualizar_todos';

drop policy if exists "lembretes_select" on public.lembretes;
create policy "lembretes_select" on public.lembretes
  for select to authenticated
  using (
    user_id = auth.uid()
    and public.tem_modulo(auth.uid(), 'lembretes')
  );

drop policy if exists "lembretes_update" on public.lembretes;
create policy "lembretes_update" on public.lembretes
  for update to authenticated
  using (
    user_id = auth.uid()
    and public.pode_editar(auth.uid(), 'lembretes_editar')
  )
  with check (
    user_id = auth.uid()
    and criado_por = auth.uid()
    and public.pode_editar(auth.uid(), 'lembretes_editar')
  );

drop policy if exists "lembretes_delete" on public.lembretes;
create policy "lembretes_delete" on public.lembretes
  for delete to authenticated
  using (
    user_id = auth.uid()
    and public.pode_editar(auth.uid(), 'lembretes_excluir')
  );

commit;
