-- Corrige o rótulo incorreto criado para as opções de colaboradoras.
-- A verificação evita erro quando a migration de configuração do menu ainda não foi aplicada.
do $do$
begin
  if to_regclass('public.menu_itens') is not null then
    update public.menu_itens
    set rotulo = 'Colaboradoras'
    where chave in ('colaboradoras', 'colaboradoras-enfermagem')
      and lower(btrim(rotulo)) = 'colaborar';
  end if;
end
$do$;
