-- Corrige apenas o rótulo incorreto criado para as opções de colaboradoras.
-- Outras personalizações feitas pelo administrador permanecem intactas.
update public.menu_itens
set rotulo = 'Colaboradoras'
where chave in ('colaboradoras', 'colaboradoras-enfermagem')
  and lower(btrim(rotulo)) = 'colaborar';
