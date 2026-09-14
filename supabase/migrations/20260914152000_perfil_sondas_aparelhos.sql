-- O inventário de sondas consulta equipamentos_us para listar aparelhos compatíveis.
-- Libera somente leitura dessa tabela para usuários já vinculados ao perfil Sondas.
insert into public.usuario_permissoes (user_id, modulo)
select ur.user_id, 'equipamentos_us'
from public.user_roles ur
where ur.role::text = 'sondas'
  and not exists (
    select 1
    from public.usuario_permissoes up
    where up.user_id = ur.user_id
      and up.modulo = 'equipamentos_us'
  );
