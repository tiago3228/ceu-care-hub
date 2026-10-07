from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

INPUT = Path('/home/ubuntu/ceu-care-hub/scripts/inventario_ip_extraido.json')
OUTPUT = Path('/home/ubuntu/ceu-care-hub/supabase/seed/20260910_carga_inventario_ip.sql')
rows = json.loads(INPUT.read_text(encoding='utf-8'))
by_ip: dict[str, list[dict]] = defaultdict(list)
for row in rows:
    if row['ip']:
        by_ip[row['ip']].append(row)

def sql(value):
    if value is None or value == '':
        return 'null'
    return "'" + str(value).replace("'", "''") + "'"

statements = [
    '-- Carga assistida derivada do inventário anexado em 10/09/2026.',
    '-- Revisar registros marcados como CONFLITO antes de executar no SQL Editor do Lovable.',
    '-- O UPSERT usa IP como chave e não cria duplicidade.',
    'begin;',
]
for ip, items in sorted(by_ip.items()):
    cats = sorted({item['categoria'] for item in items})
    categoria = 'impressoras' if 'impressoras' in cats else cats[0]
    unidade = next((item['unidade'] for item in items if item['unidade']), 'MATRIZ')
    nomes = []
    locais = []
    andares = []
    observacoes = []
    for item in items:
        for field, target in [('nome', nomes), ('local', locais), ('andar', andares)]:
            if item.get(field) and item[field] not in target:
                target.append(item[field])
        origem = f"Linha {item['source_line']}: {item['source'].strip()}"
        if origem not in observacoes:
            observacoes.append(origem)
    conflito = len(items) > 1 or len(cats) > 1
    nome = ' / '.join(nomes)[:160] or f'Equipamento {ip}'
    local = ' / '.join(locais)[:200] or 'A confirmar'
    andar = ' / '.join(andares)[:80] or None
    obs = ('CONFLITO DE IP — revisar cadastro. ' if conflito else '') + ' | '.join(observacoes)
    obs = obs[:4000]
    statements.append(
        'insert into public.controle_ip '
        '(unidade, categoria, ip, nome, local, setor, andar, observacoes) values '
        f"({sql(unidade)}, {sql(categoria)}, {sql(ip)}::inet, {sql(nome)}, {sql(local)}, {sql(local)}, {sql(andar)}, {sql(obs)}) "
        'on conflict (ip) where ip is not null do update set '
        'unidade = excluded.unidade, categoria = excluded.categoria, nome = excluded.nome, '
        'local = excluded.local, setor = excluded.setor, andar = excluded.andar, '
        "observacoes = excluded.observacoes, atualizado_em = now();"
    )
statements += [
    'insert into public.audit_logs (tabela, operacao, observacoes, dados_novos) values '
    "('controle_ip', 'IMPORT', 'Carga assistida do inventário anexado; revisar conflitos marcados.', "
    f"jsonb_build_object('registros_unicos', {len(by_ip)}, 'linhas_validas', {len([r for r in rows if r['ip']])}));",
    'commit;',
]
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text('\n'.join(statements) + '\n', encoding='utf-8')
print(json.dumps({
    'registros_unicos_para_upsert': len(by_ip),
    'linhas_validas': sum(1 for row in rows if row['ip']),
    'conflitos_ip': sorted(ip for ip, items in by_ip.items() if len(items) > 1),
    'fora_faixa': sum(1 for row in rows if not row['ip']),
}, ensure_ascii=False))
