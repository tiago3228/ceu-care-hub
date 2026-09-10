-- Carga assistida de Ultrasson informada em 10/09/2026.
-- Executar no SQL Editor do Lovable.
-- AETitle, Worklist, porta e observações permanecem editáveis.
begin;

insert into public.controle_ip (unidade,categoria,ip,nome,local,setor,porta,ae_title,worklist,observacoes) values
('MATRIZ','ultrasson','192.168.0.96'::inet,'Ultrasson Sala 1','SALA 1','SALA 1','104','SALA01','wlus1',null),
('MATRIZ','ultrasson','192.168.0.192'::inet,'Ultrasson Sala 2','SALA 2','SALA 2','104','SALA2','wlus2',null),
('MATRIZ','ultrasson','192.168.0.195'::inet,'Ultrasson Sala 3','SALA 3','SALA 3','104','SALA03','wlus3',null),
('MATRIZ','ultrasson','192.168.0.181'::inet,'Ultrasson Sala 4','SALA 4','SALA 4','104','SALA04','wlus4',null),
('MATRIZ','ultrasson','192.168.0.200'::inet,'Ultrasson Sala 5','SALA 5','SALA 5','104','SALA5','wlus5','Aplio A'),
('MATRIZ','ultrasson','192.168.0.194'::inet,'Ultrasson Sala 7','SALA 7','SALA 7','104','SALA7','wlus7','Nuewa 19 Mindray'),
('MATRIZ','ultrasson','192.168.0.230'::inet,'Ultrasson Sala 8','SALA 8','SALA 8','104','US2003','wlus8','Samsung Heraw9'),
('MATRIZ','ultrasson','192.168.0.182'::inet,'Ultrasson Sala 9','SALA 9','SALA 9','104','SALA9','wlus9',null),
('MATRIZ','ultrasson','192.168.0.193'::inet,'Ultrasson Sala 10','SALA 10','SALA 10','104','SALA10','wlus10',null),
('MATRIZ','ultrasson','192.168.0.98'::inet,'Ultrasson Sala 11','SALA 11','SALA 11','104','SALA11','wlus11','Samsung v7'),
('MATRIZ','ultrasson','192.168.0.199'::inet,'Ultrasson Sala 12','SALA 12','SALA 12','104','SALA12','wlus12','Aplio A'),
('MATRIZ','ultrasson','192.168.0.196'::inet,'Ultrasson Sala 14','SALA 14','SALA 14','104','SALA14','wlus14','Aplio 400'),
('MATRIZ','ultrasson','192.168.0.187'::inet,'Ultrasson ECO 1','ECO 1','ECO 1','104','WS80A','wluseco1','Dr. Carneiro'),
('MATRIZ','ultrasson','192.168.0.99'::inet,'Ultrasson ECO 2','ECO 2','ECO 2','104','I600','wluseco2','Dr. RAPS'),
('MATRIZ','ultrasson',null,'LIS','LIS','LIS',null,null,null,'Sem aparelho'),
('MATRIZ','ultrasson',null,'Ultrasson Portátil','Portátil','Portátil',null,null,null,'Mindray'),
('MN','ultrasson','192.168.1.22'::inet,'Ultrasson MN Sala 1','SALA 1','SALA 1','104','VIVIDT8','wlecocardio1',null),
('MN','ultrasson','192.168.1.36'::inet,'Ultrasson MN Sala 2','SALA 2','SALA 2','104','LOGIQ7','wlecocardio2',null),
('MN','ultrasson','192.168.1.171'::inet,'Ultrasson MN Sala 3','SALA 3','SALA 3','104','AFFINIT070','wlecocardio3',null),
('MATRIZ','ultrasson','192.168.0.64'::inet,'Densitometria','Densitrometria','Densitrometria','104','DENSITROMETRIA','wldo','AETitle: GELUNAR')
on conflict (ip) where ip is not null do update set unidade=excluded.unidade,categoria=excluded.categoria,nome=excluded.nome,local=excluded.local,setor=excluded.setor,porta=excluded.porta,ae_title=excluded.ae_title,worklist=excluded.worklist,observacoes=excluded.observacoes,atualizado_em=now();

insert into public.audit_logs (tabela,operacao,observacoes,dados_novos)
values ('controle_ip','IMPORT','Carga assistida de Ultrassom/Outros; locais sem aparelho preservados sem IP.',jsonb_build_object('categoria','ultrasson','registros',20,'com_ip',18,'sem_ip',2));
commit;
