-- Horário de almoço padrão das colaboradoras da operação.
-- Os valores existentes recebem o intervalo padrão solicitado: 12:00–13:12.
alter table public.colaboradoras
  add column if not exists almoco_inicio text,
  add column if not exists almoco_fim text;

update public.colaboradoras
set almoco_inicio = coalesce(almoco_inicio, '12:00'),
    almoco_fim = coalesce(almoco_fim, '13:12');

comment on column public.colaboradoras.almoco_inicio is 'Início do horário de almoço padrão (HH:MM).';
comment on column public.colaboradoras.almoco_fim is 'Fim do horário de almoço padrão (HH:MM).';
