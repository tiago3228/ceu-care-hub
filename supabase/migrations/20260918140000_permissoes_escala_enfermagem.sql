-- Permissões específicas para a escala semanal do setor de enfermagem.
-- Acesso operacional limitado a usuários do perfil/setor de enfermagem.

update public.setores
set permissoes_padrao = array(
  select distinct permissao
  from unnest(
    permissoes_padrao || array['escala_enfermagem_visualizar', 'escala_enfermagem_editar']::text[]
  ) as permissao
)
where papel_padrao = 'enfermagem';

insert into public.usuario_permissoes (user_id, modulo)
select usuarios.user_id, permissoes.modulo
from (
  select ur.user_id
  from public.user_roles ur
  where ur.role = 'enfermagem'
  union
  select p.id
  from public.profiles p
  join public.setores s on s.id = p.setor_id
  where s.papel_padrao = 'enfermagem'
) as usuarios
cross join (
  values
    ('escala_enfermagem_visualizar'),
    ('escala_enfermagem_editar')
) as permissoes(modulo)
on conflict (user_id, modulo) do nothing;

grant select, insert, update, delete on public.escalas_enfermagem to authenticated;
grant all on public.escalas_enfermagem to service_role;
alter table public.escalas_enfermagem enable row level security;

drop policy if exists escalas_enfermagem_select on public.escalas_enfermagem;
drop policy if exists escalas_enfermagem_insert on public.escalas_enfermagem;
drop policy if exists escalas_enfermagem_update on public.escalas_enfermagem;
drop policy if exists escalas_enfermagem_delete on public.escalas_enfermagem;

create policy escalas_enfermagem_select
on public.escalas_enfermagem for select to authenticated
using (
  (public.is_admin(auth.uid()) or public.has_role(auth.uid(), 'enfermagem'))
  and public.tem_modulo(auth.uid(), 'escala_enfermagem_visualizar')
);

create policy escalas_enfermagem_insert
on public.escalas_enfermagem for insert to authenticated
with check (
  (public.is_admin(auth.uid()) or public.has_role(auth.uid(), 'enfermagem'))
  and public.pode_editar(auth.uid(), 'escala_enfermagem_editar')
);

create policy escalas_enfermagem_update
on public.escalas_enfermagem for update to authenticated
using (
  (public.is_admin(auth.uid()) or public.has_role(auth.uid(), 'enfermagem'))
  and public.pode_editar(auth.uid(), 'escala_enfermagem_editar')
)
with check (
  (public.is_admin(auth.uid()) or public.has_role(auth.uid(), 'enfermagem'))
  and public.pode_editar(auth.uid(), 'escala_enfermagem_editar')
);

create policy escalas_enfermagem_delete
on public.escalas_enfermagem for delete to authenticated
using (
  (public.is_admin(auth.uid()) or public.has_role(auth.uid(), 'enfermagem'))
  and public.pode_editar(auth.uid(), 'escala_enfermagem_editar')
);
