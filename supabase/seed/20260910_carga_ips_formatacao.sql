-- Carga assistida de IPs Formatação informada em 10/09/2026.
-- Executar no SQL Editor do Lovable após a migration da categoria.
begin;

insert into public.controle_ip
  (unidade, categoria, ip, nome, local, setor, observacoes)
values
  ('MATRIZ', 'ips_formatacao', '192.168.0.5'::inet, 'IP Formatação 192.168.0.5', 'Formatação', 'Formatação', 'IP reservado para formatação'),
  ('MATRIZ', 'ips_formatacao', '192.168.0.8'::inet, 'IP Formatação 192.168.0.8', 'Formatação', 'Formatação', 'IP reservado para formatação')
on conflict (ip) where ip is not null do update set
  unidade = excluded.unidade,
  categoria = excluded.categoria,
  nome = excluded.nome,
  local = excluded.local,
  setor = excluded.setor,
  observacoes = excluded.observacoes,
  atualizado_em = now();

insert into public.audit_logs (tabela, operacao, observacoes, dados_novos)
values (
  'controle_ip',
  'IMPORT',
  'Carga assistida da categoria IPS Formatação.',
  jsonb_build_object('categoria', 'ips_formatacao', 'registros', 2)
);

commit;
