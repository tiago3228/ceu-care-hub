-- Reutiliza a estrutura de mensagens com canais independentes.
alter table public.chat_salas_mensagens
  add column if not exists canal text not null default 'salas';

alter table public.chat_salas_mensagens
  drop constraint if exists chat_salas_mensagens_canal_check;
alter table public.chat_salas_mensagens
  add constraint chat_salas_mensagens_canal_check
  check (canal in ('salas', 'enfermagem'));

create index if not exists chat_salas_canal_conversa_idx
  on public.chat_salas_mensagens (canal, criado_em);

create or replace function public.pode_chat_enfermagem(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_ativo(_user_id) and (
    public.is_admin(_user_id)
    or exists (select 1 from public.usuario_permissoes where user_id = _user_id and modulo = 'chat_enfermagem')
    or exists (select 1 from public.usuario_permissoes where user_id = _user_id and modulo = 'chat_enfermagem_coordenacao')
    or exists (select 1 from public.profiles where id = _user_id and lower(coalesce(setor, '')) = 'enfermagem')
  )
$$;

create or replace function public.chat_enfermagem_eh_coordenadora(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_chat_enfermagem(_user_id) and (
    exists (select 1 from public.usuario_permissoes where user_id = _user_id and modulo = 'chat_enfermagem_coordenacao')
    or exists (select 1 from public.profiles where id = _user_id and lower(coalesce(nome, '')) like '%coorden%')
  )
$$;

-- As policies abrangem os dois canais, mantendo cada conversa isolada.
drop policy if exists chat_salas_mensagens_select on public.chat_salas_mensagens;
create policy chat_salas_mensagens_select on public.chat_salas_mensagens for select to authenticated using (
  (canal = 'salas' and public.pode_chat_salas(auth.uid()) and (remetente_id = auth.uid() or destinatario_id = auth.uid() or public.chat_salas_eh_coordenadora(auth.uid())))
  or (canal = 'enfermagem' and public.pode_chat_enfermagem(auth.uid()) and (remetente_id = auth.uid() or destinatario_id = auth.uid() or public.chat_enfermagem_eh_coordenadora(auth.uid())))
);

drop policy if exists chat_salas_mensagens_insert on public.chat_salas_mensagens;
create policy chat_salas_mensagens_insert on public.chat_salas_mensagens for insert to authenticated with check (
  (canal = 'salas' and public.pode_chat_salas(auth.uid()) and remetente_id = auth.uid() and public.pode_chat_salas(destinatario_id) and (public.chat_salas_eh_coordenadora(auth.uid()) or public.chat_salas_eh_coordenadora(destinatario_id)))
  or (canal = 'enfermagem' and public.pode_chat_enfermagem(auth.uid()) and remetente_id = auth.uid() and public.pode_chat_enfermagem(destinatario_id) and (public.chat_enfermagem_eh_coordenadora(auth.uid()) or public.chat_enfermagem_eh_coordenadora(destinatario_id)))
);

drop policy if exists chat_salas_mensagens_update on public.chat_salas_mensagens;
create policy chat_salas_mensagens_update on public.chat_salas_mensagens for update to authenticated using (
  (canal = 'salas' and public.pode_chat_salas(auth.uid()) and (destinatario_id = auth.uid() or public.chat_salas_eh_coordenadora(auth.uid())))
  or (canal = 'enfermagem' and public.pode_chat_enfermagem(auth.uid()) and (destinatario_id = auth.uid() or public.chat_enfermagem_eh_coordenadora(auth.uid())))
) with check (
  (canal = 'salas' and public.pode_chat_salas(auth.uid()) and (destinatario_id = auth.uid() or public.chat_salas_eh_coordenadora(auth.uid())))
  or (canal = 'enfermagem' and public.pode_chat_enfermagem(auth.uid()) and (destinatario_id = auth.uid() or public.chat_enfermagem_eh_coordenadora(auth.uid())))
);

insert into public.menu_itens
  (chave, grupo, grupo_ordem, rotulo, destino, icone, modulo, ordem, somente_admin)
values
  ('chat-enfermagem', 'Enfermagem', 40, 'Chat da Enfermagem', '/chat-enfermagem', 'MessageCircle', 'chat_enfermagem', 80, false)
on conflict (chave) do nothing;

drop policy if exists profiles_chat_salas_select on public.profiles;
create policy profiles_chat_salas_select on public.profiles for select to authenticated
using (public.pode_chat_salas(auth.uid()) or public.pode_chat_enfermagem(auth.uid()));
