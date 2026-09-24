-- Permite que cada setor leia e altere somente seus próprios médicos,
-- colaboradoras, salas e respectivos vínculos.

grant select, insert, update, delete on public.medicos, public.colaboradoras, public.salas,
  public.medico_salas, public.sala_colaboradoras to authenticated;

drop policy if exists medicos_select on public.medicos;
drop policy if exists medicos_insert on public.medicos;
drop policy if exists medicos_update on public.medicos;
drop policy if exists medicos_delete on public.medicos;
create policy medicos_select on public.medicos for select to authenticated using (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.tem_modulo(auth.uid(), 'medicos'))
  or (setor = 'enfermagem' and public.tem_modulo(auth.uid(), 'enfermagem'))
);
create policy medicos_insert on public.medicos for insert to authenticated with check (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.pode_editar(auth.uid(), 'medicos'))
  or (setor = 'enfermagem' and public.pode_editar(auth.uid(), 'enfermagem'))
);
create policy medicos_update on public.medicos for update to authenticated using (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.pode_editar(auth.uid(), 'medicos'))
  or (setor = 'enfermagem' and public.pode_editar(auth.uid(), 'enfermagem'))
) with check (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.pode_editar(auth.uid(), 'medicos'))
  or (setor = 'enfermagem' and public.pode_editar(auth.uid(), 'enfermagem'))
);
create policy medicos_delete on public.medicos for delete to authenticated using (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.pode_editar(auth.uid(), 'medicos'))
  or (setor = 'enfermagem' and public.pode_editar(auth.uid(), 'enfermagem'))
);

drop policy if exists colaboradoras_select on public.colaboradoras;
drop policy if exists colaboradoras_insert on public.colaboradoras;
drop policy if exists colaboradoras_update on public.colaboradoras;
drop policy if exists colaboradoras_delete on public.colaboradoras;
create policy colaboradoras_select on public.colaboradoras for select to authenticated using (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.tem_modulo(auth.uid(), 'colaboradoras'))
  or (setor = 'enfermagem' and public.tem_modulo(auth.uid(), 'enfermagem'))
);
create policy colaboradoras_insert on public.colaboradoras for insert to authenticated with check (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.pode_editar(auth.uid(), 'colaboradoras'))
  or (setor = 'enfermagem' and public.pode_editar(auth.uid(), 'enfermagem'))
);
create policy colaboradoras_update on public.colaboradoras for update to authenticated using (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.pode_editar(auth.uid(), 'colaboradoras'))
  or (setor = 'enfermagem' and public.pode_editar(auth.uid(), 'enfermagem'))
) with check (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.pode_editar(auth.uid(), 'colaboradoras'))
  or (setor = 'enfermagem' and public.pode_editar(auth.uid(), 'enfermagem'))
);
create policy colaboradoras_delete on public.colaboradoras for delete to authenticated using (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.pode_editar(auth.uid(), 'colaboradoras'))
  or (setor = 'enfermagem' and public.pode_editar(auth.uid(), 'enfermagem'))
);

drop policy if exists salas_select on public.salas;
drop policy if exists salas_insert on public.salas;
drop policy if exists salas_update on public.salas;
drop policy if exists salas_delete on public.salas;
create policy salas_select on public.salas for select to authenticated using (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.tem_modulo(auth.uid(), 'salas'))
  or (setor = 'enfermagem' and public.tem_modulo(auth.uid(), 'enfermagem'))
);
create policy salas_insert on public.salas for insert to authenticated with check (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.pode_editar(auth.uid(), 'salas'))
  or (setor = 'enfermagem' and public.pode_editar(auth.uid(), 'enfermagem'))
);
create policy salas_update on public.salas for update to authenticated using (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.pode_editar(auth.uid(), 'salas'))
  or (setor = 'enfermagem' and public.pode_editar(auth.uid(), 'enfermagem'))
) with check (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.pode_editar(auth.uid(), 'salas'))
  or (setor = 'enfermagem' and public.pode_editar(auth.uid(), 'enfermagem'))
);
create policy salas_delete on public.salas for delete to authenticated using (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.pode_editar(auth.uid(), 'salas'))
  or (setor = 'enfermagem' and public.pode_editar(auth.uid(), 'enfermagem'))
);

