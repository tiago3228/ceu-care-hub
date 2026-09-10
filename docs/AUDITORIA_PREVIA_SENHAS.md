# Auditoria técnica prévia — Aba Senhas

**Data:** 10/09/2026  
**Repositório:** `tiago3228/ceu-care-hub`  
**Commit auditado:** `496c6dd` — Adicionou aba Senhas

## 1. Arquitetura encontrada

O projeto é uma aplicação web em TypeScript, React 19, TanStack Router/Start, Vite e Tailwind CSS 4. O backend usa server functions do TanStack Start. O banco é Supabase/PostgreSQL, acessado pelo cliente Supabase no navegador e por um cliente server-side com `service_role` nas operações protegidas. A autenticação é Supabase Auth, com middleware server-side que valida o Bearer token usando `getClaims`. O frontend carrega perfil, papéis e módulos em `useSessao`.

As permissões existentes são modeladas por módulos em `src/lib/modulos.ts`, com perfis `admin_master`, `administrador`, `coordenacao`, `enfermagem`, `secretaria` e `visualizacao`. O shell compartilhado (`AppShell`) organiza navegação, cabeçalho, usuário e ações usando o mesmo padrão visual dos demais módulos. A UI utiliza componentes reutilizáveis Radix/shadcn-like em `src/components/ui`.

## 2. Funcionalidades já implementadas

A aba Senhas já existe em `src/routes/_authenticated/senhas.tsx` e está integrada ao menu por `AppShell`. Já existem:

- listagem de credenciais;
- cadastro e edição;
- confirmação para exclusão;
- pesquisa por nome, URL, login e observações;
- filtro de categoria;
- cópia do login;
- revelação temporária da senha;
- cópia da senha;
- abertura do site;
- validação de campos obrigatórios e URL;
- mensagens de sucesso/erro;
- responsividade básica e componentes visuais compartilhados.

No backend existem `salvarSenha`, `excluirSenha`, `revelarSenha` e `registrarCopiaLogin` em `src/lib/senhas.functions.ts`. A senha é cifrada no servidor em `src/lib/senhas.server.ts` com AES-256-GCM; a chave vem de `SENHAS_CRYPTO_KEY` e não é enviada ao navegador. A auditoria omite `senha_cifrada` nos gatilhos SQL e registra revelação/cópia sem registrar o segredo.

## 3. Banco de dados existente

A migration `20260908123056_f10ca6a4-80ea-4737-a962-55cd72dc2526.sql` já criou `public.senhas` com `id`, `nome`, `url`, `login`, `senha_cifrada`, `observacoes`, `categoria`, `criado_por`, `atualizado_por`, `created_at` e `updated_at`, além de grants, RLS, trigger de atualização e trigger de auditoria. A migration também criou a função `audit_senhas` que remove o campo cifrado dos snapshots.

O banco possui tabelas de autenticação/perfil/permissões, módulos operacionais, `audit_logs`, índices e diversas policies RLS. As funções compartilhadas incluem `is_admin`, `is_master`, `is_ativo`, `tem_modulo` e `pode_editar`.

## 4. Implementação parcial e lacunas

A coluna obrigatória `owner_user_id` não existe. A policy de SELECT existente permite acesso a qualquer registro a qualquer usuário que tenha o módulo `senhas`; portanto, não atende ao isolamento por usuário. O CRUD server-side usa `service_role` e filtra apenas pelo ID, sem validar proprietário nem distinguir administrador de usuário comum.

As permissões existentes são apenas `senhas` e `senhas_revelar`. Não há chaves independentes para adicionar, editar e excluir. A UI usa `pode_editar` de forma agregada. A pesquisa não inclui categoria, embora o requisito determine que inclua.

Também foi identificado que o formulário de edição exige uma nova senha, apesar de o requisito permitir editar os demais dados sem expor a senha já armazenada. A auditoria SQL de INSERT/UPDATE/DELETE existe, mas as ações de cópia/revelação são registradas por server function e precisam permanecer protegidas por proprietário/RLS.

## 5. Riscos identificados

1. **Risco crítico de exposição entre usuários:** a policy de SELECT atual não restringe `senhas` por `criado_por`/proprietário.
2. **Bypass de isolamento no backend:** operações com `service_role` filtram somente pelo ID.
3. **Escopo de permissão amplo:** `senhas` representa visualização e alteração ao mesmo tempo.
4. **Risco operacional de edição:** a tela exige substituição da senha para editar qualquer campo.
5. **Dependência de segredo de ambiente:** sem `SENHAS_CRYPTO_KEY`, o cofre não pode cifrar/decifrar; isso deve ser configurado no ambiente de execução.
6. **Testes de integração limitados:** não há suíte automatizada nem credenciais/banco de teste disponíveis no checkout.

