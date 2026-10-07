-- Permite desabilitar o intervalo de almoço para colaboradoras que não fazem pausa.
alter table public.colaboradoras
  add column if not exists almoco_ativo boolean not null default true;

update public.colaboradoras
set almoco_ativo = true
where almoco_ativo is null;

comment on column public.colaboradoras.almoco_ativo is 'Define se o horário de almoço deve gerar alertas na escala.';
