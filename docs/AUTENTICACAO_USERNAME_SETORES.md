# Autenticação por Usuário e E-mail

## Regras implementadas

Usuários legados continuam autenticando pelo e-mail já registrado no Supabase Auth. Usuários novos podem autenticar pelo username; o servidor resolve o username para o e-mail Auth antes de chamar `signInWithPassword`. Nenhuma senha é armazenada fora do Supabase Auth.

O cadastro público **Criar Usuário** exige nome completo, username, setor, e-mail e senha. O username é validado, normalizado em minúsculas e protegido por índice único. O cadastro automático está ativo por padrão: o setor define o papel e as permissões padrão, e a conta entra ativa imediatamente.

O administrador pode alterar posteriormente o modo para cadastro pendente na tela **Perfis por Setor**. Nesse modo, a conta é criada, mas permanece inativa até aprovação.

## Reaproveitado

Foram preservados Supabase Auth, recuperação de senha por e-mail, sessões atuais, perfis, papéis, permissões, funções de RLS, tela administrativa de usuários e auditoria existente.

## Criado ou alterado

Foi criada a migration `20260911102000_login_username_setores.sql`, com username, vínculo de setor, tabela de setores, permissões padrão, configuração de aprovação e auditoria específica de autenticação. Foi criado o resolvedor server-side de login e o cadastro público. A sessão agora expõe o username. Foi criada a tela administrativa `Perfis por Setor`, acessível apenas a administradores.

## Validação

Prettier, build de produção, verificação de diferenças e presença da migration foram validados com sucesso. O teste real de login, cadastro, recuperação de senha e RLS depende da aplicação da migration no banco do Lovable e de usuários de teste autenticados.

## Aplicação

Aplicar `supabase/migrations/20260911102000_login_username_setores.sql` no SQL Editor do Lovable. Depois, revisar os setores e permissões padrão em **Perfis por Setor**.
