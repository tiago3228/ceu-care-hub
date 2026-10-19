-- Atalho da busca DICOM na área Rede. O módulo é concedido individualmente
-- na administração de usuários; não entra nas permissões pessoais padrão.
insert into public.menu_itens
  (chave, grupo, grupo_ordem, rotulo, destino, icone, modulo, ordem, somente_admin)
values
  ('buscar-imagens', 'Rede', 60, 'Buscar imagens', '/buscar-imagens', 'Search', 'buscar_imagens', 20, false)
on conflict (chave) do update
set grupo = excluded.grupo,
    grupo_ordem = excluded.grupo_ordem,
    rotulo = excluded.rotulo,
    destino = excluded.destino,
    icone = excluded.icone,
    modulo = excluded.modulo,
    ordem = excluded.ordem,
    somente_admin = excluded.somente_admin;
