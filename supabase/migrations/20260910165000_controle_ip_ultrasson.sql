-- Categoria especial de equipamentos de ultrassom.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'controle_ip_categoria_check'
      and conrelid = 'public.controle_ip'::regclass
  ) then
    alter table public.controle_ip drop constraint controle_ip_categoria_check;
  end if;
end $$;

alter table public.controle_ip
  add column if not exists ae_title text,
  add column if not exists worklist text;

alter table public.controle_ip
  add constraint controle_ip_categoria_check
  check (categoria in ('impressoras','computadores','servidores','dvr','wifi','roteadores','tv_corporativas','switch','atl','relogio_ponto','ultrasson'));

create index if not exists controle_ip_ultrasson_ae_title_idx
  on public.controle_ip(ae_title)
  where categoria = 'ultrasson';
create index if not exists controle_ip_ultrasson_worklist_idx
  on public.controle_ip(worklist)
  where categoria = 'ultrasson';

comment on column public.controle_ip.ae_title is 'AETitle DICOM do equipamento de ultrassom';
comment on column public.controle_ip.worklist is 'Worklist DICOM do equipamento de ultrassom';
