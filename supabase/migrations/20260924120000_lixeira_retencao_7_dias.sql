-- Lixeira central para registros do sistema.
-- A exclusão normal das tabelas de negócio passa a ser arquivada por 7 dias.

create table if not exists public.lixeira_registros (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id text not null,
  dados jsonb not null,
  excluido_por uuid references auth.users(id) on delete set null,
  excluido_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '7 days'),
  restaurado_em timestamptz
);

create index if not exists lixeira_expira_idx on public.lixeira_registros (expira_em)
  where restaurado_em is null;
create index if not exists lixeira_tabela_idx on public.lixeira_registros (tabela, excluido_em desc);

grant select, insert, update, delete on public.lixeira_registros to authenticated;
alter table public.lixeira_registros enable row level security;

drop policy if exists lixeira_select on public.lixeira_registros;
create policy lixeira_select on public.lixeira_registros for select to authenticated
  using (public.tem_modulo(auth.uid(), 'lixeira'));
drop policy if exists lixeira_manage on public.lixeira_registros;
create policy lixeira_manage on public.lixeira_registros for all to authenticated
  using (public.tem_modulo(auth.uid(), 'lixeira'))
  with check (public.tem_modulo(auth.uid(), 'lixeira'));

create or replace function public.enviar_para_lixeira()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dados_antigos jsonb := to_jsonb(old);
  registro text := coalesce(dados_antigos->>'id', dados_antigos->>'user_id', md5(dados_antigos::text));
begin
  insert into public.lixeira_registros (tabela, registro_id, dados, excluido_por)
  values (tg_table_name, registro, dados_antigos, auth.uid());
  return old;
end;
$$;

-- Tabelas de negócio. Tabelas de autenticação, permissões, configurações e
-- auditoria ficam fora da lixeira para não quebrar o acesso ao sistema.
do $$
declare
  tabela text;
  tabelas text[] := array[
    'aparelhos_ultrassom', 'atendimento_materiais', 'atendimentos_enfermagem',
    'ausencias', 'banco_horas', 'colaboradora_medicos_padrao', 'colaboradoras',
    'conflitos_detectados', 'empresas', 'enf_detalhe_coleta', 'enf_detalhe_sinais_vitais',
    'enf_detalhe_vacina', 'escala_base', 'escala_base_colaboradoras',
    'escala_colaboradoras', 'escalas', 'especialidades', 'itens', 'lotes',
    'medico_salas', 'medico_secretarias_favoritas', 'medicos', 'movimentacoes_estoque',
    'notas', 'pacientes', 'procedimento_materiais', 'procedimentos_enfermagem',
    'ramais', 'sala_colaboradoras', 'salas', 'senhas', 'solicitacao_itens',
    'solicitacoes', 'sondas_desinfeccao', 'sondas_teste_fita', 'sondas_troca_cuba',
    'sugestoes', 'treinamentos', 'versiculos'
  ];
begin
  foreach tabela in array tabelas loop
    if to_regclass('public.' || tabela) is not null then
      execute format('drop trigger if exists trg_lixeira_delete on public.%I', tabela);
      execute format(
        'create trigger trg_lixeira_delete after delete on public.%I for each row execute function public.enviar_para_lixeira()',
        tabela
      );
    end if;
  end loop;
end;
$$;

create or replace function public.restaurar_lixeira(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  registro public.lixeira_registros;
begin
  if not public.tem_modulo(auth.uid(), 'lixeira') then
    raise exception 'Sem permissão para restaurar registros da lixeira';
  end if;

  select * into registro
    from public.lixeira_registros
   where id = p_id and restaurado_em is null and expira_em > now();
  if not found then
    raise exception 'Registro não encontrado ou já expirado';
  end if;

  execute format(
    'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict do nothing',
    registro.tabela, registro.tabela
  ) using registro.dados;

  update public.lixeira_registros
     set restaurado_em = now()
   where id = p_id;
end;
$$;

grant execute on function public.restaurar_lixeira(uuid) to authenticated;

create or replace function public.limpar_lixeira_expirada()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removidos integer;
begin
  if auth.uid() is not null and not public.tem_modulo(auth.uid(), 'lixeira') then
    raise exception 'Sem permissão para limpar a lixeira';
  end if;

  delete from public.lixeira_registros
   where restaurado_em is null and expira_em <= now();
  get diagnostics removidos = row_count;
  return removidos;
end;
$$;

grant execute on function public.limpar_lixeira_expirada() to authenticated;

-- Em projetos Supabase com pg_cron habilitado, a limpeza ocorre diariamente às 03:00.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema extensions';
    begin
      execute $sql$select cron.unschedule(jobid) from cron.job where jobname = 'limpar-lixeira-7-dias'$sql$;
    exception when others then
      null;
    end;
    execute $sql$select cron.schedule('limpar-lixeira-7-dias', '0 3 * * *', 'select public.limpar_lixeira_expirada();')$sql$;
  end if;
exception when others then
  raise notice 'pg_cron não habilitado; a limpeza poderá ser executada por chamada a limpar_lixeira_expirada().';
end;
$$;
