-- Carga assistida de servidores informada em 10/09/2026.
-- Executar no SQL Editor do Lovable.
-- IP 10.66.168.2 foi preservado como MATRIZ por pertencer ao inventário da MATRIZ.
-- O registro sem IP não é inserido; o IP 192.168.1.225 repetido é consolidado em uma linha.
begin;

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.205'::inet, 'SERVIDOR MATRIZ', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'VMWARE PRINCIPAL')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.152'::inet, 'SERVIDOR MATRIZ', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'FISICO', 'IDRAC PRINCIPAL')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.222'::inet, 'SERVIDOR MATRIZ', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'VMWARE RESERVA 01')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '10.66.168.2'::inet, 'SERVIDOR MATRIZ', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'FISICO', 'IDRAC RESERVA 01; IP de rede interna 10.66.168.x')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.248'::inet, 'SERVIDOR MATRIZ', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'VMWARE PACS')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.247'::inet, 'SERVIDOR MATRIZ', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'FISICO', 'IDRAC PACS')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.240'::inet, 'SERVIDOR MATRIZ', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'VMWARE RESERVA 02')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.77'::inet, 'IPCOM', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'FISICO', null)
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.75'::inet, 'PABX', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'FISICO', null)
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.188'::inet, 'PABX', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'WINDOWS PABX')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.189'::inet, 'PABX', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'FISICO', 'Media Gateway Ramais IP')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.254'::inet, 'FIREWALL', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'IP PRINCIPAL')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.253'::inet, 'FIREWALL', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'IP COMUNICAR MN')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.178'::inet, 'SERVIDOR AD', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', null)
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.174'::inet, 'SERVIDOR WTT', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'DSERVER – 104')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.249'::inet, 'SERVIDOR PACS', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', null)
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.175'::inet, 'SERVIDOR X-CLINIC', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', null)
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.179'::inet, 'SERVIDOR FILESERVER', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'PONTO SECULLUM')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.197'::inet, 'SERVIDOR DOCONLINE', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', null)
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.169'::inet, 'SERVIDOR IMPRESSÃO', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', null)
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.233'::inet, 'SERVIDOR AQUILA', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'IA MAMOGRAFIA')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.226'::inet, 'SERVIDOR REMOTO', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'HOME OFFICE')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.172'::inet, 'SERVIDOR DATA', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'HIPERCUSTO')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.110'::inet, 'SERVIDOR CLINUX', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'FISICO', 'FREEBSD')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.191'::inet, 'SERVIDOR CLINUX', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'FISICO', 'IDRAC')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.105'::inet, 'SERVIDOR CLINUX', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'SECUNDARIO FREEBSD')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.238'::inet, 'SERVIDOR CLINUX', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'VM Portal')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.239'::inet, 'SERVIDOR CLINUX', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'VM Integração')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.250'::inet, 'SERVIDOR IMAGENS', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'BKP IMAGENS NUVEM')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.251'::inet, 'SERVIDOR PACS', 'INFORMATICA', 'INFORMATICA', '2° ANDAR', 'VIRTUAL', 'PACS')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.221'::inet, 'ANTENA', 'INFORMATICA', 'INFORMATICA', 'FRENTE FRANCISCO SALES', 'FISICO', null)
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.150'::inet, 'WHATSAPP', 'INFORMATICA', 'INFORMATICA', 'FUJITEL', 'FISICO', 'INTEGRAÇÃO WHATS + WELLON')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MN', 'servidores', '192.168.1.254'::inet, 'FIREWALL', 'MN NUCLEAR', 'MN NUCLEAR', 'SUB-SOLO', 'VIRTUAL', null)
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MN', 'servidores', '192.168.1.225'::inet, 'SERVIDOR DE BACKUP', 'MN NUCLEAR', 'MN NUCLEAR', 'SUB-SOLO', 'VIRTUAL', 'VMWARE; IDRAC — mesmo IP informado duas vezes; revisar cadastro')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MN', 'servidores', '192.168.1.173'::inet, 'SERVIDOR DE BACKUP', 'MN NUCLEAR', 'MN NUCLEAR', 'SUB-SOLO', 'VIRTUAL', 'VM WINDOWS')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.controle_ip (unidade, categoria, ip, nome, local, setor, andar, modelo, observacoes)
values ('MATRIZ', 'servidores', '192.168.0.220'::inet, 'ANTENA', 'INFORMATICA', 'INFORMATICA', 'TELHADO', 'FISICO', null)
on conflict (ip) where ip is not null do update set unidade=excluded.unidade, categoria=excluded.categoria, nome=excluded.nome, local=excluded.local, setor=excluded.setor, andar=excluded.andar, modelo=excluded.modelo, observacoes=excluded.observacoes, atualizado_em=now();

insert into public.audit_logs (tabela, operacao, observacoes, dados_novos)
values (
  'controle_ip',
  'IMPORT',
  'Carga assistida de servidores; registro sem IP ignorado e IP duplicado consolidado.',
  jsonb_build_object('categoria', 'servidores', 'registros_unicos', 36, 'ip_fora_faixa', '10.66.168.2', 'sem_ip', 1, 'duplicado', '192.168.1.225')
);

commit;
