-- Garante que todas as salas do setor Salas tenham uma cópia independente em Enfermagem.
-- Cada cópia recebe um novo ID gerado pelo banco e não há tabela de vínculo entre elas.
-- Alterar uma sala em um setor não altera a sala correspondente no outro setor.

insert into public.salas (
  nome,
  unidade,
  especialidade_principal,
  horario_inicio,
  horario_fim,
  ativa,
  recursos,
  observacoes,
  aparelho_id,
  setor
)
select
  salas_operacao.nome,
  salas_operacao.unidade,
  salas_operacao.especialidade_principal,
  salas_operacao.horario_inicio,
  salas_operacao.horario_fim,
  salas_operacao.ativa,
  salas_operacao.recursos,
  salas_operacao.observacoes,
  salas_operacao.aparelho_id,
  'enfermagem'
from public.salas as salas_operacao
where salas_operacao.setor = 'operacao'
  and not exists (
    select 1
    from public.salas as salas_enfermagem
    where salas_enfermagem.setor = 'enfermagem'
      and lower(trim(salas_enfermagem.nome)) = lower(trim(salas_operacao.nome))
  );

create index if not exists salas_setor_nome_idx
  on public.salas (setor, lower(trim(nome)));
