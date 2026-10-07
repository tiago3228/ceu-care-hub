-- Calculadora gestacional para o grupo Salas.
-- A tela não grava dados: a migration só registra menu e permissões.

insert into public.menu_itens
  (chave, grupo, grupo_ordem, rotulo, destino, icone, modulo, ordem, somente_admin)
values
  ('calculadora-gestacional', 'Salas', 20, 'Calculadora', '/calculadora-gestacional', 'Calculator', 'calculadora_gestacional', 60, false)
on conflict (chave) do nothing;

-- Qualquer setor que já recebe o módulo Salas passa a receber também a calculadora.
update public.setores
set permissoes_padrao = array(
  select distinct permissao
  from unnest(coalesce(permissoes_padrao, '{}'::text[]) || array['calculadora_gestacional']::text[]) as p(permissao)
  order by permissao
),
atualizado_em = now()
where 'salas' = any(coalesce(permissoes_padrao, '{}'::text[]));

-- Atualiza usuários já cadastrados nesses setores, sem duplicar permissões.
insert into public.usuario_permissoes (user_id, modulo)
select usuarios.user_id, 'calculadora_gestacional'
from (
  select up.user_id
  from public.usuario_permissoes up
  where up.modulo = 'salas'
  union
  select p.id
  from public.profiles p
  join public.setores s on s.id = p.setor_id
  where 'salas' = any(coalesce(s.permissoes_padrao, '{}'::text[]))
) as usuarios
on conflict (user_id, modulo) do nothing;
