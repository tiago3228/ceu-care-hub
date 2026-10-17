#!/usr/bin/env python3
"""Gera uma carga SQL para os materiais recebidos em LAUDOS.zip.

Uso: python3 scripts/import-laudos-pacote.py /caminho/LAUDOS.zip supabase/seed/20261016_carga_laudos.sql
"""
from __future__ import annotations
import io, re, sys, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

SUPPORTED = {'.docx', '.doc', '.docm', '.dotx', '.odt', '.rtf', '.txt', '.pdf'}
IGNORED = ('~$', '.~lock', 'thumbs.db', 'desktop.ini')


def clean_name(value: str) -> str:
    value = value.replace('\\', '/').strip('/')
    return Path(value).stem.replace('_', ' ').strip() or 'Material sem título'


def sql(value: str | None) -> str:
    if value is None:
        return 'null'
    return "'" + value.replace('\\', '\\\\').replace("'", "''") + "'"


def normalize(value: str) -> str:
    import unicodedata
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower()
    value = re.sub(r'^(dra?\.?|medico|medica)\s+', '', value)
    return re.sub(r'[^a-z0-9]+', ' ', value).strip()


def rtf_text(raw: bytes) -> str:
    text = raw.decode('cp1252', errors='replace')
    text = re.sub(r"\\'[0-9a-fA-F]{2}", lambda m: bytes.fromhex(m.group()[2:]).decode('cp1252', 'replace'), text)
    text = re.sub(r'\\u(-?\d+)\??', lambda m: chr(int(m.group(1)) if int(m.group(1)) >= 0 else int(m.group(1)) + 65536), text)
    text = re.sub(r'\\(par|line)\b', '\n', text)
    text = re.sub(r'\\tab\b', '\t', text)
    text = re.sub(r'\\[a-zA-Z]+-?\d* ?', '', text)
    text = re.sub(r'[{}]', '', text)
    return re.sub(r'\n{3,}', '\n\n', text).strip()


def xml_text(raw: bytes, member: str, namespaces: dict[str, str]) -> str:
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        xml = z.read(member)
    root = ET.fromstring(xml)
    paragraphs = []
    current = []
    for node in root.iter():
        tag = node.tag.rsplit('}', 1)[-1]
        if tag in ('t', 'tab') and node.text:
            current.append(('\t' if tag == 'tab' else node.text))
        elif tag in ('p', 'text:p'):
            if current:
                paragraphs.append(''.join(current).strip())
                current = []
    if current:
        paragraphs.append(''.join(current).strip())
    if not paragraphs:
        paragraphs = [t.strip() for t in root.itertext() if t.strip()]
    return '\n'.join(p for p in paragraphs if p).strip()


def text_from_bytes(name: str, raw: bytes) -> str:
    ext = Path(name).suffix.lower()
    if ext == '.rtf':
        return rtf_text(raw)
    if ext in ('.docx', '.docm', '.dotx'):
        try:
            return xml_text(raw, 'word/document.xml', {})
        except Exception:
            return ''
    if ext == '.odt':
        try:
            return xml_text(raw, 'content.xml', {})
        except Exception:
            return ''
    if ext == '.txt':
        return raw.decode('utf-8-sig', errors='replace').strip()
    return ''


def category(path: str) -> str:
    lower = normalize(path)
    if 'atestado' in lower or '/atestados/' in lower:
        return 'atestado'
    if 'ajuda' in lower or 'frases' in lower or 'atalhos' in lower:
        return 'ajuda'
    return 'outros'


def doctor_hint(path: str) -> str | None:
    parts = Path(path).parts
    filename = Path(path).stem
    if re.match(r'^(ajuda|atalhos)\s+', filename, flags=re.I):
        return re.sub(r'^(ajuda|atalhos)\s+', '', filename, flags=re.I)
    for part in reversed(parts[:-1]):
        n = normalize(part)
        if n in {'laudos', 'go', 'medicina interna', 'medicina nuclear', 'biopsias', 'atestados'}:
            continue
        if n.startswith('ajuda '):
            return re.sub(r'^(ajuda|atalhos)\s+', '', part, flags=re.I)
        if n.startswith('dr ') or n.startswith('dra '):
            return part
        if len(n.split()) >= 2 and n not in {'nova pasta', 'laudos padrao', 'us modelos'}:
            return part
    return None


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    source, output = Path(sys.argv[1]), Path(sys.argv[2])
    files: list[tuple[str, bytes]] = []
    if source.is_file() and source.suffix.lower() == '.zip':
        with zipfile.ZipFile(source) as z:
            files = [(n, z.read(n)) for n in z.namelist() if not n.endswith('/')]
    else:
        root = source / 'LAUDOS' if (source / 'LAUDOS').is_dir() else source
        files = [(str(p.relative_to(root)), p.read_bytes()) for p in root.rglob('*') if p.is_file()]

    rows = []
    for name, raw in files:
        base = Path(name).name.lower()
        if any(token.lower() in base for token in IGNORED) or Path(name).suffix.lower() not in SUPPORTED:
            continue
        content = text_from_bytes(name, raw)
        if not content:
            content = 'Arquivo recebido para consulta. O formato original foi preservado no nome de origem.'
        content = content[:120000]
        hint = doctor_hint(name)
        rows.append((hint, category(name), clean_name(name), content, Path(name).name, name))

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('w', encoding='utf-8') as f:
        f.write('-- Carga inicial dos materiais recebidos em LAUDOS.zip.\n')
        f.write('-- Os médicos são vinculados pelo nome normalizado; não encontrados ficam em Outros.\n')
        f.write('insert into public.laudos_materiais (medico_id, categoria, titulo, conteudo_texto, origem_arquivo, caminho_origem, ordem) values\n')
        values = []
        for hint, cat, title, content, filename, path in rows:
            medico = 'null' if not hint else f"(select lm.medico_id from public.laudos_medicos lm join public.medicos m on m.id = lm.medico_id where public.normalizar_nome_medico_laudos(m.nome) = public.normalizar_nome_medico_laudos({sql(hint)}) limit 1)"
            values.append(f"  ({medico}, {sql(cat)}, {sql(title)}, {sql(content)}, {sql(filename)}, {sql(path)}, 0)")
        f.write(',\n'.join(values))
        f.write('\non conflict do nothing;\n')
    print(f'gerados {len(rows)} materiais em {output}')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
