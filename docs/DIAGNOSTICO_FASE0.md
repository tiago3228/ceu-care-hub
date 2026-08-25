# FASE 0 — Diagnóstico do sistema atual (Escala CEU v6.29)

Fonte de verdade: `escala_ceu_v6.29_sondas_ajustes_v3.zip` (pasta `ceu_next/`).

## 1. Estrutura e tecnologias

- Python 3.13 + CustomTkinter/Tkinter (desktop Windows), Pillow, openpyxl, SQLite.
- `main.py` → `criar_tabelas()` → `LoginWindow` → `DashboardWindow`.
- Pastas: `telas/` (17 telas), `services/` (regras), `models/` (parcialmente vazios), `database/banco.py` (681 linhas, cria/migra schema), `database/escala.db` + 2 backups.
- ~12.2k linhas de Python. Telas maiores: `escala_semanal.py` (1501), `medicosold.py` (924), `enfermagem.py` (832), `salas.py` (726), `dashboard.py` (558).
- Serviços vazios (placeholders): `escala_service.py`, `exportacao_service.py`, `alerta_service.py`, `banco_horas_service.py`, `models/treinamento.py`, `telas/especialidades.py`, `telas/treinamentos.py`.
- Extras encontrados: `versiculo_do_dia.py` + tabela `versiculos` (365 registros), exportador de imagem do quadro da escala, exportador Excel/PDF, importadores (itens, médicos, colaboradoras, aparelhos por imagem), preferências de janela em JSON, docs de alterações V6.29.

## 2. Telas / módulos (chaves de permissão em `services/modulos_sistema.py`)

escalas, colaboradoras, medicos, salas, ausencias, banco_horas, notas, aparelhos, configuracoes, materiais, itens, estoque, solicitacoes, enfermagem, sondas, relatorios_enfermagem. Além disso: login, dashboard, especialidades, observações (bloco de notas/alertas), preferências de janela, procedimentos de enfermagem.

## 3. Banco atual — 43 tabelas (volumes reais)

| Tabela | Registros |
|---|---|
| versiculos | 365 |
| itens | 357 |
| escala_colaboradoras | 349 |
| escalas | 257 |
| escala_base_colaboradoras | 208 |
| escala_base | 154 |
| medicos | 84 |
| colaboradoras | 33 |
| aparelhos_ultrassom | 25 |
| salas | 19 |
| colaboradora_medicos_padrao | 14 |
| procedimentos_enfermagem | 8 |
| especialidades | 7 |
| empresas | 3 |
| configuracoes_sistema | 2 |
| ausencias | 2 |
| usuarios | 1 |
| notas | 1 |

Vazias (estrutura existe, dados ainda não): lotes, movimentacoes_estoque, materiais, solicitacoes, solicitacao_itens, pacientes, atendimentos_enfermagem, enf_detalhe_coleta/sinais_vitais/vacina, enfermagem_registros, procedimento_materiais, sondas_desinfeccao, sondas_troca_cuba, sondas_teste_fita, treinamentos, banco_horas, logs_alteracoes, conflitos_detectados, usuario_permissoes, medico_salas, medico_secretarias_favoritas, sala_colaboradoras, aparelhos_configuracoes_gerais.

## 4. Relacionamentos principais

- escalas(data, sala_id, medico_id, horario_inicio/fim, status_compatibilidade, motivo_alerta, observacoes) ↔ escala_colaboradoras(escala_id, colaboradora_id, alerta_ignorado).
- escala_base(dia_semana, periodo, sala_id, medico_id, horários) ↔ escala_base_colaboradoras.
- colaboradoras ↔ colaboradora_medicos_padrao ↔ medicos; medicos.colaboradora_padrao_id; medico_secretarias_favoritas(ordem); medico_salas; sala_colaboradoras; salas.aparelho_id → aparelhos_ultrassom.
- itens → lotes → movimentacoes_estoque (com atendimento_id e solicitacao_item_id, usuario_id/nome).
- solicitacoes → solicitacao_itens (quantidade_solicitada / quantidade_atendida / lote_id).
- pacientes → atendimentos_enfermagem → detalhes (coleta, sinais vitais, vacina); procedimentos_enfermagem → procedimento_materiais.
- ausencias(colaboradora_id, tipo, período, anexo_atestado, medico_id), treinamentos, banco_horas.
- usuarios → usuario_permissoes(modulo); logs_alteracoes (auditoria genérica).

## 5. Regras de negócio confirmadas no código

