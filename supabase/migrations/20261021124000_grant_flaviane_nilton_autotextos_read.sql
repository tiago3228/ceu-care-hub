-- Exceção restrita para Flaviane Souza consultar a biblioteca de autotextos
-- do médico ao qual está associada. A policy concede somente SELECT.
drop policy if exists laudos_autotextos_select_flaviane_nilton
  on public.laudos_autotextos;

create policy laudos_autotextos_select_flaviane_nilton
  on public.laudos_autotextos
  for select
  to authenticated
  using (
    auth.uid() = 'b9a78794-17a8-440a-a893-c447f7a934c5'::uuid
    and public.tem_modulo(auth.uid(), 'laudos')
    and medico_id = 81
    and exists (
      select 1
      from public.laudos_medicos lm
      where lm.medico_id = laudos_autotextos.medico_id
    )
  );
