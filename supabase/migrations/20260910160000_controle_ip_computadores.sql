-- Campos específicos para inventário de computadores.
alter table public.controle_ip
  add column if not exists usuario_responsavel text,
  add column if not exists anydesk text,
  add column if not exists patrimonio_cpu text,
  add column if not exists patrimonio_monitor text,
  add column if not exists sistema_operacional text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'controle_ip_computador_local_setor_obrigatorio'
      and conrelid = 'public.controle_ip'::regclass
  ) then
    alter table public.controle_ip
      add constraint controle_ip_computador_local_setor_obrigatorio
      check (
        categoria <> 'computadores'
        or nullif(trim(coalesce(local, '')), '') is not null
        or nullif(trim(coalesce(setor, '')), '') is not null
      ) not valid;
  end if;
end $$;

create index if not exists controle_ip_computador_anydesk_idx
  on public.controle_ip(anydesk)
  where categoria = 'computadores';
create index if not exists controle_ip_computador_usuario_idx
  on public.controle_ip(usuario_responsavel)
  where categoria = 'computadores';
create index if not exists controle_ip_computador_patrimonio_cpu_idx
  on public.controle_ip(patrimonio_cpu)
  where categoria = 'computadores';
create index if not exists controle_ip_computador_patrimonio_monitor_idx
  on public.controle_ip(patrimonio_monitor)
  where categoria = 'computadores';

comment on column public.controle_ip.usuario_responsavel is 'Usuário responsável pelo computador';
comment on column public.controle_ip.anydesk is 'ID AnyDesk do computador';
comment on column public.controle_ip.patrimonio_cpu is 'Patrimônio da CPU';
comment on column public.controle_ip.patrimonio_monitor is 'Patrimônio do monitor';
comment on column public.controle_ip.sistema_operacional is 'Sistema operacional instalado';
