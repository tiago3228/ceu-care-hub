-- A área de Laudos possui permissão própria e conteúdo pessoal por usuário.
-- O conteúdo legado com criado_por nulo permanece como biblioteca-base somente leitura.

insert into public.menu_itens (chave, grupo, grupo_ordem, rotulo, destino, icone, modulo, ordem, somente_admin)
values ('laudos', 'Salas', 20, 'Laudos', '/laudos', 'ClipboardList', 'laudos', 45, false)
on conflict (chave) do update set
  grupo = excluded.grupo,
  grupo_ordem = excluded.grupo_ordem,
  rotulo = excluded.rotulo,
  destino = excluded.destino,
  icone = excluded.icone,
  modulo = excluded.modulo,
  ordem = excluded.ordem,
  somente_admin = excluded.somente_admin;

-- A biblioteca de médicos é compartilhada; o conteúdo criado/importado é pessoal.
drop policy if exists laudos_medicos_select on public.laudos_medicos;
create policy laudos_medicos_select on public.laudos_medicos
  for select to authenticated
  using (public.tem_modulo(auth.uid(), 'laudos'));

-- Os autotextos legados (criado_por nulo) continuam disponíveis como base.
drop policy if exists laudos_autotextos_select on public.laudos_autotextos;
create policy laudos_autotextos_select on public.laudos_autotextos
  for select to authenticated
  using (
    public.tem_modulo(auth.uid(), 'laudos')
    and (criado_por is null or criado_por = auth.uid())
    and exists (select 1 from public.laudos_medicos lm where lm.medico_id = laudos_autotextos.medico_id)
  );
drop policy if exists laudos_autotextos_insert on public.laudos_autotextos;
create policy laudos_autotextos_insert on public.laudos_autotextos
  for insert to authenticated
  with check (
    public.pode_editar(auth.uid(), 'laudos')
    and criado_por = auth.uid()
    and exists (select 1 from public.laudos_medicos lm where lm.medico_id = laudos_autotextos.medico_id)
  );
drop policy if exists laudos_autotextos_update on public.laudos_autotextos;
create policy laudos_autotextos_update on public.laudos_autotextos
  for update to authenticated
  using (public.pode_editar(auth.uid(), 'laudos') and criado_por = auth.uid())
  with check (
    public.pode_editar(auth.uid(), 'laudos')
    and criado_por = auth.uid()
    and exists (select 1 from public.laudos_medicos lm where lm.medico_id = laudos_autotextos.medico_id)
  );
drop policy if exists laudos_autotextos_delete on public.laudos_autotextos;
create policy laudos_autotextos_delete on public.laudos_autotextos
  for delete to authenticated
  using (public.pode_editar(auth.uid(), 'laudos') and criado_por = auth.uid());

-- Ajudas, atestados e outros legados ficam visíveis como base; novos materiais são pessoais.
drop policy if exists laudos_materiais_select on public.laudos_materiais;
create policy laudos_materiais_select on public.laudos_materiais
  for select to authenticated
  using (
    public.tem_modulo(auth.uid(), 'laudos')
    and (criado_por is null or criado_por = auth.uid())
    and (
      medico_id is null
      or exists (select 1 from public.laudos_medicos lm where lm.medico_id = laudos_materiais.medico_id)
    )
  );
drop policy if exists laudos_materiais_insert on public.laudos_materiais;
create policy laudos_materiais_insert on public.laudos_materiais
  for insert to authenticated
  with check (
    public.pode_editar(auth.uid(), 'laudos')
    and criado_por = auth.uid()
    and (
      medico_id is null
      or exists (select 1 from public.laudos_medicos lm where lm.medico_id = laudos_materiais.medico_id)
    )
  );
drop policy if exists laudos_materiais_update on public.laudos_materiais;
create policy laudos_materiais_update on public.laudos_materiais
  for update to authenticated
  using (public.pode_editar(auth.uid(), 'laudos') and criado_por = auth.uid())
  with check (
    public.pode_editar(auth.uid(), 'laudos')
    and criado_por = auth.uid()
    and (
      medico_id is null
      or exists (select 1 from public.laudos_medicos lm where lm.medico_id = laudos_materiais.medico_id)
    )
  );
