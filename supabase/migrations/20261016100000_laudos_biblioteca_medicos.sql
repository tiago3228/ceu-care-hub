-- Biblioteca de Laudos: referências únicas ao cadastro médico existente, sem replicar
-- os dados clínicos/cadastrais e sem vínculo obrigatório a setor ou sala.
create or replace function public.normalizar_nome_medico_laudos(_nome text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        translate(
          lower(btrim(coalesce(_nome, ''))),
          'áàâãäéèêëíìîïóòôõöúùûüçñ',
          'aaaaaeeeeiiiiooooouuuucn'
        ),
        '^(dra?\.?|medico|medica)\s+',
        '',
        'i'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.pode_gerenciar_medicos_laudos(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_ativo(_user_id)
    and public.is_admin(_user_id)
    and exists (
      select 1 from public.usuario_permissoes
      where user_id = _user_id and modulo = 'laudos_medicos_gerenciar'
    );
$$;
revoke all on function public.pode_gerenciar_medicos_laudos(uuid) from public, anon;
grant execute on function public.pode_gerenciar_medicos_laudos(uuid) to authenticated;

alter table public.medicos alter column setor drop not null;
alter table public.medicos drop constraint if exists medicos_setor_check;
alter table public.medicos add constraint medicos_setor_check
  check (setor is null or setor in ('operacao', 'enfermagem'));

create table if not exists public.laudos_medicos (
  medico_id bigint primary key references public.medicos(id) on delete restrict,
  adicionado_em timestamptz not null default now(),
  adicionado_por uuid references auth.users(id) on delete set null
);
comment on table public.laudos_medicos is
  'Médicos incluídos na biblioteca de Laudos; aponta para o cadastro mestre, sem duplicar seus dados.';
grant select, insert, delete on public.laudos_medicos to authenticated;
alter table public.laudos_medicos enable row level security;

drop policy if exists laudos_medicos_select on public.laudos_medicos;
create policy laudos_medicos_select on public.laudos_medicos
  for select to authenticated
  using (public.tem_modulo(auth.uid(), 'salas'));

drop policy if exists laudos_medicos_insert on public.laudos_medicos;
create policy laudos_medicos_insert on public.laudos_medicos
  for insert to authenticated
  with check (public.pode_gerenciar_medicos_laudos(auth.uid()));

drop policy if exists laudos_medicos_delete on public.laudos_medicos;
create policy laudos_medicos_delete on public.laudos_medicos
  for delete to authenticated
  using (public.pode_gerenciar_medicos_laudos(auth.uid()));

-- Atribui a permissão explícita aos administradores já existentes; novos administradores
-- precisam recebê-la em Usuários e permissões. A função sempre exige também papel admin.
insert into public.usuario_permissoes (user_id, modulo)
select distinct user_id, 'laudos_medicos_gerenciar'
from public.user_roles
where role in ('admin_master'::public.app_role, 'administrador'::public.app_role)
on conflict (user_id, modulo) do nothing;

-- Migra um registro mestre por nome normalizado para a biblioteca. A tabela continua
-- apontando para public.medicos; os dados originais e vínculos de escala não são alterados.
insert into public.laudos_medicos (medico_id)
select id
from (
  select
    m.id,
    row_number() over (
      partition by public.normalizar_nome_medico_laudos(m.nome)
      order by m.ativo desc, (m.crm is not null) desc,
        (m.especialidade_principal is not null) desc, m.id
    ) as posicao
  from public.medicos m
  where nullif(public.normalizar_nome_medico_laudos(m.nome), '') is not null
) unicos
where posicao = 1
on conflict (medico_id) do nothing;

-- Acesso de leitura a médicos já incluídos na biblioteca para usuários de Salas,
-- sem liberar leitura dos demais cadastros de outros setores.
drop policy if exists medicos_select on public.medicos;
create policy medicos_select on public.medicos for select to authenticated using (
  public.is_admin(auth.uid())
  or (setor = 'operacao' and public.tem_modulo(auth.uid(), 'medicos'))
  or (setor = 'enfermagem' and public.tem_modulo(auth.uid(), 'enfermagem'))
  or (
    public.tem_modulo(auth.uid(), 'salas')
    and exists (
      select 1 from public.laudos_medicos lm where lm.medico_id = medicos.id
    )
  )
);

-- Inserção e exclusão de cadastro mestre exigem papel administrativo e a permissão
-- laudos_medicos_gerenciar explicitamente concedida. A edição de campos existentes
-- continua submetida à política medicos_update original.
drop policy if exists medicos_insert on public.medicos;
create policy medicos_insert on public.medicos for insert to authenticated
  with check (public.pode_gerenciar_medicos_laudos(auth.uid()));
drop policy if exists medicos_delete on public.medicos;
create policy medicos_delete on public.medicos for delete to authenticated
  using (public.pode_gerenciar_medicos_laudos(auth.uid()));

create or replace function public.adicionar_medico_laudos(
  p_nome text,
  p_crm text default null,
  p_especialidade text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_limpo text := btrim(coalesce(p_nome, ''));
  chave text;
  medico_existente bigint;
  novo_medico bigint;
begin
  if not public.pode_gerenciar_medicos_laudos(auth.uid()) then
    raise exception 'Somente administradores com a permissão de gestão de médicos podem adicionar médicos.'
      using errcode = '42501';
  end if;
  if nome_limpo = '' then
    raise exception 'Informe o nome do médico.' using errcode = '22023';
  end if;
  chave := public.normalizar_nome_medico_laudos(nome_limpo);
  if chave = '' then
    raise exception 'Informe um nome de médico válido.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.laudos_medicos lm
    join public.medicos m on m.id = lm.medico_id
    where public.normalizar_nome_medico_laudos(m.nome) = chave
  ) then
    raise exception 'Este médico já está na biblioteca de Laudos.' using errcode = '23505';
  end if;

  -- Reaproveita um cadastro mestre inativo removido anteriormente da biblioteca,
  -- quando houver; caso contrário cria um médico sem setor ou sala.
  select m.id into medico_existente
  from public.medicos m
  where public.normalizar_nome_medico_laudos(m.nome) = chave
  order by m.ativo desc, (m.crm is not null) desc,
    (m.especialidade_principal is not null) desc, m.id
  limit 1;

  if medico_existente is null then
    insert into public.medicos (
      nome, crm, especialidade_principal, ativo, setor
    ) values (
      nome_limpo, nullif(btrim(coalesce(p_crm, '')), ''),
      nullif(btrim(coalesce(p_especialidade, '')), ''), true, null
    ) returning id into novo_medico;
  else
    novo_medico := medico_existente;
  end if;

  insert into public.laudos_medicos (medico_id, adicionado_por)
  values (novo_medico, auth.uid());
  return novo_medico;
end;
$$;
revoke all on function public.adicionar_medico_laudos(text, text, text) from public, anon;
grant execute on function public.adicionar_medico_laudos(text, text, text) to authenticated;

create or replace function public.remover_medico_laudos(p_medico_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pode_gerenciar_medicos_laudos(auth.uid()) then
    raise exception 'Somente administradores com a permissão de gestão de médicos podem remover médicos.'
      using errcode = '42501';
  end if;
  delete from public.laudos_medicos where medico_id = p_medico_id;
  if not found then
    raise exception 'O médico não está na biblioteca de Laudos.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.remover_medico_laudos(bigint) from public, anon;
grant execute on function public.remover_medico_laudos(bigint) to authenticated;
