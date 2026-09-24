-- Separa colaboradores e médicos entre os ambientes Salas e Enfermagem.
alter table if exists public.colaboradoras
  add column if not exists setor text not null default 'operacao';
alter table if exists public.medicos
  add column if not exists setor text not null default 'operacao';

alter table public.colaboradoras drop constraint if exists colaboradoras_setor_check;
alter table public.colaboradoras add constraint colaboradoras_setor_check
  check (setor in ('operacao', 'enfermagem'));
alter table public.medicos drop constraint if exists medicos_setor_check;
alter table public.medicos add constraint medicos_setor_check
  check (setor in ('operacao', 'enfermagem'));

update public.colaboradoras set setor = 'operacao'
where setor is null or setor not in ('operacao', 'enfermagem');
update public.medicos set setor = 'operacao'
where setor is null or setor not in ('operacao', 'enfermagem');

-- Duplica os cadastros atuais com IDs novos para o ambiente Enfermagem.
insert into public.colaboradoras (
  nome, apelido, cargo, tipo_colaboradora, jornada, entrada, saida,
  especialidades, treinamentos, funcoes, observacoes, banco_horas,
  medico_padrao_id, atende_todos_medicos, desativada, status, setor
)
select
  c.nome, c.apelido, c.cargo, c.tipo_colaboradora, c.jornada, c.entrada, c.saida,
  c.especialidades, c.treinamentos, c.funcoes, c.observacoes, c.banco_horas,
  null, c.atende_todos_medicos, c.desativada, c.status, 'enfermagem'
from public.colaboradoras c
where c.setor = 'operacao'
  and not exists (
    select 1 from public.colaboradoras e
    where e.setor = 'enfermagem'
      and lower(trim(e.nome)) = lower(trim(c.nome))
  );

insert into public.medicos (
  nome, apelido, crm, especialidade_principal, especialidades, procedimentos,
  observacoes, necessita_experiente, colaboradora_padrao_id, ativo, setor
)
select
  m.nome, m.apelido, m.crm, m.especialidade_principal, m.especialidades, m.procedimentos,
  m.observacoes, m.necessita_experiente, null, m.ativo, 'enfermagem'
from public.medicos m
where m.setor = 'operacao'
  and not exists (
    select 1 from public.medicos e
    where e.setor = 'enfermagem'
      and lower(trim(e.nome)) = lower(trim(m.nome))
  );

-- Reaponta registros já existentes da escala de enfermagem para as cópias.
update public.escalas_enfermagem escala
set colaboradora_id = copia.id
from public.colaboradoras original
join public.colaboradoras copia
  on copia.setor = 'enfermagem'
 and lower(trim(copia.nome)) = lower(trim(original.nome))
where escala.colaboradora_id = original.id
  and original.setor = 'operacao';

update public.escala_enfermagem_colaboradoras rel
set colaboradora_id = copia.id
from public.colaboradoras original
join public.colaboradoras copia
  on copia.setor = 'enfermagem'
 and lower(trim(copia.nome)) = lower(trim(original.nome))
where rel.colaboradora_id = original.id
  and original.setor = 'operacao';

update public.escala_enfermagem_medicos rel
set medico_id = copia.id
from public.medicos original
join public.medicos copia
  on copia.setor = 'enfermagem'
 and lower(trim(copia.nome)) = lower(trim(original.nome))
where rel.medico_id = original.id
  and original.setor = 'operacao';

update public.atendimentos_enfermagem atendimento
set colaboradora_id = copia.id
from public.colaboradoras original
join public.colaboradoras copia
  on copia.setor = 'enfermagem'
 and lower(trim(copia.nome)) = lower(trim(original.nome))
where atendimento.colaboradora_id = original.id
  and original.setor = 'operacao';

update public.atendimentos_enfermagem atendimento
set medico_id = copia.id
from public.medicos original
join public.medicos copia
  on copia.setor = 'enfermagem'
 and lower(trim(copia.nome)) = lower(trim(original.nome))
where atendimento.medico_id = original.id
  and original.setor = 'operacao';

create index if not exists colaboradoras_setor_ativa_nome_idx
  on public.colaboradoras (setor, desativada, nome);
create index if not exists medicos_setor_ativo_nome_idx
  on public.medicos (setor, ativo, nome);