## 6. Testes do sistema atual

A inspeção estática confirmou a presença das rotas autenticadas, middleware, cliente Supabase, CRUDs, auditoria e componentes compartilhados. A tentativa inicial com Bun não foi possível porque `bun`/`bunx` não estão instalados nesta sandbox. Foi iniciada instalação equivalente via npm para executar lint e build; o resultado será registrado na validação final.

Não foi possível executar testes reais de login, logout, usuários, permissões, banco, exportações, auditoria ou responsividade sem um ambiente Supabase conectado, dados de teste e navegador autenticado. A revisão de código não substitui esses testes de integração.

## 7. Plano de correção mínima

- adicionar `owner_user_id` preenchido pelo servidor e não pelo cliente;
- atualizar RLS para usuário comum consultar/alterar/excluir somente o próprio registro e administrador consultar todos;
- aplicar o mesmo isolamento nas server functions que usam `service_role`;
- criar módulos independentes `senhas_adicionar`, `senhas_editar` e `senhas_excluir`, mantendo `senhas` como visualizar e `senhas_revelar` como revelar/copiar;
- incluir categoria na pesquisa;
- permitir edição de metadados sem exigir nova senha, mantendo a senha anterior quando o campo ficar vazio;
- preservar a criptografia e a auditoria sem registrar segredos.

Nenhum código foi alterado antes deste relatório.

## 8. Implementação realizada após a auditoria

Foi criada a migration `supabase/migrations/20260910110000_secure_senhas.sql`. Ela adiciona `owner_user_id` com chave estrangeira para `auth.users`, índices para proprietário e pesquisa, grants necessários e policies RLS separadas para SELECT, INSERT, UPDATE e DELETE. Usuários comuns ficam restritos ao próprio `owner_user_id`; administradores podem visualizar e administrar todos os registros. Registros antigos com `criado_por` são associados automaticamente ao proprietário correspondente.

O catálogo de permissões em `src/lib/modulos.ts` agora contém `senhas`, `senhas_adicionar`, `senhas_editar`, `senhas_excluir` e `senhas_revelar`. A UI passou a renderizar ações conforme cada permissão e a pesquisa também considera categoria. A edição de metadados pode manter a senha anterior quando o campo de senha é deixado vazio.

As server functions em `src/lib/senhas.functions.ts` passaram a validar a permissão específica da ação, verificar administrador, aplicar filtro de proprietário em todas as consultas com `service_role` e rejeitar registros fora do escopo. O segredo continua cifrado em AES-256-GCM e nunca é incluído em auditoria ou listagem. Os tipos Supabase foram atualizados para `owner_user_id`.

## 9. Testes finais

| Verificação | Resultado |
|---|---|
| TypeScript (`npx tsc --noEmit`) | ✅ Funcionando — status 0 |
| Build (`npm run build`) | ✅ Funcionando — status 0 |
| ESLint dos arquivos-fonte alterados | ✅ Funcionando — status 0 |
| `git diff --check` | ✅ Funcionando — status 0 |
| ESLint global do repositório | ⚠️ Não limpo por problemas preexistentes de formatação em muitos arquivos gerados/existentes; não foram corrigidos para evitar alteração ampla fora do escopo |
| Teste real com dois usuários no Supabase/RLS | ⚠️ Não executado: o checkout não fornece ambiente Supabase conectado nem credenciais de teste |
| Login, logout, usuários, CRUDs, relatórios e exportações | ⚠️ Revisados estaticamente; testes de integração dependem de ambiente autenticado |

A build final e o typecheck confirmam que a implementação compila. Não foi possível confirmar por execução contra o banco remoto que a migration já foi aplicada; ela precisa ser executada no projeto Supabase antes do uso em produção. Também é necessário garantir a configuração de `SENHAS_CRYPTO_KEY` no ambiente server-side.

## 10. Arquivos alterados

- `src/routes/_authenticated/senhas.tsx`
- `src/lib/senhas.functions.ts`
- `src/lib/modulos.ts`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/20260910110000_secure_senhas.sql`
- `docs/AUDITORIA_PREVIA_SENHAS.md`

## 11. Conclusão

A funcionalidade pré-existente foi reaproveitada e reforçada, sem reescrever os demais módulos. A principal falha de segurança encontrada — exposição potencial de credenciais entre usuários — foi corrigida em interface, server functions e RLS. A confirmação absoluta de que nenhum módulo existente foi quebrado fica limitada à validação automatizada local: typecheck, build, lint dos arquivos alterados e verificação de diff passaram; testes funcionais completos exigem o ambiente Supabase e usuários de teste.
