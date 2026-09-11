# Edição de colaboradores

O painel **Usuários e permissões** agora permite ao administrador editar nome, username, e-mail, setor, situação ativa/inativa e senha de qualquer colaborador. A alteração é feita server-side usando Supabase Auth para o e-mail e a senha, e `profiles`, `user_roles` e `usuario_permissoes` para os dados da aplicação. A senha nunca é gravada em texto puro e a ação é registrada em `auditoria_autenticacao` sem registrar o valor da senha.

A lista pública de setores do cadastro passou a ser carregada por uma função server-side com service role, evitando que um erro de RLS ou tipos desatualizados seja silenciosamente transformado em uma lista vazia. A tela também informa quando os setores estão carregando ou quando a migration ainda não foi aplicada.

Para a funcionalidade funcionar no banco do Lovable, aplique a migration `20260911102000_login_username_setores.sql`. O usuário mestre continua sendo reconhecido pelo papel `admin_master` ou `administrador`; não há regra hardcoded por e-mail.
