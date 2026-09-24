-- Separa o cadastro de salas entre os setores de Salas/Operação e Enfermagem.
alter table if exists public.salas
  add column if not exists setor text not null default 'operacao';

alter table public.salas
  drop constraint if exists salas_setor_check;

alter table public.salas
  add constraint salas_setor_check check (setor in ('operacao', 'enfermagem'));

-- O cadastro existente permanece em Salas/Operação.
update public.salas
set setor = 'operacao'
where setor is null or setor not in ('operacao', 'enfermagem');

-- Duplica as salas existentes para Enfermagem, com IDs próprios.
insert into public.salas (
  nome, unidade, especialidade_principal, horario_inicio, horario_fim,
  ativa, recursos, observacoes, aparelho_id, setor
)
select
  s.nome, s.unidade, s.especialidade_principal, s.horario_inicio, s.horario_fim,
  s.ativa, s.recursos, s.observacoes, s.aparelho_id, 'enfermagem'
from public.salas s
where s.setor = 'operacao'
  and not exists (
    select 1 from public.salas enfermagem
    where enfermagem.setor = 'enfermagem'
      and lower(enfermagem.nome) = lower(s.nome)
  );

create index if not exists salas_setor_ativa_idx on public.salas (setor, ativa, nome);
