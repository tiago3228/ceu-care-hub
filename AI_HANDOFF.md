# AI Handoff — recuperação do CEU Care Hub

**Atualizado em:** 7 de outubro de 2026
**Repositório:** `tiago3228/ceu-care-hub`
**Projeto Lovable:** Clínica CEU Gestão

## Estado atual

- A PR [#1 — Recuperar snapshot do CEU Care Hub de 1º de outubro](https://github.com/tiago3228/ceu-care-hub/pull/1) foi mesclada normalmente em `main` em 7/10/2026.
- Merge commit: `33e9e78810cb2b93a3ab71d1068de3f4e123ed6d`.
- A árvore do merge (`0489033d3515fefad2d156836767f26f5cf369b3`) é idêntica à do snapshot saudável `20234934b059019025d4bd56bda77614288edccd` de 1º/10/2026.
- Não houve force-push, rebase, publicação do site, deploy ou alteração de dados de produção.
- A branch conectada no Lovable foi trocada para `main`; o botão **Re-check** confirmou “In sync with GitHub”.
- O Lovable Preview carregou as rotas `/dashboard`, `/enfermagem`, `/senhas`, `/escala` e `/estoque`. Escala e Enfermagem mostraram estado vazio para o período selecionado; Estoque exibiu itens e alertas; Senhas exibiu registros com os valores de senha mascarados. Nenhum registro foi criado, editado, excluído, revelado ou copiado durante a verificação.
- A tela do Lovable ainda oferece **Publicar** e indica alterações não publicadas. **Não publicar sem pedido explícito.**

## Referências de segurança e preservação

- `recovery/last-good-before-2026-10-06` aponta para o snapshot original saudável `20234934...`.
- `backup/lovable-pre-rollback-2026-10-06` preserva o commit Lovable `a0a2df0853f1d3144bff6c381e88ed69a6d6c27d` (“Adicionou aba Senhas”). Essa branch conserva a versão completa pré-restauração, mas **não** é a versão saudável de 1º/10.
- `backup/lovable-pending-2026-10-06` continua em `683f7c76...`, o antigo estado de restauração.
- O snapshot de 1º/10 já contém a rota e a implementação de Senhas, bem como `supabase/migrations/20260910110000_secure_senhas.sql`.
- **Não mesclar nem cherry-pickar o commit `a0a2df0` inteiro.** A comparação mostrou que ele remove a migration de segurança e enfraquece o escopo de propriedade/permissões, além de remover registros de auditoria para operações de criação, edição e exclusão. A branch de backup deve ser usada como fonte para inspeção seletiva caso o usuário peça uma correção específica; revisar segurança e testes antes de reaplicar qualquer trecho.

## Próximas ações

1. Manter as branches de recuperação/backup até o usuário confirmar que não precisa mais delas.
2. Aguardar revisão do usuário da prévia em `main` antes de qualquer publicação.
3. Se for necessário reaplicar alguma parte do trabalho de Senhas, fazê-lo em commit novo, seletivo e revisado — nunca restaurar a árvore de `a0a2df0` inteira.

## Observação de sincronização

`AGENTS.md` informa que commits enviados à branch conectada são refletidos no Lovable. Este arquivo é apenas documentação de coordenação; não altera o código funcional do snapshot.
