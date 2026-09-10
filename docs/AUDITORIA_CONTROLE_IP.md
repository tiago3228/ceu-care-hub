# Auditoria e implementação do Controle de IP

## 1. Escopo da auditoria

A auditoria foi realizada antes das alterações para preservar a aplicação existente e evitar duplicação. O projeto atual é uma aplicação web em React 19, TypeScript, Vite e TanStack Start/Router, com Supabase PostgreSQL/Auth, Tailwind CSS, Radix UI, React Query e exportação XLSX por `xlsx`.

A autenticação usa Supabase Auth. A sessão é carregada por `useSessao`, que consulta `profiles`, `user_roles` e `usuario_permissoes`. O acesso funcional é organizado por chaves de módulo em `src/lib/modulos.ts`, enquanto as políticas do banco utilizam as funções existentes `is_admin`, `is_ativo`, `tem_modulo` e `pode_editar`.

## 2. Resultado da auditoria

| Área                    | Resultado    | Observação                                                                                     |
| ----------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| Arquitetura             | ✅ Existente | React/TanStack + Supabase, com rotas baseadas em arquivos.                                     |
| Login e sessão          | ✅ Existente | Supabase Auth e `useSessao`.                                                                   |
| Usuários e permissões   | ✅ Existente | Perfis e permissões por módulo, com administrador privilegiado.                                |
| Auditoria               | ✅ Existente | `audit_logs`, triggers e leitura administrativa.                                               |
| CRUDs                   | ✅ Existente | Padrões reutilizáveis em Ramais, Itens, Salas, Pessoas e outros módulos.                       |
| Pesquisa e filtros      | ✅ Existente | Implementados de forma local em diferentes telas.                                              |
| Relatórios              | ✅ Existente | Relatórios operacionais e exportação de tabelas.                                               |
| Exportação XLSX         | ✅ Existente | Biblioteca `xlsx` já instalada e usada no sistema.                                             |
| Importação XLSX         | ⚠️ Parcial   | Havia dependência e exportações, mas não um importador genérico para inventário de IP.         |
| Controle de IP          | ❌ Ausente   | Não havia rota, tabela, permissões, categorias ou cálculo de IPs livres.                       |
| Inventário de rede      | ❌ Ausente   | Não havia cadastro de equipamentos de rede.                                                    |
| Ping/monitoramento      | ❌ Ausente   | Não havia status ou última verificação para ativos de rede.                                    |
| Dados iniciais enviados | ❌ Ausente   | O anexo contém especificação, mas não uma planilha ou base de equipamentos para carga inicial. |

## 3. O que foi reaproveitado

Foram mantidos os padrões existentes de `AppShell`, componentes UI, `useSessao`, `useQuery`/`useMutation`, mensagens com `sonner`, exportação com `xlsx`, permissões do catálogo de módulos e auditoria baseada em triggers do Supabase. Nenhum CRUD existente foi reescrito ou removido.

## 4. O que foi implementado

Foi criada a rota protegida `/controle-ip`, exibida no menu em um grupo próprio de Rede. A tela contém as categorias Impressoras, Computadores, Servidores, DVR, Wi-Fi, Roteadores, TV Corporativas, Switch, ATL e Relógio de Ponto, além da visão geral e da aba de IPs livres.

O cadastro possui unidade, categoria, IP, nome, local, andar, setor, patrimônio, modelo, fabricante, MAC, porta, observações, status e data da última verificação. A unidade é detectada automaticamente pelo segundo octeto: `192.168.0.x` resulta em MATRIZ e `192.168.1.x` resulta em MN.

A tela inclui pesquisa rápida, filtros por unidade e categoria, cadastro, edição, exclusão, exportação XLSX, importação XLSX/CSV com validação de IP e upsert por IP, status online/offline/não verificado, atualização manual e cálculo das faixas livres `.1` a `.254`. Clicar em um IP livre inicia o fluxo de reserva, que o grava no inventário e o remove da lista de livres.

Foi criada uma migração Supabase com a tabela `public.controle_ip`, índices, unicidade para IP preenchido, RLS, normalização automática de unidade, atualização de usuário/data e trigger de auditoria. A tabela usa a estrutura normalizada solicitada, em vez de criar uma tabela diferente para cada categoria.

## 5. Tabelas e permissões

A nova tabela é `public.controle_ip`. O histórico é gravado na tabela já existente `public.audit_logs`.

Foram adicionadas as chaves de permissão:

- `controle_ip` — visualizar;
- `controle_ip_adicionar` — adicionar e importar;
- `controle_ip_editar` — editar e atualizar status;
- `controle_ip_excluir` — excluir.

Administradores mantêm acesso integral por meio das regras existentes de administração. A migração também aplica RLS para impedir acesso de usuários sem a permissão correspondente.

## 6. Testes e validações

