-- Anexos privados dos chats de Salas e Enfermagem.
alter table public.chat_salas_mensagens
  alter column mensagem drop not null;

alter table public.chat_salas_mensagens
  add column if not exists anexo_path text,
  add column if not exists anexo_nome text,
  add column if not exists anexo_tipo text,
  add column if not exists anexo_tamanho integer;

alter table public.chat_salas_mensagens
  drop constraint if exists chat_salas_mensagens_mensagem_check;
alter table public.chat_salas_mensagens
  add constraint chat_salas_mensagens_conteudo_check
  check ((nullif(btrim(mensagem), '') is not null) or anexo_path is not null);

insert into storage.buckets (id, name, public)
values ('chat-anexos', 'chat-anexos', false)
on conflict (id) do update set public = false;

drop policy if exists chat_anexos_insert on storage.objects;
create policy chat_anexos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'chat-anexos'
  and (storage.foldername(name))[1] in ('salas', 'enfermagem')
  and (storage.foldername(name))[2] = auth.uid()::text
  and (
    (storage.foldername(name))[1] = 'salas' and public.pode_chat_salas(auth.uid())
    or (storage.foldername(name))[1] = 'enfermagem' and public.pode_chat_enfermagem(auth.uid())
  )
);

drop policy if exists chat_anexos_select on storage.objects;
create policy chat_anexos_select on storage.objects
for select to authenticated
using (
  bucket_id = 'chat-anexos'
  and (
    ((storage.foldername(name))[1] = 'salas'
      and public.pode_chat_salas(auth.uid())
      and ((storage.foldername(name))[2] = auth.uid()::text or (storage.foldername(name))[3] = auth.uid()::text or public.chat_salas_eh_coordenadora(auth.uid())))
    or ((storage.foldername(name))[1] = 'enfermagem'
      and public.pode_chat_enfermagem(auth.uid())
      and ((storage.foldername(name))[2] = auth.uid()::text or (storage.foldername(name))[3] = auth.uid()::text or public.chat_enfermagem_eh_coordenadora(auth.uid())))
  )
);

drop policy if exists chat_anexos_delete on storage.objects;
create policy chat_anexos_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'chat-anexos'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- A coordenadora do canal de Enfermagem é identificada pelo e-mail institucional.
create or replace function public.chat_enfermagem_eh_coordenadora(_user_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select public.pode_chat_enfermagem(_user_id)
    and (
      exists (
        select 1 from public.usuario_permissoes
        where user_id = _user_id and modulo = 'chat_enfermagem_coordenacao'
      )
      or exists (
        select 1 from auth.users
        where id = _user_id and lower(email) = 'supervisaenfermagem@clinicaceu.com.br'
      )
    )
$$;

create or replace function public.obter_chat_enfermagem_coordenadora()
returns table (id uuid, nome text, setor text, ativo boolean)
language sql stable security definer set search_path = public, auth as $$
  select p.id, p.nome, p.setor, p.ativo
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.ativo = true
    and (lower(u.email) = 'supervisaenfermagem@clinicaceu.com.br' or lower(p.nome) like '%coorden%')
  order by (lower(u.email) = 'supervisaenfermagem@clinicaceu.com.br') desc, p.nome
  limit 1
$$;
grant execute on function public.obter_chat_enfermagem_coordenadora() to authenticated;
