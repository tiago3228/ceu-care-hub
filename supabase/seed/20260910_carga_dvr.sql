-- Carga assistida de DVRs informada em 10/09/2026.
-- Executar no SQL Editor do Lovable.
-- UPSERT por IP: não cria duplicidades e não remove registros.
begin;

insert into public.controle_ip
  (unidade, categoria, ip, nome, local, setor, porta, observacoes)
values
  ('MATRIZ', 'dvr', '192.168.0.207'::inet, 'DVR Matriz', 'Matriz', 'Matriz', '8000/80001', 'Porta de acesso externo: 554')
on conflict (ip) where ip is not null do update set
  unidade = excluded.unidade,
  categoria = excluded.categoria,
  nome = excluded.nome,
  local = excluded.local,
  setor = excluded.setor,
  porta = excluded.porta,
  observacoes = excluded.observacoes,
  atualizado_em = now();

insert into public.controle_ip
  (unidade, categoria, ip, nome, local, setor, porta, observacoes)
values
  ('MATRIZ', 'dvr', '192.168.0.208'::inet, 'DVR ECO', 'ECO', 'ECO', '7000/70001', 'Porta de acesso externo: 1024')
on conflict (ip) where ip is not null do update set
  unidade = excluded.unidade,
  categoria = excluded.categoria,
  nome = excluded.nome,
  local = excluded.local,
  setor = excluded.setor,
  porta = excluded.porta,
  observacoes = excluded.observacoes,
  atualizado_em = now();

insert into public.controle_ip
  (unidade, categoria, ip, nome, local, setor, porta, observacoes)
values
  ('MN', 'dvr', '192.168.1.65'::inet, 'DVR Medicina Nuclear', 'Medicina Nuclear', 'Medicina Nuclear', '80/37777', 'Porta de acesso externo: 554')
on conflict (ip) where ip is not null do update set
  unidade = excluded.unidade,
  categoria = excluded.categoria,
  nome = excluded.nome,
  local = excluded.local,
  setor = excluded.setor,
  porta = excluded.porta,
  observacoes = excluded.observacoes,
  atualizado_em = now();

insert into public.audit_logs (tabela, operacao, observacoes, dados_novos)
values (
  'controle_ip',
  'IMPORT',
  'Carga assistida de 3 DVRs; portas internas e externas preservadas.',
  jsonb_build_object('categoria', 'dvr', 'registros', 3)
);

commit;
