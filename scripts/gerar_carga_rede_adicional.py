from pathlib import Path

OUT = Path('/home/ubuntu/ceu-care-hub/supabase/seed/20260910_carga_rede_adicional.sql')

def q(value):
    if value is None or value == '': return 'null'
    return "'" + str(value).replace("'", "''") + "'"

def stmt(unidade, categoria, ip, nome, local=None, setor=None, andar=None, modelo=None, fabricante=None, mac=None, porta=None, obs=None):
    cols = ['unidade','categoria','nome','local','setor','andar','modelo','fabricante','mac_address','porta','observacoes']
    vals = [q(unidade),q(categoria),q(nome),q(local),q(setor),q(andar),q(modelo),q(fabricante),q(mac),q(porta),q(obs)]
    if ip:
        cols.insert(2, 'ip'); vals.insert(2, q(ip)+'::inet')
        conflict = "on conflict (ip) where ip is not null do update set " + ','.join(f'{c}=excluded.{c}' for c in cols if c not in ('ip','unidade')) + ',unidade=excluded.unidade,atualizado_em=now();'
    else:
        conflict = ';'
    return f"insert into public.controle_ip ({','.join(cols)}) values ({','.join(vals)}) {conflict}"

items = []
# Roteadores
routers = [
 ('MATRIZ','192.168.0.244','REUNIÃO','4° ANDAR'),('MATRIZ','192.168.0.87','QUALIDADE','4° ANDAR'),('MATRIZ','192.168.0.93','FINANCEIRO','4° ANDAR'),('MATRIZ','192.168.0.106','RECEPÇÃO MAMOGRAFIA','3° ANDAR'),('MATRIZ','192.168.0.89','RECEPÇÃO ECO','3° ANDAR'),('MATRIZ','192.168.0.92','GERENCIA','3° ANDAR'),('MATRIZ','192.168.0.94','VESTIARIO','2° ANDAR'),('MATRIZ','192.168.0.199','RACK CABEAMENTO','2° ANDAR'),('MATRIZ','192.168.0.246','RECEPÇÃO 2° ANDAR','2° ANDAR'),('MATRIZ','192.168.0.91','ROTEADOR MAMOGRAFIA','2° ANDAR'),('MATRIZ','192.168.0.245','RECEPÇÃO 1° ANDAR','1° ANDAR'),('MN','192.168.1.29','RACK CABEAMENTO','SUB-SOLO'),('MN','192.168.1.30','RACK CABEAMENTO','SUB-SOLO'),('MN','192.168.1.31','ROTEADOR MN','SUB-SOLO')]
for u,ip,local,andar in routers: items.append(stmt(u,'roteadores',ip,'Roteador '+local,local,local,andar,obs='Inventário de roteadores'))
# TV corporativa
for nome,local,ip,mac in [('Player - 4608','4° andar','192.168.0.211','F0:CE:EE:E7:6E:8C'),('Player - 4650','Recepção 2° andar SL 12','192.168.0.218','F0:CE:EE:E7:82:FC'),('Player - 4651','Recepção 2° andar SL07','192.168.0.214','F0:CE:EE:EF:45:70'),('Player - 4652','MN - Recepção','192.168.1.219','F0:CE:EE:E7:67:82'),('Player - 4653','MN - Cintilografia','192.168.1.215','F0:CE:EE:EF:5A:4D'),('Player - 4654','Recepção 1° andar','192.168.0.216','F0:CE:EE:E7:7C:E0'),('Player - 4655','Recepção ECO','192.168.0.217','F0:CE:EE:E4:D3:D5'),('Player - 4656','MN - Copa','192.168.1.213','F0:CE:EE:E7:83:06'),('Player - 4660','Mamografia - Recepção','192.168.0.212','F0:CE:EE:EA:25:3B')]:
    u = 'MN' if ip.startswith('192.168.1.') else 'MATRIZ'; items.append(stmt(u,'tv_corporativas',ip,nome,local,local,mac=mac,obs='TV Corporativa'))
# Switches
for ip,modelo,obs in [('192.168.0.10','HP','Gerenciável'),('192.168.0.11','PowerConnect 5424','Gerenciável'),('192.168.0.12','PowerConnect 5424','Gerenciável'),('192.168.0.1','Intelbras 5200mr','Gerenciável')]:
    items.append(stmt('MATRIZ','switch',ip,'Switch Matriz','Matriz','Matriz',modelo=modelo,obs=obs))
# ATL
for u, values in [('MATRIZ',[('192.168.0.104','567-671'),('192.168.0.105','565'),('192.168.0.112','515-516'),('192.168.0.107','601/602'),('192.168.0.108','603'),('192.168.0.109','NÃO USOU'),('192.168.0.119','516')]),('MN',[('192.168.1.246','588'),('192.168.1.243','585'),('192.168.1.247','547/511'),('192.168.1.245','582/589'),('192.168.1.240','580/581'),('192.168.1.242','587/592'),('192.168.1.170','594'),('192.168.1.244','572')])]:
    for ip,ramais in values: items.append(stmt(u,'atl',ip,'ATL '+u,'ATL', 'ATL', porta=ramais, obs='Ramais: '+ramais))
# Relógio de ponto
for u,ip,local,andar,modelo in [('MATRIZ','192.168.0.236','PROXIMO DP','4° ANDAR','KP 1510'),('MATRIZ','192.168.0.108','PROXIMO COMPRAS','3° ANDAR','CONTROL ID'),('MATRIZ','192.168.0.107','PROXIMO COPA','2° ANDAR','KP 1510'),('MN','192.168.1.236','PROXIMO COPA','SUBSOLO','BIOMETRUS')]:
    items.append(stmt(u,'relogio_ponto',ip,'Relógio de Ponto '+local,local,local,andar,modelo=modelo,obs=modelo))

sql = ['-- Carga assistida de roteadores, TVs corporativas, switches, ATL e relógios de ponto.', '-- Executar no SQL Editor do Lovable. -- UPSERT por IP: sem exclusões e sem duplicidades.', 'begin;'] + items + ["insert into public.audit_logs (tabela,operacao,observacoes,dados_novos) values ('controle_ip','IMPORT','Carga assistida de equipamentos de rede e telefonia.',jsonb_build_object('roteadores',14,'tv_corporativas',9,'switch',4,'atl',15,'relogio_ponto',4,'total',46));", 'commit;']
OUT.write_text('\n'.join(sql)+'\n', encoding='utf-8')
print(f'gerados={len(items)} arquivo={OUT}')