drop policy if exists laudos_materiais_delete on public.laudos_materiais;
create policy laudos_materiais_delete on public.laudos_materiais
  for delete to authenticated
  using (public.pode_editar(auth.uid(), 'laudos') and criado_por = auth.uid());

-- Laudos digitados, importações e temporários pertencem exclusivamente ao usuário que os criou.
drop policy if exists laudos_documentos_select on public.laudos_documentos;
create policy laudos_documentos_select on public.laudos_documentos
  for select to authenticated
  using (
    public.tem_modulo(auth.uid(), 'laudos')
    and criado_por = auth.uid()
    and exists (select 1 from public.laudos_medicos lm where lm.medico_id = laudos_documentos.medico_id)
  );
drop policy if exists laudos_documentos_insert on public.laudos_documentos;
create policy laudos_documentos_insert on public.laudos_documentos
  for insert to authenticated
  with check (
    public.pode_editar(auth.uid(), 'laudos')
    and criado_por = auth.uid()
    and exists (select 1 from public.laudos_medicos lm where lm.medico_id = laudos_documentos.medico_id)
  );
drop policy if exists laudos_documentos_update on public.laudos_documentos;
create policy laudos_documentos_update on public.laudos_documentos
  for update to authenticated
  using (public.pode_editar(auth.uid(), 'laudos') and criado_por = auth.uid())
  with check (
    public.pode_editar(auth.uid(), 'laudos')
    and criado_por = auth.uid()
    and exists (select 1 from public.laudos_medicos lm where lm.medico_id = laudos_documentos.medico_id)
  );
drop policy if exists laudos_documentos_delete on public.laudos_documentos;
create policy laudos_documentos_delete on public.laudos_documentos
  for delete to authenticated
  using (public.pode_editar(auth.uid(), 'laudos') and criado_por = auth.uid());

drop policy if exists laudos_importacoes_select on public.laudos_importacoes;
create policy laudos_importacoes_select on public.laudos_importacoes
  for select to authenticated
  using (public.tem_modulo(auth.uid(), 'laudos') and criado_por = auth.uid());
drop policy if exists laudos_importacoes_insert on public.laudos_importacoes;
create policy laudos_importacoes_insert on public.laudos_importacoes
  for insert to authenticated
  with check (
    public.pode_editar(auth.uid(), 'laudos')
    and criado_por = auth.uid()
    and exists (select 1 from public.laudos_medicos lm where lm.medico_id = laudos_importacoes.medico_id)
  );

drop policy if exists laudos_temporarios_select on public.laudos_temporarios;
create policy laudos_temporarios_select on public.laudos_temporarios
  for select to authenticated
  using (public.tem_modulo(auth.uid(), 'laudos') and usuario_id = auth.uid());
drop policy if exists laudos_temporarios_insert on public.laudos_temporarios;
create policy laudos_temporarios_insert on public.laudos_temporarios
  for insert to authenticated
  with check (public.pode_editar(auth.uid(), 'laudos') and usuario_id = auth.uid());
drop policy if exists laudos_temporarios_update on public.laudos_temporarios;
create policy laudos_temporarios_update on public.laudos_temporarios
  for update to authenticated
  using (public.pode_editar(auth.uid(), 'laudos') and usuario_id = auth.uid())
  with check (public.pode_editar(auth.uid(), 'laudos') and usuario_id = auth.uid());
drop policy if exists laudos_temporarios_delete on public.laudos_temporarios;
create policy laudos_temporarios_delete on public.laudos_temporarios
  for delete to authenticated
  using (public.pode_editar(auth.uid(), 'laudos') and usuario_id = auth.uid());

-- O cadastro mestre de médicos continua legível para quem recebeu a permissão de Laudos.
drop policy if exists medicos_select on public.medicos;
create policy medicos_select on public.medicos for select to authenticated using (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.tem_modulo(auth.uid(), 'medicos'))
  or (setor = 'enfermagem' and public.tem_modulo(auth.uid(), 'enfermagem'))
  or (
    public.tem_modulo(auth.uid(), 'laudos')
    and exists (select 1 from public.laudos_medicos lm where lm.medico_id = medicos.id)
  )
);