| Validação                                | Resultado                                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Instalação das dependências              | ✅ Concluída com `pnpm install --no-frozen-lockfile`.                                                                                     |
| Build do sistema antes da implementação  | ✅ Passou.                                                                                                                                |
| Build após a implementação               | ✅ Passou com a nova rota e a árvore de rotas gerada.                                                                                     |
| `git diff --check`                       | ✅ Passou, sem erros de whitespace.                                                                                                       |
| Lint focado nos arquivos novos/alterados | ✅ O arquivo novo foi formatado com Prettier; os arquivos alterados não introduziram falhas de compilação.                                |
| Lint completo do repositório             | ⚠️ Já falhava antes da implementação por diversos erros de Prettier em módulos existentes, incluindo Estoque, Relatórios, Salas e outros. |
| Teste de autenticação real               | ⚠️ Não executado no sandbox porque exige sessão de usuário real.                                                                          |
| Teste de RLS e triggers em banco remoto  | ⚠️ Não aplicado automaticamente ao projeto Supabase; a migração foi preparada para sincronização pelo Lovable.                            |
| Teste manual de todos os módulos         | ⚠️ Não há suíte E2E configurada e o sandbox não possui credenciais de navegação da aplicação.                                             |

O build é a validação automatizada disponível e passou. A limitação do lint completo e dos testes de sessão/banco remoto está explicitada para não declarar como executado um teste que exigiria acesso externo ou dados reais.

## 7. Arquivos alterados

- `src/routes/_authenticated/controle-ip.tsx`
- `src/components/AppShell.tsx`
- `src/lib/modulos.ts`
- `src/routeTree.gen.ts` (gerado pelo build/roteador)
- `supabase/migrations/20260910130000_controle_ip.sql`
- `docs/AUDITORIA_CONTROLE_IP.md`

Nenhum módulo existente foi removido. A compatibilidade foi preservada pela reutilização do shell, dos componentes e do modelo atual de permissões.

## 8. Validação final solicitada

A consulta direta ao Supabase conectado foi executada em 10/09/2026 e retornou `HTTP 404 PGRST205`: a relação `public.controle_ip` ainda não existe no schema remoto. Também foi verificado o anexo recebido e o repositório local; não existe planilha, CSV ou outro arquivo com os IPs fornecidos para carga inicial. Consequentemente, a quantidade importada por categoria não pode ser informada como número real: **Impressoras: não verificável; Computadores: não verificável; Servidores: não verificável; DVR: não verificável; WiFi: não verificável; Roteadores: não verificável; TV Corporativas: não verificável; Switch: não verificável; ATL: não verificável; Relógio de Ponto: não verificável**. Não seria correto inventar contagens ou declarar que os dados foram importados.

A interface agora possui duas abas independentes, **IP Livre MATRIZ** para `192.168.0.1`–`192.168.0.254` e **IP Livre MN** para `192.168.1.1`–`192.168.1.254`. Os IPs usados são removidos do cálculo e os IPs livres podem iniciar uma reserva.

O ping atual é executado no **frontend**, pelo navegador, usando uma requisição HTTP `fetch` em modo `no-cors` para o endereço `http://IP`. O timeout é de **2.500 ms**. O resultado é persistido em `status_online` e `ultima_verificacao`, e o trigger do banco registra a atualização em `audit_logs`. Há ping individual pelo botão de cada linha, ping em lote para os registros filtrados e atualização automática em intervalo de **60 segundos**. A atualização manual da lista pode ser acionada pelo botão Atualizar. Como é uma sondagem HTTP no navegador, ela não equivale a ICMP e pode ser afetada por firewall, HTTP inexistente, HTTPS/mixed content ou políticas de rede; para um ping ICMP real seria necessário um backend/Edge Function autorizado na rede da clínica.

O dashboard inicial passou a exibir total, online, offline, IPs livres, distribuição por MATRIZ/MN, status operacional e contagem por todas as dez categorias. A exportação possui XLSX e CSV, e ambas registram a operação como `EXPORT`; a importação registra `IMPORT` e usa upsert por IP. O código compartilhado aplica o mesmo CRUD a todas as categorias, em vez de duplicar dez implementações.

Foram executadas as seguintes validações locais: build completo após as alterações (**passou**), Prettier focado no módulo (**passou**), `git diff --check` (**passou**), presença das duas abas, presença do ping individual/em lote/automático, timeout de 2.500 ms, exportações XLSX/CSV, importação e dashboard (**passou por inspeção estática**). CRUD, importação real, exportação real, permissões RLS e contagens por categoria **não puderam ser executados contra dados reais** enquanto a migração não for aplicada no Supabase e uma planilha de carga não for disponibilizada. Portanto, esta validação final identifica o módulo como **não concluído operacionalmente no ambiente remoto**, embora o código esteja compilando e preparado para a sincronização.

## 9. Extensão da categoria Computadores

A categoria Computadores recebeu os campos `unidade`, `local/setor` obrigatório, `andar`, `nome`, `usuario_responsavel`, `ip`, `mac_address`, `anydesk`, `patrimonio_cpu`, `patrimonio_monitor`, `sistema_operacional`, `observacoes` e `status_online`. A pesquisa inclui IP, nome do computador, usuário responsável, patrimônio da CPU/monitor, AnyDesk e Local/Setor.

Cada registro de computador pode usar as ações **Copiar IP**, **Copiar AnyDesk** e **Conectar AnyDesk**. A conexão copia o ID para a área de transferência e tenta abrir `anydesk://ID`. Em navegador sem associação ao aplicativo, o usuário recebe orientação para colar o ID no AnyDesk. As operações de cadastro, edição, exclusão e ping continuam protegidas pelas permissões e pelos triggers de auditoria existentes.

A migration incremental é `supabase/migrations/20260910160000_controle_ip_computadores.sql`. Ela adiciona os campos específicos e índices para usuário, AnyDesk e patrimônios.
