# Corrigir erro "duplicate key" ao salvar escala

## O que está acontecendo

Ao migrar os dados do sistema antigo, os registros foram inseridos mantendo os IDs originais. Porém os contadores automáticos de ID do banco não foram avançados junto. Na tabela de escalas existem 257 registros (maior ID = 257), mas o contador está em 10 — então o banco tenta criar a próxima escala com um ID já ocupado e rejeita com "duplicate key value violates unique constraint escalas_pkey".

Isso não é um problema da tela de escala: qualquer tabela migrada com IDs preservados tem o mesmo risco (médicos, colaboradoras, salas, itens, lotes, pacientes, atendimentos, solicitações, etc.).

## Correção

Uma migração única que, para todas as tabelas com ID automático, reposiciona o contador para o maior ID já existente. Assim o próximo cadastro recebe um número livre.

- Percorre todas as tabelas do banco que usam contador automático de ID.
- Ajusta cada contador para o maior ID atual (ou reinicia em 1 quando a tabela está vazia).
- Inclui também o contador do número de prontuário dos pacientes, alinhando-o ao maior prontuário já gerado.

Nenhum dado é alterado, apagado ou renumerado — só o contador interno.

## Detalhes técnicos

Bloco `DO $$` iterando `pg_get_serial_sequence` de cada tabela do schema `public` com coluna identidade/serial, aplicando `setval(seq, coalesce(max(id),0)+1, false)`. Tratamento separado para `prontuario_seq` (sequência independente usada pelo trigger `gerar_prontuario`), usando `max(prontuario::bigint)` sobre valores numéricos.

## Verificação

Após aplicar, conferir que `escalas_id_seq` está acima de 257 e salvar uma nova escala na tela para confirmar que o erro desapareceu.
