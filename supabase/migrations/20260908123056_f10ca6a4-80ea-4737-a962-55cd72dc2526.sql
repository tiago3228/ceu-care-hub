create table public.senhas (
  id bigserial primary key,
  nome text not null,
  url text,
  login text not null,
  senha_cifrada text not null,
  observacoes text,
  categoria text,
  criado_por uuid references auth.users(id),
  atualizado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select (id, nome, url, login, observacoes, categoria, criado_por, atualizado_por, created_at, updated_at) on public.senhas to authenticated;
grant all on public.senhas to service_role;
grant usage, select on sequence public.senhas_id_seq to service_role;

alter table public.senhas enable row level security;

create policy "Usuarios com modulo senhas podem ver"
on public.senhas for select to authenticated
using (public.tem_modulo(auth.uid(), 'senhas'));

create trigger trg_senhas_touch
before update on public.senhas
for each row execute function public.touch_updated_at();

create or replace function public.audit_senhas()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_nome text;
  v_old jsonb;
  v_new jsonb;
begin
  select nome into v_nome from public.profiles where id = auth.uid();
  v_old := case when tg_op in ('UPDATE','DELETE') then (to_jsonb(old) - 'senha_cifrada') else null end;
  v_new := case when tg_op in ('INSERT','UPDATE') then (to_jsonb(new) - 'senha_cifrada') else null end;
  insert into public.audit_logs (user_id, usuario_nome, tabela, operacao, registro_id, dados_anteriores, dados_novos, observacoes)
  values (
    auth.uid(),
    coalesce(v_nome, 'sistema'),
    'senhas',
    tg_op,
    coalesce(new.id, old.id)::text,
    v_old,
    v_new,
    coalesce(new.nome, old.nome)
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_senhas_audit
after insert or update or delete on public.senhas
for each row execute function public.audit_senhas();