**Sugestões (`services/sugestao.py`)** — pontuação, nunca bloqueio:
- cadastro explícito (medico_salas; colaboradora médico padrão ou `atende_todos_medicos`) = +10
- frequência histórica escalado(a) junto/na sala = até +5 (teto de 10 escalas)
- já trabalhou no mesmo dia da semana = +2

**Conflitos (`services/conflito_e_auditoria.py`)**: sobreposição de horário em minutos; colaboradora em duas escalas no mesmo dia; médico em outra sala no mesmo horário; alerta confirmável (`escala_colaboradoras.alerta_ignorado`, `escalas.motivo_alerta`).

**Compatibilidade (`services/validacao_requisitos.py`)**: interseção de especialidades colaboradora×médico; `medicos.necessita_experiente` exige treinamento "Experiente"; status verde/amarelo/vermelho salvo em `escalas.status_compatibilidade`.

**Estoque (`services/estoque.py`)**: entrada por lote + movimentação; FEFO ordenando por validade (nulos ao fim) e filtrando vencidos; bloqueio de saída de lote vencido para SAIDA/USO_PACIENTE/ATENDIMENTO_SOLICITACAO salvo `forcar_vencido` ou item sem controle de validade; nunca permite saldo negativo; participa da transação do chamador (tudo-ou-nada com atendimento). Tipos: ENTRADA, SAIDA, AJUSTE, DEVOLUCAO, PERDA, VENCIMENTO, USO_PACIENTE, ATENDIMENTO_SOLICITACAO.

**Validade**: `status_validade` → vencido / alerta / normal usando `configuracoes_sistema.dias_alerta_validade`; também `horario_alerta` para lembretes das notas.

**Auditoria**: `logs_alteracoes` (usuário, tabela, operação INSERT/UPDATE/DELETE/CLONE, registro, JSON antes/depois, data_hora).

**Usuários**: login + senha SHA-256 sem salt (a migrar para hash seguro), perfil "Administrador" (acesso total) vs "Usuário Padrão" (por módulo em `usuario_permissoes`).

## 6. Pontos críticos / riscos

1. Senhas SHA-256 sem salt: não migráveis — usuários precisarão redefinir senha no primeiro acesso.
2. Datas/horas como TEXT: normalizar para date/time no PostgreSQL mantendo exibição DD-MM-AAAA.
3. Campos multivalorados em texto (`colaboradoras.especialidades/treinamentos/funcoes`, `medicos.especialidades/procedimentos`): manter o texto original e, em paralelo, criar tabelas de junção.
4. Permissões só no cliente hoje: no web precisam ser reforçadas no backend + RLS.
5. Sem transações em várias telas; concorrência inexistente (app monousuário).
6. `materiais` e `enfermagem_registros` são legado duplicado de `itens`/`atendimentos_enfermagem` — preservar como leitura histórica, sem virar caminho principal.
7. Tabelas de sondas/estoque/enfermagem vazias: migração é de estrutura, não de dados.
8. Módulo de treinamentos existe no banco mas a tela está vazia — precisa ser construído de fato.

## 7. Arquitetura web proposta (Fase 1)

- Frontend: React + TypeScript + Tailwind, TanStack Router/Query (SPA sobre SSR), busca instantânea, modais, atalhos.
- Backend: server functions tipadas no mesmo projeto, toda regra de negócio no servidor (sugestão, conflito, FEFO, baixa de estoque, auditoria).
- Banco: PostgreSQL (Lovable Cloud) com RLS; funções `SECURITY DEFINER` para papéis; transações para estoque/escala.
- Auth: e-mail/senha + recuperação, usuário ativo/inativo, papéis em tabela separada (`user_roles`) — nunca no perfil.
- Storage: anexos de atestado e exportações.
- Auditoria: tabela append-only, sem UPDATE/DELETE para usuários comuns.

## 8. Estratégia de migração

1. Backup dos 3 arquivos `.db` preservados (nada é apagado).
2. Migrações SQL de schema com IDs preservados (sequences reajustadas por `setval`).
3. Carga por dependência: especialidades, empresas → salas, aparelhos → médicos, colaboradoras → vínculos → escala_base → escalas → itens → configurações → notas → versículos.
4. Validação: contagem por tabela x SQLite, checagem de FKs órfãs, amostragem de escalas com médico/sala/colaboradoras.
5. Senhas não migram (reset obrigatório); usuário master criado no primeiro acesso.
