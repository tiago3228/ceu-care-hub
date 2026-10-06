-- Permissão específica para visualizar e resolver pendências de validade.
-- Por padrão, fica disponível apenas para setores/perfis de enfermagem;
-- administradores continuam com acesso automático.
update public.setores
set permissoes_padrao = array(
  select distinct permissao
  from unnest(permissoes_padrao || array['pendencias_validade_visualizar']::text[]) as permissao
)
where papel_padrao = 'enfermagem';

insert into public.usuario_permissoes (user_id, modulo)
select usuarios.user_id, 'pendencias_validade_visualizar'
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
on conflict (user_id, modulo) do nothing;
