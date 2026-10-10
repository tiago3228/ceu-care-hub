-- Segunda fase: opções de horários, aprovação humana e confirmação final.
-- A conclusão só ocorre após o robô devolver protocolo.

alter table public.agendamento_automacao_tarefas
drop constraint if exists agendamento_automacao_tarefas_status_check;

alter table public.agendamento_automacao_tarefas
add constraint agendamento_automacao_tarefas_status_check
check (status in ('aguardando_robo', 'opcoes_disponiveis', 'aguardando_aprovacao', 'aprovada', 'confirmacao_solicitada', 'concluida', 'falhou', 'cancelada'));

comment on column public.agendamento_automacao_tarefas.opcoes_horarios is 'Opções devolvidas pelo robô; nunca representam agendamento confirmado.';
comment on column public.agendamento_automacao_tarefas.horario_escolhido is 'Opção escolhida pela colaboradora e enviada para confirmação humana.';
comment on column public.agendamento_automacao_tarefas.protocolo is 'Preenchido somente após confirmação bem-sucedida no Clinux.';
