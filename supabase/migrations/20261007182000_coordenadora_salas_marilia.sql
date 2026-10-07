-- Define explicitamente a coordenadora do chat de Salas.
create or replace function public.pode_chat_salas(_user_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select public.is_ativo(_user_id) and (
    public.is_admin(_user_id)
    or exists (select 1 from public.usuario_permissoes where user_id = _user_id and modulo = 'chat_salas')
    or exists (select 1 from public.profiles where id = _user_id and lower(coalesce(setor, '')) in ('operacao', 'salas'))
    or exists (select 1 from auth.users where id = _user_id and lower(email) = 'supervisaosalas@clinicaceu.com.br')
  )
$$;

create or replace function public.chat_salas_eh_coordenadora(_user_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select public.pode_chat_salas(_user_id)
    and exists (
      select 1 from auth.users
      where id = _user_id
        and lower(email) = 'supervisaosalas@clinicaceu.com.br'
    )
$$;

create or replace function public.obter_chat_salas_coordenadora()
returns table (id uuid, nome text, setor text, ativo boolean)
language sql stable security definer set search_path = public, auth as $$
  select p.id, p.nome, p.setor, p.ativo
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.ativo = true
    and lower(u.email) = 'supervisaosalas@clinicaceu.com.br'
  limit 1
$$;
grant execute on function public.obter_chat_salas_coordenadora() to authenticated;
