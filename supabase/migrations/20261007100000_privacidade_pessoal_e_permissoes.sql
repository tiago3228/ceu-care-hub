-- Privacidade pessoal e permissões padrão para todos os perfis.
-- Senhas, Bloco de Notas e Minha Agenda nunca são compartilhados, inclusive com administradores.

-- ==================== Permissões padrão ====================
do $$
declare
  modulos_pessoais text[] := array[
    'senhas',
    'senhas_adicionar',
    'senhas_editar',
    'senhas_excluir',
    'senhas_revelar',
    'notas',
    'agenda_marcacao',
    'agenda_marcacao_adicionar',
    'agenda_marcacao_editar',
    'agenda_marcacao_excluir',
    'ramais',
    'lixeira'
  ]::text[];
begin
  update public.setores s
     set permissoes_padrao = array(
       select distinct permissao
         from unnest(coalesce(s.permissoes_padrao, '{}'::text[]) || modulos_pessoais) as p(permissao)
        order by permissao
     ),
         atualizado_em = now();

  update public.setores s
     set permissoes_padrao = array(
       select permissao
         from unnest(s.permissoes_padrao) as p(permissao)
        where permissao <> 'ramais_editar'
     )
   where s.papel_padrao not in (
     'admin_master'::public.app_role,
     'administrador'::public.app_role
   );

  insert into public.usuario_permissoes (user_id, modulo)
  select p.id, permissao
    from public.profiles p
    cross join unnest(modulos_pessoais) as m(permissao)
  on conflict (user_id, modulo) do nothing;

  -- Edição de Ramais não é uma permissão geral: somente administradores com
  -- ramais_editar explicitamente concedida podem alterar os registros.
  delete from public.usuario_permissoes up
   where up.modulo = 'ramais_editar'
     and not exists (
       select 1
         from public.user_roles ur
        where ur.user_id = up.user_id
          and ur.role in ('admin_master'::public.app_role, 'administrador'::public.app_role)
     );
end;
$$;

-- ==================== Lixeira pessoal ====================
alter table public.lixeira_registros
  add column if not exists dono_user_id uuid references auth.users(id) on delete set null;

-- Registros pessoais arquivados antes desta migration permanecem visíveis apenas ao dono.
update public.lixeira_registros lr
   set dono_user_id = coalesce(
         lr.dono_user_id,
         case lr.tabela
           when 'notas' then nullif(lr.dados->>'created_by', '')::uuid
           when 'agenda_marcacao' then nullif(lr.dados->>'user_id', '')::uuid
           when 'senhas' then coalesce(
             nullif(lr.dados->>'owner_user_id', '')::uuid,
             nullif(lr.dados->>'criado_por', '')::uuid
           )
           else null
         end
       ),
       expira_em = lr.excluido_em + interval '30 days'
 where lr.tabela in ('notas', 'agenda_marcacao', 'senhas')
   and lr.restaurado_em is null;

create index if not exists lixeira_dono_pessoal_idx
  on public.lixeira_registros (dono_user_id, excluido_em desc)
  where restaurado_em is null;

create or replace function public.enviar_para_lixeira()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dados_antigos jsonb := to_jsonb(old);
  registro text := coalesce(dados_antigos->>'id', dados_antigos->>'user_id', md5(dados_antigos::text));
  dono uuid;
  retencao interval := interval '7 days';
begin
  case tg_table_name
    when 'notas' then
      dono := nullif(dados_antigos->>'created_by', '')::uuid;
    when 'agenda_marcacao' then
      dono := nullif(dados_antigos->>'user_id', '')::uuid;
    when 'senhas' then
      dono := coalesce(
        nullif(dados_antigos->>'owner_user_id', '')::uuid,
        nullif(dados_antigos->>'criado_por', '')::uuid
      );
    else
      dono := null;
  end case;

  if tg_table_name in ('notas', 'agenda_marcacao', 'senhas') then
    retencao := interval '30 days';
  end if;

  insert into public.lixeira_registros (
    tabela, registro_id, dados, excluido_por, dono_user_id, expira_em
  ) values (
    tg_table_name,
    registro,
    dados_antigos,
    coalesce(auth.uid(), dono),
    dono,
    now() + retencao
  );
  return old;
end;
$$;

-- Minha Agenda passa a gerar cópia restaurável ao excluir.
drop trigger if exists trg_lixeira_delete on public.agenda_marcacao;
create trigger trg_lixeira_delete
after delete on public.agenda_marcacao
for each row execute function public.enviar_para_lixeira();