-- Relação médico-sala: o usuário só pode acessar pares pertencentes ao seu setor.
drop policy if exists medico_salas_select on public.medico_salas;
drop policy if exists medico_salas_insert on public.medico_salas;
drop policy if exists medico_salas_update on public.medico_salas;
drop policy if exists medico_salas_delete on public.medico_salas;
create policy medico_salas_select on public.medico_salas for select to authenticated using (
  public.is_admin(auth.uid())
  or (public.tem_modulo(auth.uid(), 'medicos') and exists (
    select 1 from public.medicos m join public.salas s on s.id = medico_salas.sala_id
    where m.id = medico_salas.medico_id and m.setor = 'operacao' and s.setor = 'operacao'
  ))
  or (public.tem_modulo(auth.uid(), 'enfermagem') and exists (
    select 1 from public.medicos m join public.salas s on s.id = medico_salas.sala_id
    where m.id = medico_salas.medico_id and m.setor = 'enfermagem' and s.setor = 'enfermagem'
  ))
);
create policy medico_salas_insert on public.medico_salas for insert to authenticated with check (
  public.is_admin(auth.uid())
  or (public.pode_editar(auth.uid(), 'medicos') and exists (
    select 1 from public.medicos m join public.salas s on s.id = medico_salas.sala_id
    where m.id = medico_salas.medico_id and m.setor = 'operacao' and s.setor = 'operacao'
  ))
  or (public.pode_editar(auth.uid(), 'enfermagem') and exists (
    select 1 from public.medicos m join public.salas s on s.id = medico_salas.sala_id
    where m.id = medico_salas.medico_id and m.setor = 'enfermagem' and s.setor = 'enfermagem'
  ))
);
create policy medico_salas_update on public.medico_salas for update to authenticated using (
  public.is_admin(auth.uid())
  or (public.tem_modulo(auth.uid(), 'medicos') and exists (select 1 from public.medicos m join public.salas s on s.id = medico_salas.sala_id where m.id = medico_salas.medico_id and m.setor = 'operacao' and s.setor = 'operacao'))
  or (public.tem_modulo(auth.uid(), 'enfermagem') and exists (select 1 from public.medicos m join public.salas s on s.id = medico_salas.sala_id where m.id = medico_salas.medico_id and m.setor = 'enfermagem' and s.setor = 'enfermagem'))
) with check (
  public.is_admin(auth.uid())
  or (public.tem_modulo(auth.uid(), 'medicos') and exists (select 1 from public.medicos m join public.salas s on s.id = medico_salas.sala_id where m.id = medico_salas.medico_id and m.setor = 'operacao' and s.setor = 'operacao'))
  or (public.tem_modulo(auth.uid(), 'enfermagem') and exists (select 1 from public.medicos m join public.salas s on s.id = medico_salas.sala_id where m.id = medico_salas.medico_id and m.setor = 'enfermagem' and s.setor = 'enfermagem'))
);
create policy medico_salas_delete on public.medico_salas for delete to authenticated using (
  public.is_admin(auth.uid())
  or (public.pode_editar(auth.uid(), 'medicos') and exists (select 1 from public.medicos m join public.salas s on s.id = medico_salas.sala_id where m.id = medico_salas.medico_id and m.setor = 'operacao' and s.setor = 'operacao'))
  or (public.pode_editar(auth.uid(), 'enfermagem') and exists (select 1 from public.medicos m join public.salas s on s.id = medico_salas.sala_id where m.id = medico_salas.medico_id and m.setor = 'enfermagem' and s.setor = 'enfermagem'))
);

