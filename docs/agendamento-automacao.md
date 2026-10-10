# Automação de agendamento — piloto

## Objetivo

Esta primeira fase cria uma fila segura para o setor de Marcação enviar uma consulta de horários ao futuro robô do Clinux. A tela consulta as particularidades do médico, bloqueia conflitos conhecidos e exige aprovação humana antes de qualquer ação definitiva.

**Nenhuma tarefa altera o Clinux nesta fase sem que o webhook e o robô sejam configurados.**

## Fluxo implementado

1. A colaboradora pesquisa no CEU Care Hub.
2. As regras do médico são cruzadas com exame, convênio, idade, turno e solicitante.
3. Bloqueios conhecidos impedem o envio da tarefa.
4. A colaboradora abre **Consultar horários** e envia a tarefa.
5. O registro é salvo em `agendamento_automacao_tarefas`.
6. Um evento é salvo em `agendamento_automacao_logs`.
7. Se `AUTOMACAO_AGENDAMENTO_WEBHOOK_URL` existir no ambiente do servidor, a tarefa é enviada ao Activepieces/n8n.
8. A tarefa fica aguardando as opções de horários do robô.
9. A aprovação humana e o retorno do protocolo serão as próximas etapas de homologação.

## Evento enviado ao webhook

`POST $AUTOMACAO_AGENDAMENTO_WEBHOOK_URL`

Headers:

- `content-type: application/json`
- `x-ceucare-event: agendamento.tarefa.criada`

Payload:

```json
{
  "tarefaId": "uuid-da-tarefa",
  "status": "aguardando_robo",
  "medico_id": "id-da-base",
  "medico_nome": "Nome do médico",
  "exame": "Exame solicitado",
  "convenio": "Unimed",
  "idade": 45,
  "turno": "Manhã",
  "solicitante": "Médico solicitante",
  "dados_validacao": {
    "alertas": [],
    "examesEncontrados": ["US Mamas"],
    "particularidadesConsultadas": true,
    "disponibilidadeClinux": "a_consultar_pelo_robo"
  },
  "criado_por": "uuid-do-usuario"
}
```

## Contrato esperado do robô na próxima fase

O Activepieces/n8n deverá consultar o Clinux em ambiente de homologação e devolver apenas opções de horário, sem confirmar o agendamento:

```json
{
  "tarefaId": "uuid-da-tarefa",
  "status": "opcoes_disponiveis",
  "opcoes_horarios": [
    {
      "data": "2026-10-15",
      "hora": "08:30",
      "medico": "Nome do médico",
      "unidade": "Unidade",
      "referencia": "id-da-consulta-no-clinux"
    }
  ],
  "referencia_externa": "execucao-do-robo"
}
```

Depois da aprovação humana, o robô poderá receber um segundo evento para confirmar uma opção específica e retornar:

```json
{
  "tarefaId": "uuid-da-tarefa",
  "status": "concluida",
  "protocolo": "PROTOCOLO-123",
  "horario_escolhido": {
    "data": "2026-10-15",
    "hora": "08:30"
  },
  "referencia_externa": "id-do-agendamento-no-clinux"
}
```

## Banco de dados

A migration `20261010010000_agendamento_automacao_fila.sql` cria:

- `agendamento_automacao_tarefas`: estado, dados da solicitação, opções, protocolo e responsáveis;
- `agendamento_automacao_logs`: trilha de auditoria por evento;
- RLS restrito à permissão `agendamento_marcacao_automacao`;
- Menu e permissão padrão para usuários ativos do setor de Marcação e administradores.

## Segurança

- O webhook é chamado somente no servidor; nenhuma URL ou segredo vai para o navegador.
- A fila não executa o Clinux por conta própria.
- Tarefas com bloqueios conhecidos não são enviadas.
- O robô deve operar primeiro em homologação.
- O agendamento definitivo deve ter aprovação humana e gerar protocolo auditável.
- Não colocar credenciais do Clinux no Supabase ou no frontend; usar cofre de segredos do executor do robô.