-- Usuários veem apenas seus itens pessoais. Itens de módulos compartilhados na
-- lixeira continuam restritos a administradores. Não há escrita direta na lixeira;
-- exclusão e restauração passam pelos triggers/RPCs com verificação de propriedade.
drop policy if exists lixeira_select on public.lixeira_registros;
drop policy if exists lixeira_manage on public.lixeira_registros;
drop policy if exists lixeira_select_scoped on public.lixeira_registros;
create policy lixeira_select_scoped on public.lixeira_registros
for select to authenticated
using (
  public.tem_modulo(auth.uid(), 'lixeira')
  and (
    (tabela in ('notas', 'agenda_marcacao', 'senhas') and dono_user_id = auth.uid())
    or (tabela not in ('notas', 'agenda_marcacao', 'senhas') and public.is_admin(auth.uid()))
  )
);

revoke insert, update, delete on public.lixeira_registros from authenticated;

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
   where id = p_id
     and restaurado_em is null
     and expira_em > now();
  if not found then
    raise exception 'Registro não encontrado ou já expirado';
  end if;

  if registro.tabela in ('notas', 'agenda_marcacao', 'senhas') then
    if registro.dono_user_id is null or registro.dono_user_id <> auth.uid() then
      raise exception 'Somente o proprietário pode restaurar este registro pessoal';
    end if;
  elsif not public.is_admin(auth.uid()) then
    raise exception 'Somente administradores podem restaurar registros compartilhados';
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

revoke all on function public.restaurar_lixeira(uuid) from public, anon;
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
  if auth.uid() is null then
    -- Chamadas do job do banco (pg_cron/service role) limpam todos os tipos.
    delete from public.lixeira_registros
     where restaurado_em is null and expira_em <= now();
  elsif not public.tem_modulo(auth.uid(), 'lixeira') then
    raise exception 'Sem permissão para limpar a lixeira';
  elsif public.is_admin(auth.uid()) then
    delete from public.lixeira_registros
     where restaurado_em is null and expira_em <= now();
  else
    -- Usuários comuns só podem remover seus próprios itens pessoais já vencidos.
    delete from public.lixeira_registros
     where restaurado_em is null
       and expira_em <= now()
       and tabela in ('notas', 'agenda_marcacao', 'senhas')
       and dono_user_id = auth.uid();
  end if;

  get diagnostics removidos = row_count;
  return removidos;
end;
$$;

revoke all on function public.limpar_lixeira_expirada() from public, anon;
grant execute on function public.limpar_lixeira_expirada() to authenticated, service_role;

-- A retenção é definida por registro: 30 dias para dados pessoais e 7 dias para
-- itens compartilhados. O job diário remove fisicamente os expirados.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema extensions';
    begin
      execute $sql$
        select cron.unschedule(jobid)
          from cron.job
         where jobname in ('limpar-lixeira-7-dias', 'limpar-lixeira-retencao-diaria')
      $sql$;
    exception when others then
      null;
    end;
    execute $sql$
      select cron.schedule(
        'limpar-lixeira-retencao-diaria',
        '0 3 * * *',
        'select public.limpar_lixeira_expirada();'
      )
    $sql$;
  end if;
exception when others then
  raise notice 'pg_cron não habilitado; a limpeza poderá ser executada por chamada a limpar_lixeira_expirada().';
end;
$$;

-- ==================== Senhas: proprietário único, inclusive administradores ====================
-- A senha cifrada é lida exclusivamente por código server-side com service_role.
revoke select on public.senhas from public, anon, authenticated;
revoke select (senha_cifrada) on public.senhas from public, anon, authenticated;
grant select (
  id, nome, url, login, observacoes, categoria, criado_por, atualizado_por,
  owner_user_id, created_at, updated_at
) on public.senhas to authenticated;
revoke insert, update, delete on public.senhas from public, anon, authenticated;
grant usage, select on sequence public.senhas_id_seq to authenticated;

drop policy if exists "Usuarios com modulo senhas podem ver" on public.senhas;
drop policy if exists senhas_select_owner_or_admin on public.senhas;
drop policy if exists senhas_select_owner_only on public.senhas;
drop policy if exists senhas_insert_owner on public.senhas;
drop policy if exists senhas_update_owner_or_admin on public.senhas;
drop policy if exists senhas_update_owner_only on public.senhas;
drop policy if exists senhas_delete_owner_or_admin on public.senhas;
drop policy if exists senhas_delete_owner_only on public.senhas;

create policy senhas_select_owner_only on public.senhas
for select to authenticated
using (owner_user_id = auth.uid() and public.tem_modulo(auth.uid(), 'senhas'));

create policy senhas_insert_owner on public.senhas
for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and public.tem_modulo(auth.uid(), 'senhas')
  and public.pode_editar(auth.uid(), 'senhas_adicionar')
);

create policy senhas_update_owner_only on public.senhas
for update to authenticated
using (
  owner_user_id = auth.uid()
  and public.tem_modulo(auth.uid(), 'senhas')
  and public.pode_editar(auth.uid(), 'senhas_editar')
)
with check (
  owner_user_id = auth.uid()
  and public.tem_modulo(auth.uid(), 'senhas')
  and public.pode_editar(auth.uid(), 'senhas_editar')
);

