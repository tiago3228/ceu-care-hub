-- Perfil funcional para equipe que administra sondas, senhas, ramais e notas.
-- A lista final de módulos é aplicada pela tela Usuários e permissões.
alter type public.app_role add value if not exists 'sondas';
