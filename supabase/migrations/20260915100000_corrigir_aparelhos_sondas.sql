-- Garante que usuários que já possuem o perfil Sondas possam consultar
-- os aparelhos US usados no campo Aparelhos Compatíveis.
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
