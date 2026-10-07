-- Permite que as duas coordenadoras troquem mensagens diretamente,
-- sem abrir as conversas das colaboradoras de um setor para o outro.
create or replace function public.chat_coordenadora_entre_setores(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public, auth as $$
  select public.is_ativo(_user_id)
    and exists (
      select 1 from auth.users
      where id = _user_id
        and lower(email) in (
          'supervisaosalas@clinicaceu.com.br',
          'supervisaenfermagem@clinicaceu.com.br'
        )
    )
    or exists (
      select 1 from public.usuario_permissoes up
      where up.user_id = _user_id and up.modulo = 'chat_enfermagem_coordenacao'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = _user_id and lower(coalesce(p.setor, '')) = 'coordenacao'
    )
$$;
grant execute on function public.chat_coordenadora_entre_setores(uuid) to authenticated;

create or replace function public.chat_coordenadoras_sao_partes(_remetente uuid, _destinatario uuid)
returns boolean
language sql stable security definer set search_path = public, auth as $$
  select public.chat_coordenadora_entre_setores(_remetente)
    and public.chat_coordenadora_entre_setores(_destinatario)
$$;
grant execute on function public.chat_coordenadoras_sao_partes(uuid, uuid) to authenticated;

create or replace function public.obter_chat_coordenadoras()
returns table (id uuid, nome text, setor text, ativo boolean, email text)
language sql stable security definer set search_path = public, auth as $$
  select p.id, p.nome, p.setor, p.ativo, lower(u.email)
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.ativo = true
    and (
      lower(u.email) in ('supervisaosalas@clinicaceu.com.br', 'supervisaenfermagem@clinicaceu.com.br')
      or lower(coalesce(p.setor, '')) = 'coordenacao'
      or exists (
        select 1 from public.usuario_permissoes up
        where up.user_id = p.id and up.modulo = 'chat_enfermagem_coordenacao'
      )
    )
  order by p.nome
$$;
grant execute on function public.obter_chat_coordenadoras() to authenticated;

-- As coordenadoras continuam podendo acessar seus próprios canais e, além disso,
-- podem consultar/enviar a conversa direta entre si.
create or replace function public.pode_chat_salas(_user_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select public.is_ativo(_user_id) and (
    public.is_admin(_user_id)
    or public.chat_coordenadora_entre_setores(_user_id)
    or exists (select 1 from public.usuario_permissoes where user_id = _user_id and modulo = 'chat_salas')
    or exists (select 1 from public.profiles where id = _user_id and lower(coalesce(setor, '')) in ('operacao', 'salas'))
  )
$$;

create or replace function public.pode_chat_enfermagem(_user_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select public.is_ativo(_user_id) and (
    public.is_admin(_user_id)
    or public.chat_coordenadora_entre_setores(_user_id)
    or exists (select 1 from public.usuario_permissoes where user_id = _user_id and modulo in ('chat_enfermagem', 'chat_enfermagem_coordenacao'))
    or exists (select 1 from public.profiles where id = _user_id and lower(coalesce(setor, '')) = 'enfermagem')
  )
$$;

-- Reaplica as políticas sem permitir que uma coordenadora veja o histórico
-- completo do outro setor.
drop policy if exists chat_salas_mensagens_select on public.chat_salas_mensagens;
create policy chat_salas_mensagens_select on public.chat_salas_mensagens
for select to authenticated using (
  public.is_master(auth.uid())
  or (canal = 'salas' and public.pode_chat_salas(auth.uid()) and (
    remetente_id = auth.uid() or destinatario_id = auth.uid()
    or public.chat_salas_eh_coordenadora(auth.uid())
    or public.chat_coordenadoras_sao_partes(remetente_id, destinatario_id)
  ))
  or (canal = 'enfermagem' and public.pode_chat_enfermagem(auth.uid()) and (
    remetente_id = auth.uid() or destinatario_id = auth.uid()
    or public.chat_enfermagem_eh_coordenadora(auth.uid())
    or public.chat_coordenadoras_sao_partes(remetente_id, destinatario_id)
  ))
);

drop policy if exists chat_salas_mensagens_insert on public.chat_salas_mensagens;
create policy chat_salas_mensagens_insert on public.chat_salas_mensagens
for insert to authenticated with check (
  (canal = 'salas' and public.pode_chat_salas(auth.uid()) and remetente_id = auth.uid()
    and public.pode_chat_salas(destinatario_id)
    and (public.chat_salas_eh_coordenadora(auth.uid())
      or public.chat_salas_eh_coordenadora(destinatario_id)
      or public.chat_coordenadoras_sao_partes(remetente_id, destinatario_id)))
  or (canal = 'enfermagem' and public.pode_chat_enfermagem(auth.uid()) and remetente_id = auth.uid()
    and public.pode_chat_enfermagem(destinatario_id)
    and (public.chat_enfermagem_eh_coordenadora(auth.uid())
      or public.chat_enfermagem_eh_coordenadora(destinatario_id)
      or public.chat_coordenadoras_sao_partes(remetente_id, destinatario_id)))
);

drop policy if exists chat_salas_mensagens_update on public.chat_salas_mensagens;
create policy chat_salas_mensagens_update on public.chat_salas_mensagens
for update to authenticated using (
  public.is_master(auth.uid())
  or (canal = 'salas' and public.pode_chat_salas(auth.uid()) and (
    destinatario_id = auth.uid() or public.chat_salas_eh_coordenadora(auth.uid())
    or public.chat_coordenadoras_sao_partes(remetente_id, destinatario_id)
  ))
  or (canal = 'enfermagem' and public.pode_chat_enfermagem(auth.uid()) and (
    destinatario_id = auth.uid() or public.chat_enfermagem_eh_coordenadora(auth.uid())
    or public.chat_coordenadoras_sao_partes(remetente_id, destinatario_id)
  ))
) with check (
  public.is_master(auth.uid())
  or (canal = 'salas' and public.pode_chat_salas(auth.uid()) and (
    destinatario_id = auth.uid() or public.chat_salas_eh_coordenadora(auth.uid())
    or public.chat_coordenadoras_sao_partes(remetente_id, destinatario_id)
  ))
  or (canal = 'enfermagem' and public.pode_chat_enfermagem(auth.uid()) and (
    destinatario_id = auth.uid() or public.chat_enfermagem_eh_coordenadora(auth.uid())
    or public.chat_coordenadoras_sao_partes(remetente_id, destinatario_id)
  ))
);
