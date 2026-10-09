-- Assistente rápido de agendamento para o setor de Marcação.
-- A disponibilidade final continua sendo conferida no Clinux.

insert into public.menu_itens (chave, grupo, grupo_ordem, rotulo, destino, icone, modulo, ordem, somente_admin)
values ('agendamento-marcacao', 'Marcação', 50, 'Agendamento', '/agendamento-marcacao', 'CalendarHeart', 'agendamento_marcacao', 37, false)
on conflict (chave) do update set
  grupo = excluded.grupo,
  grupo_ordem = excluded.grupo_ordem,
  rotulo = excluded.rotulo,
  destino = excluded.destino,
  icone = excluded.icone,
  modulo = excluded.modulo,
  ordem = excluded.ordem,
  somente_admin = excluded.somente_admin;

insert into public.usuario_permissoes (user_id, modulo)
select p.id, 'agendamento_marcacao'
from public.profiles p
where p.ativo = true
  and lower(replace(replace(coalesce(p.setor, ''), 'ã', 'a'), 'ç', 'c')) = 'marcacao'
on conflict (user_id, modulo) do nothing;

-- Administradores mantêm acesso para configurar e validar o recurso.
insert into public.usuario_permissoes (user_id, modulo)
select p.id, 'agendamento_marcacao'
from public.profiles p
where p.ativo = true
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p.id
      and ur.role in ('admin_master'::public.app_role, 'administrador'::public.app_role)
  )
on conflict (user_id, modulo) do nothing;
