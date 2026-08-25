# Migração de dados (SQLite -> Lovable Cloud/PostgreSQL)

IDs originais preservados em todas as tabelas migradas.

| Tabela | Registros |
|---|---|
| especialidades | 7 |
| empresas | 3 |
| aparelhos_ultrassom | 25 |
| salas | 19 |
| medicos | 84 |
| colaboradoras | 33 |
| colaboradora_medicos_padrao | 14 |
| escalas | 257 |
| escala_colaboradoras | 30 |
| escala_base | 154 |
| escala_base_colaboradoras | 8 |
| ausencias | 2 |
| itens | 357 |
| procedimentos_enfermagem | 8 |
| notas | 1 |
| versiculos | 365 |

## Inconsistências encontradas no banco antigo (921 referências órfãs)

O SQLite não tinha chaves estrangeiras, então existem vínculos apontando para
registros já excluídos. Nada foi descartado silenciosamente:

- `escalas.sala_id` e `escala_base.sala_id`: salas 19 a 35 não existem mais na
  tabela `salas` (só 1-18 e 36). Os registros foram migrados com a sala em branco.
- `escala_colaboradoras` / `escala_base_colaboradoras`: colaboradoras 1, 32-67
  (exceto as ativas) não existem mais em `colaboradoras`; esses vínculos não
  podiam ser recriados (319 + 200 linhas).
- `medicos.colaboradora_padrao_id`: valor 14 (colaboradora inexistente) ignorado.

Ação sugerida: ao revisar a escala semanal, reatribuir sala/colaboradora nesses
registros históricos. Nenhum dado válido foi perdido na migração.

## Senhas

O sistema antigo usava SHA-256 sem salt, incompatível com o login seguro atual.
O primeiro acesso cria o administrador master; os demais usuários recebem senha
inicial da coordenação e podem usar "Esqueci minha senha".
