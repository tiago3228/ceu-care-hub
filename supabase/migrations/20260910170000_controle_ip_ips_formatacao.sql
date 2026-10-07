-- Nova categoria para IPs reservados à formatação.
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
  add constraint controle_ip_categoria_check
  check (categoria in ('impressoras','computadores','servidores','dvr','wifi','roteadores','tv_corporativas','switch','atl','relogio_ponto','ultrasson','ips_formatacao'));