-- Relação sala-colaboradora: mesma separação por setor.
drop policy if exists sala_colaboradoras_select on public.sala_colaboradoras;
drop policy if exists sala_colaboradoras_insert on public.sala_colaboradoras;
drop policy if exists sala_colaboradoras_update on public.sala_colaboradoras;
drop policy if exists sala_colaboradoras_delete on public.sala_colaboradoras;
create policy sala_colaboradoras_select on public.sala_colaboradoras for select to authenticated using (
  public.is_admin(auth.uid())
  or (public.tem_modulo(auth.uid(), 'salas') and exists (
    select 1 from public.salas s join public.colaboradoras c on c.id = sala_colaboradoras.colaboradora_id
    where s.id = sala_colaboradoras.sala_id and s.setor = 'operacao' and c.setor = 'operacao'
  ))
  or (public.tem_modulo(auth.uid(), 'enfermagem') and exists (
    select 1 from public.salas s join public.colaboradoras c on c.id = sala_colaboradoras.colaboradora_id
    where s.id = sala_colaboradoras.sala_id and s.setor = 'enfermagem' and c.setor = 'enfermagem'
  ))
);
create policy sala_colaboradoras_insert on public.sala_colaboradoras for insert to authenticated with check (
  public.is_admin(auth.uid())
  or (public.pode_editar(auth.uid(), 'salas') and exists (
    select 1 from public.salas s join public.colaboradoras c on c.id = sala_colaboradoras.colaboradora_id
    where s.id = sala_colaboradoras.sala_id and s.setor = 'operacao' and c.setor = 'operacao'
  ))
  or (public.pode_editar(auth.uid(), 'enfermagem') and exists (
    select 1 from public.salas s join public.colaboradoras c on c.id = sala_colaboradoras.colaboradora_id
    where s.id = sala_colaboradoras.sala_id and s.setor = 'enfermagem' and c.setor = 'enfermagem'
  ))
);
create policy sala_colaboradoras_update on public.sala_colaboradoras for update to authenticated using (
  public.is_admin(auth.uid())
  or (public.tem_modulo(auth.uid(), 'salas') and exists (select 1 from public.salas s join public.colaboradoras c on c.id = sala_colaboradoras.colaboradora_id where s.id = sala_colaboradoras.sala_id and s.setor = 'operacao' and c.setor = 'operacao'))
  or (public.tem_modulo(auth.uid(), 'enfermagem') and exists (select 1 from public.salas s join public.colaboradoras c on c.id = sala_colaboradoras.colaboradora_id where s.id = sala_colaboradoras.sala_id and s.setor = 'enfermagem' and c.setor = 'enfermagem'))
) with check (
  public.is_admin(auth.uid())
  or (public.tem_modulo(auth.uid(), 'salas') and exists (select 1 from public.salas s join public.colaboradoras c on c.id = sala_colaboradoras.colaboradora_id where s.id = sala_colaboradoras.sala_id and s.setor = 'operacao' and c.setor = 'operacao'))
  or (public.tem_modulo(auth.uid(), 'enfermagem') and exists (select 1 from public.salas s join public.colaboradoras c on c.id = sala_colaboradoras.colaboradora_id where s.id = sala_colaboradoras.sala_id and s.setor = 'enfermagem' and c.setor = 'enfermagem'))
);
create policy sala_colaboradoras_delete on public.sala_colaboradoras for delete to authenticated using (
  public.is_admin(auth.uid())
  or (public.pode_editar(auth.uid(), 'salas') and exists (select 1 from public.salas s join public.colaboradoras c on c.id = sala_colaboradoras.colaboradora_id where s.id = sala_colaboradoras.sala_id and s.setor = 'operacao' and c.setor = 'operacao'))
  or (public.pode_editar(auth.uid(), 'enfermagem') and exists (select 1 from public.salas s join public.colaboradoras c on c.id = sala_colaboradoras.colaboradora_id where s.id = sala_colaboradoras.sala_id and s.setor = 'enfermagem' and c.setor = 'enfermagem'))
);
