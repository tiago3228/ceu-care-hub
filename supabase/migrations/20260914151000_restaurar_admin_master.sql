-- Restaura o usuário mestre caso a troca de perfil tenha deixado a conta sem role.
-- Pode ser executado isoladamente no SQL Editor do Lovable.
insert into public.user_roles (user_id, role)
select p.id, 'admin_master'::public.app_role
from public.profiles p
where lower(p.login) = lower('informatica@clinicaceu.com.br')
on conflict (user_id, role) do nothing;
