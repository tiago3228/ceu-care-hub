-- ============ FASE 1: modelo de dados, papéis e permissões ============
create type public.app_role as enum ('admin_master','administrador','coordenacao','enfermagem','secretaria','visualizacao');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  login text,
  setor text,
  ativo boolean not null default true,
  legacy_usuario_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.usuario_permissoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  modulo text not null,
  unique (user_id, modulo)
);
grant select on public.usuario_permissoes to authenticated;
grant all on public.usuario_permissoes to service_role;
alter table public.usuario_permissoes enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin_master','administrador'))
$$;

create or replace function public.is_master(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = 'admin_master')
$$;

create or replace function public.is_ativo(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select ativo from public.profiles where id = _user_id), false)
$$;

create or replace function public.tem_modulo(_user_id uuid, _modulo text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_ativo(_user_id) and (
    public.is_admin(_user_id)
    or exists (select 1 from public.usuario_permissoes where user_id = _user_id and modulo = _modulo)
  )
$$;

create or replace function public.pode_editar(_user_id uuid, _modulo text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tem_modulo(_user_id, _modulo)
     and not (public.has_role(_user_id, 'visualizacao') and not public.is_admin(_user_id))
$$;

create policy "profiles_select_self_or_admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_admin_all" on public.profiles for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "roles_select_self_or_admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "roles_master_manage" on public.user_roles for all to authenticated
  using (public.is_master(auth.uid())) with check (public.is_master(auth.uid()));

create policy "perm_select_self_or_admin" on public.usuario_permissoes for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "perm_admin_manage" on public.usuario_permissoes for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, login)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin_master');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

-- ============ Cadastros base ============
create table public.especialidades (
  id bigint generated by default as identity primary key,
  sigla text not null unique,
  descricao text
);

create table public.empresas (
  id bigint generated by default as identity primary key,
  nome text not null unique
);

create table public.aparelhos_ultrassom (
  id bigint generated by default as identity primary key,
  sala text not null,
  aparelho text not null,
  voltagem text,
  gravacao text,
  aetitle text, ip text, porta text, worklist text,
  observacoes text,
  data_cadastro date,
  ativo boolean not null default true
);

create table public.salas (
  id bigint generated by default as identity primary key,
  nome text not null,
  unidade text,
  especialidade_principal text,
  horario_inicio text,
  horario_fim text,
  ativa boolean not null default true,
  recursos text,
  observacoes text,
  aparelho_id bigint references public.aparelhos_ultrassom(id) on delete set null
);

create table public.medicos (
  id bigint generated by default as identity primary key,
  nome text not null,
  apelido text,
  crm text,
  especialidade_principal text,
  especialidades text,
  procedimentos text,
  observacoes text,
  necessita_experiente boolean not null default false,
  colaboradora_padrao_id bigint,
  ativo boolean not null default true
);

create table public.colaboradoras (
  id bigint generated by default as identity primary key,
  nome text not null,
  cargo text,
  jornada text,
  status text,
  entrada text,
  saida text,
  secretaria text,
  estagiaria text,
  coordenadora text,
  supervisora text,
  especialidades text,
  treinamentos text,
  funcoes text,
  observacoes text,
  banco_horas numeric not null default 0,
  medico_padrao_id bigint references public.medicos(id) on delete set null,
  tipo_colaboradora text default 'Secretária Integral',
  atende_todos_medicos boolean not null default false,
  desativada boolean not null default false
);
alter table public.medicos add constraint medicos_colab_padrao_fk
  foreign key (colaboradora_padrao_id) references public.colaboradoras(id) on delete set null;

create table public.colaboradora_medicos_padrao (
  id bigint generated by default as identity primary key,
  colaboradora_id bigint not null references public.colaboradoras(id) on delete cascade,
  medico_id bigint not null references public.medicos(id) on delete cascade,
  unique (colaboradora_id, medico_id)
);

create table public.medico_salas (
  id bigint generated by default as identity primary key,
  medico_id bigint not null references public.medicos(id) on delete cascade,
  sala_id bigint not null references public.salas(id) on delete cascade,
  unique (medico_id, sala_id)
);

create table public.medico_secretarias_favoritas (
  id bigint generated by default as identity primary key,
  medico_id bigint not null references public.medicos(id) on delete cascade,
  colaboradora_id bigint not null references public.colaboradoras(id) on delete cascade,
  ordem integer not null default 0,
  unique (medico_id, colaboradora_id)
);

create table public.sala_colaboradoras (
  id bigint generated by default as identity primary key,
  sala_id bigint not null references public.salas(id) on delete cascade,
  colaboradora_id bigint not null references public.colaboradoras(id) on delete cascade,
  unique (sala_id, colaboradora_id)
);

-- ============ Escala ============
create table public.escalas (
  id bigint generated by default as identity primary key,
  data date not null,
  sala_id bigint references public.salas(id) on delete set null,
  medico_id bigint references public.medicos(id) on delete set null,
  horario_inicio text,
  horario_fim text,
  periodo text,
  status_compatibilidade text not null default 'verde',
  motivo_alerta text,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create index escalas_data_idx on public.escalas (data);
create trigger trg_escalas_touch before update on public.escalas
for each row execute function public.touch_updated_at();

create table public.escala_colaboradoras (
  escala_id bigint not null references public.escalas(id) on delete cascade,
  colaboradora_id bigint not null references public.colaboradoras(id) on delete cascade,
  alerta_ignorado text,
  primary key (escala_id, colaboradora_id)
);

create table public.escala_base (
  id bigint generated by default as identity primary key,
  dia_semana text not null,
  periodo text not null,
  sala_id bigint references public.salas(id) on delete set null,
  medico_id bigint references public.medicos(id) on delete set null,
  horario_inicio text,
  horario_fim text,
  observacoes text
);

create table public.escala_base_colaboradoras (
  escala_base_id bigint not null references public.escala_base(id) on delete cascade,
  colaboradora_id bigint not null references public.colaboradoras(id) on delete cascade,
  primary key (escala_base_id, colaboradora_id)
);

create table public.conflitos_detectados (
  id bigint generated by default as identity primary key,
  escala_id bigint references public.escalas(id) on delete cascade,
  tipo_conflito text,
  descricao text,
  data_deteccao timestamptz not null default now(),
  resolvido boolean not null default false
);

-- ============ Pessoas / RH ============
create table public.ausencias (
  id bigint generated by default as identity primary key,
  colaboradora_id bigint references public.colaboradoras(id) on delete cascade,
  medico_id bigint references public.medicos(id) on delete set null,
  tipo text,
  data_inicio date,
  data_fim date,
  observacoes text,
  anexo_atestado text,
  created_at timestamptz not null default now()
);

create table public.treinamentos (
  id bigint generated by default as identity primary key,
  colaboradora_id bigint references public.colaboradoras(id) on delete cascade,
  especialidade text,
  data_inicio date,
  data_fim date,
  instrutora text,
  status text,
  observacoes text
);

create table public.banco_horas (
  id bigint generated by default as identity primary key,
  colaboradora_id bigint references public.colaboradoras(id) on delete cascade,
  data date,
  minutos integer not null default 0,
  tipo text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- ============ Itens / Estoque ============
create table public.itens (
  id bigint generated by default as identity primary key,
  codigo text unique,
  nome text not null,
  tipo text not null,
  grupo text,
  unidade text,
  referencia text,
  anvisa text,
  preco numeric,
  custo numeric,
  ativo boolean not null default true,
  el boolean not null default false,
  cs boolean not null default false,
  be boolean not null default false,
  controla_validade boolean not null default true
);
create index itens_nome_idx on public.itens (lower(nome));

create table public.lotes (
  id bigint generated by default as identity primary key,
  item_id bigint not null references public.itens(id) on delete cascade,
  lote text,
  validade date,
  quantidade numeric not null default 0 check (quantidade >= 0),
  localizacao text,
  data_entrada date not null default current_date
);
create index lotes_item_validade_idx on public.lotes (item_id, validade);

create table public.movimentacoes_estoque (
  id bigint generated by default as identity primary key,
  item_id bigint not null references public.itens(id) on delete cascade,
  lote_id bigint references public.lotes(id) on delete set null,
  tipo text not null,
  quantidade numeric not null,
  data date not null default current_date,
  hora text,
  responsavel_id bigint references public.colaboradoras(id) on delete set null,
  atendimento_id bigint,
  solicitacao_item_id bigint,
  observacoes text,
  user_id uuid references auth.users(id) on delete set null,
  usuario_nome text,
  created_at timestamptz not null default now()
);

create table public.solicitacoes (
  id bigint generated by default as identity primary key,
  solicitante_id bigint references public.colaboradoras(id) on delete set null,
  setor text,
  data date not null default current_date,
  status text not null default 'Pendente',
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.solicitacao_itens (
  id bigint generated by default as identity primary key,
  solicitacao_id bigint not null references public.solicitacoes(id) on delete cascade,
  item_id bigint not null references public.itens(id) on delete cascade,
  quantidade_solicitada numeric not null,
  quantidade_atendida numeric not null default 0,
  lote_id bigint references public.lotes(id) on delete set null,
  responsavel_atendimento_id bigint references public.colaboradoras(id) on delete set null,
  data_atendimento date,
  observacoes text
);

-- ============ Enfermagem ============
create table public.pacientes (
  id bigint generated by default as identity primary key,
  prontuario text unique,
  nome text not null,
  data_nascimento date,
  observacoes text,
  arquivado boolean not null default false,
  created_at timestamptz not null default now()
);

create sequence public.prontuario_seq start 1;
create or replace function public.gerar_prontuario()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.prontuario is null or new.prontuario = '' then
    new.prontuario := nextval('public.prontuario_seq')::text;
  end if;
  return new;
end;
$$;
create trigger trg_pacientes_prontuario before insert on public.pacientes
for each row execute function public.gerar_prontuario();

create table public.procedimentos_enfermagem (
  id bigint generated by default as identity primary key,
  nome text not null unique,
  ativo boolean not null default true
);

create table public.procedimento_materiais (
  id bigint generated by default as identity primary key,
  procedimento_id bigint not null references public.procedimentos_enfermagem(id) on delete cascade,
  item_id bigint not null references public.itens(id) on delete cascade,
  quantidade numeric not null default 1,
  unique (procedimento_id, item_id)
);

create table public.atendimentos_enfermagem (
  id bigint generated by default as identity primary key,
  paciente_id bigint references public.pacientes(id) on delete set null,
  paciente_nome_livre text,
  data date not null default current_date,
  hora text,
  colaboradora_id bigint references public.colaboradoras(id) on delete set null,
  medico_id bigint references public.medicos(id) on delete set null,
  sala_id bigint references public.salas(id) on delete set null,
  procedimento_id bigint references public.procedimentos_enfermagem(id) on delete set null,
  procedimento text not null,
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.atendimento_materiais (
  id bigint generated by default as identity primary key,
  atendimento_id bigint not null references public.atendimentos_enfermagem(id) on delete cascade,
  item_id bigint not null references public.itens(id) on delete restrict,
  lote_id bigint references public.lotes(id) on delete set null,
  quantidade numeric not null,
  created_at timestamptz not null default now()
);

create table public.enf_detalhe_sinais_vitais (
  atendimento_id bigint primary key references public.atendimentos_enfermagem(id) on delete cascade,
  pressao_arterial text, frequencia_cardiaca text, saturacao text,
  temperatura text, peso text, glicemia text
);
create table public.enf_detalhe_coleta (
  atendimento_id bigint primary key references public.atendimentos_enfermagem(id) on delete cascade,
  tipo_exame text, material_coletado text, horario_coleta text
);
create table public.enf_detalhe_vacina (
  atendimento_id bigint primary key references public.atendimentos_enfermagem(id) on delete cascade,
  vacina text, lote text, validade date, dose text,
  via_administracao text, local_aplicacao text
);

-- ============ Sondas (POP ENF 006 V03) ============
create table public.sondas_desinfeccao (
  id bigint generated by default as identity primary key,
  data date not null default current_date,
  protocolo text,
  numero_sonda text not null,
  horario_inicio text,
  horario_termino text,
  assinatura text,
  observacao text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.sondas_troca_cuba (
  id bigint generated by default as identity primary key,
  data_troca date not null default current_date,
  proxima_troca date,
  produto text,
  lote text,
  validade_rioscope date,
  responsavel text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.sondas_teste_fita (
  id bigint generated by default as identity primary key,
  data_teste date not null default current_date,
  produto text,
  lote text,
  validade date,
  validade_produto_cuba date,
  responsavel text,
  observacao text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============ Notas, sugestões, config, auditoria ============
create table public.notas (
  id bigint generated by default as identity primary key,
  titulo text,
  conteudo text,
  data_criacao date not null default current_date,
  hora_criacao text,
  data_alerta date,
  hora_alerta text,
  status text not null default 'aberta',
  lido boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_notas_touch before update on public.notas
for each row execute function public.touch_updated_at();

create table public.sugestoes (
  id bigint generated by default as identity primary key,
  nome text,
  setor text,
  sugestao text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_sugestoes_touch before update on public.sugestoes
for each row execute function public.touch_updated_at();

create table public.configuracoes_sistema (
  chave text primary key,
  valor text
);

create table public.versiculos (
  id bigint generated by default as identity primary key,
  texto text not null,
  referencia text
);

create table public.audit_logs (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  usuario_nome text,
  tabela text not null,
  operacao text not null,
  registro_id text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  observacoes text,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ============ Grants + RLS por módulo ============
do $$
declare
  mapa text[][] := array[
    ['especialidades','colaboradoras'],['empresas','configuracoes'],
    ['aparelhos_ultrassom','aparelhos'],['salas','salas'],['medicos','medicos'],
    ['colaboradoras','colaboradoras'],['colaboradora_medicos_padrao','colaboradoras'],
    ['medico_salas','medicos'],['medico_secretarias_favoritas','medicos'],
    ['sala_colaboradoras','salas'],['escalas','escalas'],['escala_colaboradoras','escalas'],
    ['escala_base','escalas'],['escala_base_colaboradoras','escalas'],
    ['conflitos_detectados','escalas'],['ausencias','ausencias'],
    ['treinamentos','colaboradoras'],['banco_horas','banco_horas'],
    ['itens','itens'],['lotes','estoque'],['movimentacoes_estoque','estoque'],
    ['solicitacoes','solicitacoes'],['solicitacao_itens','solicitacoes'],
    ['pacientes','enfermagem'],['procedimentos_enfermagem','enfermagem'],
    ['procedimento_materiais','enfermagem'],['atendimentos_enfermagem','enfermagem'],
    ['atendimento_materiais','enfermagem'],['enf_detalhe_sinais_vitais','enfermagem'],
    ['enf_detalhe_coleta','enfermagem'],['enf_detalhe_vacina','enfermagem'],
    ['sondas_desinfeccao','sondas'],['sondas_troca_cuba','sondas'],
    ['sondas_teste_fita','sondas'],['versiculos','escalas']
  ];
  i int;
  tbl text; modulo text;
begin
  for i in 1 .. array_length(mapa,1) loop
    tbl := mapa[i][1]; modulo := mapa[i][2];
    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
    execute format('grant all on public.%I to service_role', tbl);
    execute format('alter table public.%I enable row level security', tbl);
    execute format($f$create policy "%1$s_select" on public.%1$I for select to authenticated using (public.tem_modulo(auth.uid(), %2$L))$f$, tbl, modulo);
    execute format($f$create policy "%1$s_insert" on public.%1$I for insert to authenticated with check (public.pode_editar(auth.uid(), %2$L))$f$, tbl, modulo);
    execute format($f$create policy "%1$s_update" on public.%1$I for update to authenticated using (public.pode_editar(auth.uid(), %2$L)) with check (public.pode_editar(auth.uid(), %2$L))$f$, tbl, modulo);
    execute format($f$create policy "%1$s_delete" on public.%1$I for delete to authenticated using (public.pode_editar(auth.uid(), %2$L))$f$, tbl, modulo);
  end loop;
end $$;

-- notas: criador edita a própria; master edita qualquer
grant select, insert, update, delete on public.notas to authenticated;
grant all on public.notas to service_role;
alter table public.notas enable row level security;
create policy "notas_select" on public.notas for select to authenticated using (public.tem_modulo(auth.uid(),'notas'));
create policy "notas_insert" on public.notas for insert to authenticated with check (public.pode_editar(auth.uid(),'notas') and created_by = auth.uid());
create policy "notas_update" on public.notas for update to authenticated using (created_by = auth.uid() or public.is_master(auth.uid())) with check (created_by = auth.uid() or public.is_master(auth.uid()));
create policy "notas_delete" on public.notas for delete to authenticated using (created_by = auth.uid() or public.is_master(auth.uid()));

-- sugestões: qualquer usuário ativo cria; criador ou master editam
grant select, insert, update, delete on public.sugestoes to authenticated;
grant all on public.sugestoes to service_role;
alter table public.sugestoes enable row level security;
create policy "sugestoes_select" on public.sugestoes for select to authenticated using (created_by = auth.uid() or public.is_master(auth.uid()));
create policy "sugestoes_insert" on public.sugestoes for insert to authenticated with check (public.is_ativo(auth.uid()) and created_by = auth.uid());
create policy "sugestoes_update" on public.sugestoes for update to authenticated using (created_by = auth.uid() or public.is_master(auth.uid())) with check (created_by = auth.uid() or public.is_master(auth.uid()));
create policy "sugestoes_delete" on public.sugestoes for delete to authenticated using (created_by = auth.uid() or public.is_master(auth.uid()));

-- configurações: todos leem, admin altera
grant select, insert, update, delete on public.configuracoes_sistema to authenticated;
grant all on public.configuracoes_sistema to service_role;
alter table public.configuracoes_sistema enable row level security;
create policy "config_select" on public.configuracoes_sistema for select to authenticated using (public.is_ativo(auth.uid()));
create policy "config_admin" on public.configuracoes_sistema for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- auditoria: append-only, leitura só admin
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "audit_select_admin" on public.audit_logs for select to authenticated using (public.is_admin(auth.uid()));
create policy "audit_insert" on public.audit_logs for insert to authenticated with check (public.is_ativo(auth.uid()));

insert into public.configuracoes_sistema (chave, valor) values
  ('dias_alerta_validade','30'), ('horario_alerta','08:00'), ('versao_sistema','1.0.0')
on conflict (chave) do nothing;