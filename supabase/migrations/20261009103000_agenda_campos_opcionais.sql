-- Permite salvar um registro da Minha Agenda mesmo sem preencher os campos do formulário.
-- user_id, created_by e status continuam protegidos pela identidade, RLS e valor padrão.
alter table public.agenda_marcacao
  alter column nome_paciente drop not null,
  alter column telefone drop not null,
  alter column exame drop not null,
  alter column data_prevista drop not null;

comment on column public.agenda_marcacao.nome_paciente is 'Nome do paciente (opcional).';
comment on column public.agenda_marcacao.telefone is 'Telefone (opcional).';
comment on column public.agenda_marcacao.exame is 'Exame (opcional).';
comment on column public.agenda_marcacao.data_prevista is 'Data prevista (opcional).';
