# Aparelhos de US / Equipamentos

## Auditoria inicial

O sistema já possuía a tabela básica `aparelhos_ultrassom`, usada para associar aparelhos a salas, além do Controle de IP, módulo de Lembretes, auditoria, permissões e módulo de Senhas. Não havia uma tela de ficha técnica completa para equipamentos médicos. O cadastro anterior foi preservado para não alterar o funcionamento das salas.

## O que foi criado

Foi criada a tabela `equipamentos_us` com identificação, localização, dados técnicos, patrimônio, serial, rede, DICOM, Worklist, AETitle, credenciais, manutenção, contrato, status e observações. Também foram criadas tabelas de histórico e documentos para suportar evolução e anexos técnicos.

Os campos prioritários **Voltagem** e **Gravação** foram adicionados à ficha e à listagem. Voltagem permite selecionar 110 V ou 220 V; Gravação permite marcar se o equipamento grava ou não.

A nova aba contém pesquisa por nome, patrimônio, serial, modelo, fabricante, localização, IP e AETitle; filtros por localização, modelo, manutenção e presença de IP; indicadores; listagem; cadastro/edição; exclusão; exportação CSV; status calculado por manutenção; e criação opcional de um lembrete de manutenção.

## Segurança

A senha não é enviada para a listagem. O servidor cifra a senha usando a mesma camada do módulo de Senhas. Revelação e cópia exigem `equipamentos_us_visualizar_senhas` e geram auditoria sem registrar a senha em texto aberto. O banco aplica RLS e as ações server-side validam permissões antes de operar.

## Aplicação

Executar `supabase/migrations/20260911084000_equipamentos_us.sql` no SQL Editor do Lovable. Depois atribuir as permissões `equipamentos_us`, `equipamentos_us_adicionar`, `equipamentos_us_editar`, `equipamentos_us_excluir`, `equipamentos_us_visualizar_senhas`, `equipamentos_us_relatorios` e `equipamentos_us_manutencao` conforme o perfil.

A tabela de documentos e o histórico já estão preparados no banco; a interface de upload de arquivos deverá ser habilitada depois que o bucket de armazenamento do projeto for definido no Lovable.
