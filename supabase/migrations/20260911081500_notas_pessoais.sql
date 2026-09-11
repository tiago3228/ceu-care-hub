-- Bloco de Notas pessoal: cada usuário só pode ler, editar e excluir as próprias notas.
-- O administrador master também não recebe exceção: a privacidade é individual.
drop policy if exists "notas_select" on public.notas;
drop policy if exists "notas_insert" on public.notas;
drop policy if exists "notas_update" on public.notas;
drop policy if exists "notas_delete" on public.notas;

create policy "notas_select_pessoal" on public.notas
  for select to authenticated
  using (created_by = auth.uid() and public.tem_modulo(auth.uid(), 'notas'));

create policy "notas_insert_pessoal" on public.notas
  for insert to authenticated
  with check (created_by = auth.uid() and public.pode_editar(auth.uid(), 'notas'));

create policy "notas_update_pessoal" on public.notas
  for update to authenticated
  using (created_by = auth.uid() and public.pode_editar(auth.uid(), 'notas'))
  with check (created_by = auth.uid() and public.pode_editar(auth.uid(), 'notas'));

create policy "notas_delete_pessoal" on public.notas
  for delete to authenticated
  using (created_by = auth.uid() and public.pode_editar(auth.uid(), 'notas'));
