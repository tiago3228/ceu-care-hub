-- Adiciona a área de Laudos ao menu Salas para instalações com menu configurável.
-- Não sobrescreve uma personalização já existente feita por um administrador.
insert into public.menu_itens
  (chave, grupo, grupo_ordem, rotulo, destino, icone, modulo, ordem, somente_admin)
values
  ('laudos', 'Salas', 20, 'Laudos', '/laudos', 'ClipboardList', 'salas', 45, false)
on conflict (chave) do nothing;