create policy senhas_delete_owner_only on public.senhas
for delete to authenticated
using (
  owner_user_id = auth.uid()
  and public.tem_modulo(auth.uid(), 'senhas')
  and public.pode_editar(auth.uid(), 'senhas_excluir')
);

create or replace function public.proteger_proprietario_senha()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'O proprietário de uma credencial não pode ser alterado';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_senhas_owner_immutable on public.senhas;
create trigger trg_senhas_owner_immutable
before update of owner_user_id on public.senhas
for each row execute function public.proteger_proprietario_senha();

-- ==================== Notas e Minha Agenda: sem exceção de administrador ====================
drop policy if exists notas_select on public.notas;
drop policy if exists notas_insert on public.notas;
drop policy if exists notas_update on public.notas;
drop policy if exists notas_delete on public.notas;
drop policy if exists notas_select_pessoal on public.notas;
drop policy if exists notas_insert_pessoal on public.notas;
drop policy if exists notas_update_pessoal on public.notas;
drop policy if exists notas_delete_pessoal on public.notas;
drop policy if exists notas_select_owner on public.notas;
drop policy if exists notas_insert_owner on public.notas;
drop policy if exists notas_update_owner on public.notas;
drop policy if exists notas_delete_owner on public.notas;

create policy notas_select_owner_only on public.notas
for select to authenticated
using (created_by = auth.uid() and public.tem_modulo(auth.uid(), 'notas'));

create policy notas_insert_owner_only on public.notas
for insert to authenticated
with check (created_by = auth.uid() and public.pode_editar(auth.uid(), 'notas'));

create policy notas_update_owner_only on public.notas
for update to authenticated
using (created_by = auth.uid() and public.pode_editar(auth.uid(), 'notas'))
with check (created_by = auth.uid() and public.pode_editar(auth.uid(), 'notas'));

create policy notas_delete_owner_only on public.notas
for delete to authenticated
using (created_by = auth.uid() and public.pode_editar(auth.uid(), 'notas'));

drop policy if exists agenda_marcacao_select on public.agenda_marcacao;
drop policy if exists agenda_marcacao_insert on public.agenda_marcacao;
drop policy if exists agenda_marcacao_update on public.agenda_marcacao;
drop policy if exists agenda_marcacao_delete on public.agenda_marcacao;

create policy agenda_marcacao_select_owner_only on public.agenda_marcacao
for select to authenticated
using (user_id = auth.uid() and public.tem_modulo(auth.uid(), 'agenda_marcacao'));

create policy agenda_marcacao_insert_owner_only on public.agenda_marcacao
for insert to authenticated
with check (
  user_id = auth.uid()
  and created_by = auth.uid()
  and public.pode_editar(auth.uid(), 'agenda_marcacao_adicionar')
);

create policy agenda_marcacao_update_owner_only on public.agenda_marcacao
for update to authenticated
using (
  user_id = auth.uid()
  and public.tem_modulo(auth.uid(), 'agenda_marcacao')
  and public.pode_editar(auth.uid(), 'agenda_marcacao_editar')
)
with check (
  user_id = auth.uid()
  and created_by = auth.uid()
  and public.pode_editar(auth.uid(), 'agenda_marcacao_editar')
);

create policy agenda_marcacao_delete_owner_only on public.agenda_marcacao
for delete to authenticated
using (
  user_id = auth.uid()
  and public.tem_modulo(auth.uid(), 'agenda_marcacao')
  and public.pode_editar(auth.uid(), 'agenda_marcacao_excluir')
);

-- ==================== Ramais: todos visualizam; edição só admin explicitamente autorizado ====================
create or replace function public.pode_editar_ramais()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_ativo(auth.uid())
     and public.is_admin(auth.uid())
     and exists (
       select 1
         from public.usuario_permissoes up
        where up.user_id = auth.uid()
          and up.modulo = 'ramais_editar'
     )
$$;

revoke all on function public.pode_editar_ramais() from public, anon;
grant execute on function public.pode_editar_ramais() to authenticated;

drop policy if exists ramais_select on public.ramais;
drop policy if exists ramais_insert on public.ramais;
drop policy if exists ramais_update on public.ramais;
drop policy if exists ramais_delete on public.ramais;

create policy ramais_select_all_profiles on public.ramais
for select to authenticated
using (public.tem_modulo(auth.uid(), 'ramais'));

create policy ramais_insert_admin_permission on public.ramais
for insert to authenticated
with check (public.pode_editar_ramais());

create policy ramais_update_admin_permission on public.ramais
for update to authenticated
using (public.pode_editar_ramais())
with check (public.pode_editar_ramais());

create policy ramais_delete_admin_permission on public.ramais
for delete to authenticated
using (public.pode_editar_ramais());
