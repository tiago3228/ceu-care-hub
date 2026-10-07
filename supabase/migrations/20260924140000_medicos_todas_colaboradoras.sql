-- Permite indicar que o médico pode ser relacionado a todas as colaboradoras do próprio setor.
alter table public.medicos
  add column if not exists atende_todas_colaboradoras boolean not null default false;

comment on column public.medicos.atende_todas_colaboradoras is
  'Quando verdadeiro, o médico é considerado compatível com todas as colaboradoras do seu setor.';
