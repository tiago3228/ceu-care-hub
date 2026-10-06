-- Campos específicos para inventário de redes Wi-Fi.
alter table public.controle_ip
  add column if not exists rede_wifi text,
  add column if not exists senha_wifi text;

create index if not exists controle_ip_wifi_rede_idx
  on public.controle_ip(rede_wifi)
  where categoria = 'wifi';

comment on column public.controle_ip.rede_wifi is 'SSID/rede Wi-Fi';
comment on column public.controle_ip.senha_wifi is 'Senha da rede Wi-Fi; protegida pelas políticas do módulo';
