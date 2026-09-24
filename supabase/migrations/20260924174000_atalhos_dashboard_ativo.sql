-- Permite que cada usuário remova/oculte cards padrão do dashboard sem alterar os demais usuários.
alter table public.atalhos_dashboard_usuario
  add column if not exists ativo boolean not null default true;

create index if not exists atalhos_dashboard_usuario_ativos_idx
  on public.atalhos_dashboard_usuario (usuario_id, ativo, ordem);
