from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

SOURCE = Path('/home/ubuntu/upload/pasted_content_2.txt')
OUTPUT = Path('/home/ubuntu/ceu-care-hub/scripts/inventario_ip_extraido.json')
IP_RE = re.compile(r'(?<!\d)(192\.168\.(?:0|1|10)\.\d{1,3})(?!\d)')


def categoria(texto: str) -> str:
    t = texto.upper()
    if any(x in t for x in ('IMPRESS', 'BROTHER', 'KONICA')):
        return 'impressoras'
    if 'SERVIDOR' in t:
        return 'servidores'
    if 'WIFI' in t or 'WI-FI' in t or 'ACCESS POINT' in t:
        return 'wifi'
    if 'ROTEADOR' in t:
        return 'roteadores'
    if 'SWITCH' in t:
        return 'switch'
    if 'DVR' in t:
        return 'dvr'
    if 'TV' in t or 'TELEVIS' in t:
        return 'tv_corporativas'
    if 'RELÓGIO' in t or 'RELOGIO' in t or 'PONTO' in t:
        return 'relogio_ponto'
    if 'ATL' in t:
        return 'atl'
    return 'computadores'


def unidade(ip: str, texto: str) -> str | None:
    if ip.startswith('192.168.0.') or any(x in texto.upper() for x in ('ECO', 'MAMOGRAFIA')):
        return 'MATRIZ'
    if ip.startswith('192.168.1.'):
        return 'MN'
    return None


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = re.sub(r'\s+', ' ', value).strip(' -')
    return value or None


def block_for_index(index: int) -> tuple[int, int]:
    if index <= 4:
        return 0, 5
    if index <= 8:
        return 5, 9
    return 9, 14


rows = []
for line_no, raw in enumerate(SOURCE.read_text(encoding='utf-8').splitlines(), 1):
    cells = [clean(x) for x in raw.split('\t')]
    for index, cell in enumerate(cells):
        if not cell or not IP_RE.fullmatch(cell):
            continue
        ip = cell
        start, end = block_for_index(index)
        block = cells[start:end]
        relative_ip = index - start
        preceding = [x for x in block[:relative_ip] if x]
        following = [x for x in block[relative_ip + 1:] if x]
        andar = preceding[0] if start == 0 and preceding else None
        nome = preceding[-1] if preceding else f'Equipamento {ip}'
        local = preceding[-2] if len(preceding) >= 2 else None
        contexto = clean(' '.join(x for x in block if x)) or f'Linha {line_no}'
        observacao = clean(' | '.join(following))
        rows.append({
            'source_line': line_no,
            'source': raw,
            'ip_original': ip,
            'ip': ip if ip.startswith(('192.168.0.', '192.168.1.')) else None,
            'unidade': unidade(ip, contexto),
            'categoria': categoria(contexto),
            'nome': nome[:160],
            'local': local[:200] if local else None,
            'setor': local[:200] if local else None,
            'andar': andar[:80] if andar else None,
            'observacoes': observacao,
        })

OUTPUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
validos = [r for r in rows if r['ip']]
duplicados = sorted(ip for ip, total in Counter(r['ip'] for r in validos).items() if total > 1)
print(json.dumps({
    'total_ips_extraidos': len(rows),
    'validos_faixas_aplicacao': len(validos),
    'fora_faixas_aplicacao': len(rows) - len(validos),
    'categorias': dict(Counter(r['categoria'] for r in validos)),
    'unidades': dict(Counter(r['unidade'] for r in validos)),
    'ips_duplicados': duplicados,
}, ensure_ascii=False))
