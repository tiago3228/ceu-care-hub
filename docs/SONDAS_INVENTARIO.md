# Submódulo Sondas (Transdutores)

## Auditoria e reaproveitamento

O sistema já possuía a rota `Sondas`, dedicada aos registros operacionais de desinfecção, teste de fita e troca de cuba. Essa funcionalidade foi preservada. O inventário técnico foi incorporado como uma nova aba **Inventário técnico**, reutilizando `AppShell`, abas Radix, diálogos, tabelas, badges, inputs, filtros, exportação XLSX e o sistema global de permissões e lembretes.

## Criado

Foi criada a migration `20260911100000_sondas_inventario.sql`, contendo as tabelas `sondas`, `sondas_equipamentos`, `sondas_ocorrencias` e `sondas_documentos`, índices, trigger de atualização, grants e políticas RLS. O relacionamento entre sondas e aparelhos de US é N:N e usa a tabela de associação. As permissões `sondas_adicionar`, `sondas_editar`, `sondas_excluir`, `sondas_relatorios` e `sondas_manutencao` foram adicionadas ao catálogo TypeScript.

A ficha técnica contempla identificação, modelo, fabricante, tipo, serial, patrimônio, ano de fabricação, frequência, ANVISA, localização, sala, setor, aquisição, garantia, status, manutenção, empresa e contato técnico, observações e aparelhos compatíveis. A tela oferece pesquisa, filtros por tipo e status, indicadores, cadastro, edição, exclusão, registro de ocorrências, CSV, XLSX e impressão para PDF pelo navegador.

Ao salvar uma próxima manutenção, é criado um lembrete 30 dias antes quando o usuário possui a permissão de inclusão de lembretes. As criações, alterações, exclusões e ocorrências passam pelo log de auditoria server-side.

## Validação executada

A formatação Prettier foi validada, `git diff --check` não encontrou problemas e o build de produção foi concluído com sucesso. A validação real de CRUD, vínculos, RLS, permissões e aplicação da migration no banco do Lovable depende da execução da migration no SQL Editor e de uma sessão autenticada com usuários de teste; esses passos não podem ser simulados com segurança apenas no sandbox sem as credenciais do banco.

## Aplicação no Lovable

Aplicar o conteúdo de `supabase/migrations/20260911100000_sondas_inventario.sql` no SQL Editor do Lovable. Depois, atribuir as permissões ao perfil ou usuários desejados em Configurações. Administradores continuam com acesso total pelas políticas RLS.
