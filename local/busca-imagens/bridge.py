from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import ntpath
import os
import re
import shutil
import sqlite3
import subprocess
import threading
import time
import unicodedata
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen

from clipboard_win import html_to_rtf, sanitize_clipboard_html, write_windows_clipboard

VERSION = "0.3.0"
HOST = "127.0.0.1"  # Nunca exponha o auxiliar na interface de rede.
DEFAULT_PORT = 8765
MAX_BODY_BYTES = 16_384
MAX_CLIPBOARD_BODY_BYTES = 4 * 1024 * 1024
MAX_CLIPBOARD_TEXT_CHARS = 100_000
MAX_PER_DATABASE = 500
CACHE_TTL_SECONDS = 900
CACHE_MAX_ENTRIES = 2_000
RESULTS: dict[str, dict[str, Any]] = {}
RESULTS_LOCK = threading.Lock()
ANONYMIZE_LOCK = threading.Lock()


class ConfigError(Exception):
    pass


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def load_config(path: str) -> dict[str, Any]:
    try:
        config = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ConfigError(f"Não foi possível ler a configuração local: {exc}") from exc

    if not isinstance(config, dict):
        raise ConfigError("A configuração deve ser um objeto JSON.")
    if config.get("listen_host", HOST) != HOST:
        raise ConfigError("Por segurança, o auxiliar só pode escutar em 127.0.0.1.")
    origins = config.get("allowed_origins")
    if not isinstance(origins, list) or not origins or "*" in origins:
        raise ConfigError("Configure allowed_origins com a origem HTTPS exata do portal; curingas não são aceitos.")
    if any(
        not isinstance(origin, str)
        or urlsplit(origin).scheme != "https"
        or not urlsplit(origin).netloc
        or urlsplit(origin).path
        or urlsplit(origin).query
        or urlsplit(origin).fragment
        or urlsplit(origin).username
        for origin in origins
    ):
        raise ConfigError("Cada origem permitida deve ser uma URL HTTPS exata, sem caminho.")
    supabase_url = str(config.get("supabase_url", "")).rstrip("/")
    publishable_key = str(config.get("supabase_publishable_key", ""))
    supabase_parts = urlsplit(supabase_url)
    if (
        supabase_parts.scheme != "https"
        or not supabase_parts.hostname
        or not supabase_parts.hostname.endswith(".supabase.co")
        or supabase_parts.path
        or supabase_parts.query
        or supabase_parts.fragment
        or supabase_parts.username
        or not publishable_key
        or "COLE_" in publishable_key
    ):
        raise ConfigError("Configure supabase_url e supabase_publishable_key. Nunca use uma chave service_role.")
    databases = config.get("databases")
    if not isinstance(databases, list) or len(databases) != 2:
        raise ConfigError("Configure exatamente os dois índices SQLite, um de cada servidor.")
    for db in databases:
        if not isinstance(db, dict) or not db.get("id") or not db.get("label") or not db.get("database_path"):
            raise ConfigError("Cada item de databases precisa de id, label e database_path.")
        if not isinstance(db.get("path_mappings"), list) or not db["path_mappings"]:
            raise ConfigError(f"Configure ao menos um path_mappings para {db.get('label', 'servidor')}.")
        for mapping in db["path_mappings"]:
            prefix = mapping.get("source_prefix", "")
            root = mapping.get("unc_root", "")
            if not prefix or not root.startswith("\\\\"):
                raise ConfigError("Cada mapeamento deve ter source_prefix e unc_root no formato UNC (\\\\host\\share).")
    config["supabase_url"] = supabase_url
    config["port"] = int(config.get("port", DEFAULT_PORT))
    config["destination"] = str(config.get("destination", r"C:\imagens"))
    config["microdicom_exe"] = str(config.get("microdicom_exe", "")).strip()
    config["max_results"] = min(max(int(config.get("max_results", 1000)), 1), 1000)
    return config


def _supabase_request(config: dict[str, Any], path: str, token: str, method: str = "GET", body: dict[str, Any] | None = None) -> Any:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = Request(
        config["supabase_url"] + path,
        data=data,
        method=method,
        headers={
            "apikey": config["supabase_publishable_key"],
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            **({"Content-Type": "application/json"} if data is not None else {}),
        },
    )
    try:
        with urlopen(request, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        raise ApiError(401, "Não foi possível validar sua sessão do portal.") from exc


def authorize(config: dict[str, Any], token: str, module: str = "buscar_imagens") -> str:
    if not token or len(token) > 8_192:
        raise ApiError(401, "Sessão inválida. Entre novamente no portal.")
    user = _supabase_request(config, "/auth/v1/user", token)
    user_id = user.get("id") if isinstance(user, dict) else None
    if not isinstance(user_id, str) or not user_id:
        raise ApiError(401, "Sessão inválida. Entre novamente no portal.")
    permitted = _supabase_request(
        config,
        "/rest/v1/rpc/tem_modulo",
        token,
        method="POST",
        body={"_user_id": user_id, "_modulo": module},
    )
    if permitted is not True:
        label = {"buscar_imagens": "Buscar imagens", "laudos": "Laudos"}.get(module, module)
        raise ApiError(403, f"Seu usuário não tem a permissão {label}.")
    return user_id


def normalize_date(value: str) -> str | None:
    value = value.strip()
    if not value:
        return None
    for pattern, fmt in ((r"^(\d{4})-(\d{2})-(\d{2})$", "%Y-%m-%d"), (r"^(\d{2})/(\d{2})/(\d{4})$", "%d/%m/%Y")):
        if re.fullmatch(pattern, value):
            try:
                parsed = dt.datetime.strptime(value, fmt)
                return parsed.strftime("%Y%m%d")
            except ValueError as exc:
                raise ApiError(400, "Data inválida; use DD/MM/AAAA.") from exc
    if re.fullmatch(r"\d{2}/\d{4}", value):
        month, year = value.split("/")
        if 1 <= int(month) <= 12:
            return year + month
        raise ApiError(400, "Mês inválido.")
    if re.fullmatch(r"\d{4}", value) and int(value) >= 1900:
        return value
    if re.fullmatch(r"\d{8}", value):
        try:
            return dt.datetime.strptime(value, "%d%m%Y").strftime("%Y%m%d")
        except ValueError as exc:
            raise ApiError(400, "Data inválida; use DD/MM/AAAA.") from exc
    if re.fullmatch(r"\d{6}", value):
        try:
            return dt.datetime.strptime(value, "%d%m%y").strftime("%Y%m%d")
        except ValueError as exc:
            raise ApiError(400, "Data inválida; use DD/MM/AA.") from exc
    raise ApiError(400, "Data inválida; use DD/MM/AAAA, MM/AAAA ou AAAA.")


def map_source_path(source_path: str, mappings: list[dict[str, str]]) -> str | None:
    source = ntpath.normpath(source_path)
    ordered = sorted(mappings, key=lambda item: len(item.get("source_prefix", "")), reverse=True)
    for mapping in ordered:
        prefix = ntpath.normpath(mapping["source_prefix"])
        source_normalized = ntpath.normcase(source)
        prefix_normalized = ntpath.normcase(prefix).rstrip("\\")
        if source_normalized != prefix_normalized and not source_normalized.startswith(prefix_normalized + "\\"):
            continue
        suffix = ntpath.relpath(source, prefix)
        if suffix == ".":
            suffix = ""
        unc_root = ntpath.normpath(mapping["unc_root"])
        candidate = ntpath.normpath(ntpath.join(unc_root, suffix))
        candidate_normalized = ntpath.normcase(candidate)
        root_normalized = ntpath.normcase(unc_root).rstrip("\\")
        if candidate_normalized != root_normalized and not candidate_normalized.startswith(root_normalized + "\\"):
            return None
        return candidate
    return None


def _sqlite_uri(path: str) -> str:
    """Build a read-only SQLite URI for drive paths or UNC paths on Windows."""
    if path.startswith("\\\\"):
        # SQLite treats file://server/share as a URI with an unsupported
        # authority on Windows. An empty authority (four leading slashes)
        # keeps the UNC server in the path, which the Windows VFS accepts.
        unc_path = path[2:].replace("\\", "/")
        return f"file:////{quote(unc_path, safe='/')}?mode=ro"

    path_object = Path(path)
    if not path_object.is_absolute():
        path_object = path_object.resolve()
    return f"{path_object.as_uri()}?mode=ro"


def _columns(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("PRAGMA table_info(exames)").fetchall()
    return {str(row[1]) for row in rows}


def _search_fold(value: Any) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    without_marks = "".join(character for character in normalized if not unicodedata.combining(character))
    return without_marks.casefold()


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_database(db_config: dict[str, Any], query: dict[str, str], owner_id: str = "") -> list[dict[str, Any]]:
    db_path = str(db_config["database_path"])
    conn = sqlite3.connect(_sqlite_uri(db_path), uri=True, timeout=8)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA query_only=ON")
        conn.create_function("search_fold", 1, _search_fold)
        columns = _columns(conn)
        required = {"paciente", "data_exame", "modalidade", "caminho"}
        if not required.issubset(columns):
            raise ValueError("schema")

        select_parts = ["paciente", "data_exame", "modalidade", "caminho"]
        select_parts.append("prontuario" if "prontuario" in columns else "NULL AS prontuario")
        if "quantidade_imagens" in columns:
            select_parts.append("quantidade_imagens")
        elif "imagens" in columns:
            select_parts.append("imagens AS quantidade_imagens")
        else:
            select_parts.append("NULL AS quantidade_imagens")

        clauses = ["1=1"]
        params: list[Any] = []
        if query.get("paciente"):
            clauses.append("search_fold(COALESCE(paciente, '')) LIKE ? ESCAPE '\\'")
            params.append("%" + _escape_like(_search_fold(query["paciente"])) + "%")
        if query.get("prontuario"):
            if "prontuario" in columns:
                clauses.append("COALESCE(prontuario, '') LIKE ? ESCAPE '\\'")
                params.append("%" + _escape_like(query["prontuario"]) + "%")
            else:
                clauses.append("1=0")
        if query.get("data"):
            clauses.append("COALESCE(data_exame, '') LIKE ?")
            params.append(query["data"] + "%")
        if query.get("modalidade") and query["modalidade"] != "Todas":
            clauses.append("UPPER(COALESCE(modalidade, '')) = ?")
            params.append(query["modalidade"].upper())

        sql = (
            "SELECT " + ", ".join(select_parts) + " FROM exames WHERE "
            + " AND ".join(clauses)
            + " ORDER BY data_exame DESC LIMIT ?"
        )
        params.append(MAX_PER_DATABASE)
        rows = conn.execute(sql, params).fetchall()
    finally:
        conn.close()

    results: list[dict[str, Any]] = []
    mappings = db_config["path_mappings"]
    for row in rows:
        original_path = str(row["caminho"] or "")
        unc_path = map_source_path(original_path, mappings) if original_path else None
        result_id = uuid.uuid4().hex
        results.append(
            {
                "id": result_id,
                "patient": str(row["paciente"] or ""),
                "patient_id": str(row["prontuario"] or ""),
                "date": str(row["data_exame"] or ""),
                "modality": str(row["modalidade"] or ""),
                "image_count": row["quantidade_imagens"],
                "source": str(db_config["label"]),
                "path": unc_path,
                "openable": bool(unc_path),
            }
        )
        _store_result(result_id, unc_path, owner_id)
    return results


def _store_result(result_id: str, path: str | None, owner_id: str) -> None:
    if not path:
        return
    now = time.time()
    with RESULTS_LOCK:
        expired = [key for key, item in RESULTS.items() if now - item["created"] > CACHE_TTL_SECONDS]
        for key in expired:
            RESULTS.pop(key, None)
        if len(RESULTS) >= CACHE_MAX_ENTRIES:
            oldest = sorted(RESULTS.items(), key=lambda item: item[1]["created"])
            for key, _ in oldest[: len(RESULTS) - CACHE_MAX_ENTRIES + 1]:
                RESULTS.pop(key, None)
        RESULTS[result_id] = {"path": path, "created": now, "owner_id": owner_id}


def _result_for_owner(result_id: str, owner_id: str) -> dict[str, Any]:
    with RESULTS_LOCK:
        entry = RESULTS.get(result_id)
    if not entry or entry.get("owner_id") != owner_id or time.time() - entry["created"] > CACHE_TTL_SECONDS:
        raise ApiError(404, "O resultado expirou. Faça a busca novamente.")
    return entry


def search_all(config: dict[str, Any], payload: dict[str, Any], owner_id: str) -> dict[str, Any]:
    patient = str(payload.get("paciente", "")).strip()[:120]
    patient_id = str(payload.get("prontuario", "")).strip()[:80]
    date = normalize_date(str(payload.get("data", "")))
    modality = str(payload.get("modalidade", "US")).strip().upper()
    if modality not in {"US", "MG", "MN", "OT", "CT", "RX", "MRI", "TODAS"}:
        raise ApiError(400, "Modalidade inválida.")
    if not patient and not patient_id and not date:
        raise ApiError(400, "Informe paciente, prontuário ou data antes de pesquisar.")
    query = {"paciente": patient, "prontuario": patient_id, "data": date or "", "modalidade": "Todas" if modality == "TODAS" else modality}

    all_results: list[dict[str, Any]] = []
    warnings: list[str] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(search_database, db, query, owner_id): db for db in config["databases"]}
        for future in concurrent.futures.as_completed(futures):
            db = futures[future]
            try:
                all_results.extend(future.result())
            except (sqlite3.Error, OSError, ValueError, KeyError):
                warnings.append(f"Não foi possível consultar {db['label']}. Verifique a rede, as permissões e o caminho do índice.")

    if not all_results and len(warnings) == len(config["databases"]):
        raise ApiError(503, "Nenhum dos dois índices está acessível. Verifique os compartilhamentos e a configuração local.")
    all_results.sort(key=lambda item: item["date"], reverse=True)
    limit = config["max_results"]
    return {"results": all_results[:limit], "warnings": warnings, "total": min(len(all_results), limit)}


def _microdicom_executable(config: dict[str, Any]) -> str:
    if os.name != "nt":
        raise ApiError(501, "A anonimização e conversão são executadas somente pelo auxiliar Windows.")

    candidates: list[str] = []
    configured = str(config.get("microdicom_exe", "")).strip().strip('"')
    if configured:
        candidates.append(os.path.expandvars(configured))

    for program_files in (os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)"), os.environ.get("PROGRAMW6432")):
        if program_files:
            candidates.extend(
                os.path.join(program_files, relative)
                for relative in (
                    r"MicroDicom\MicroDicom\mDicom.exe",
                    r"MicroDicom\mDicom.exe",
                )
            )

    try:
        import winreg

        for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
            try:
                with winreg.OpenKey(
                    hive, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\mDicom.exe"
                ) as key:
                    registered, _ = winreg.QueryValueEx(key, None)
                    if registered:
                        candidates.append(str(registered).strip('"'))
            except OSError:
                continue
    except ImportError:
        pass

    located = shutil.which("mDicom.exe")
    if located:
        candidates.append(located)
    for candidate in candidates:
        expanded = os.path.expandvars(os.path.expanduser(candidate))
        if os.path.isfile(expanded):
            return expanded
    raise ApiError(
        503,
        "MicroDicom não foi localizado. Configure microdicom_exe no config.json do auxiliar e reinicie-o.",
    )


def _desktop_directory() -> str:
    if os.name == "nt":
        try:
            import winreg

            with winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
            ) as key:
                value, _ = winreg.QueryValueEx(key, "Desktop")
            return os.path.expandvars(str(value))
        except (ImportError, OSError):
            pass
    return str(Path.home() / "Desktop")


def _run_microdicom(executable: str, arguments: list[str]) -> None:
    try:
        result = subprocess.run(
            [executable, *arguments],
            check=False,
            timeout=3600,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.TimeoutExpired as exc:
        raise ApiError(504, "O MicroDicom excedeu o tempo limite de processamento.") from exc
    except OSError as exc:
        raise ApiError(503, "Não foi possível iniciar o MicroDicom neste computador.") from exc
    if result.returncode != 0:
        raise ApiError(500, "O MicroDicom informou falha no processamento. Confira a janela do programa.")


def anonymize_and_export(config: dict[str, Any], source: str) -> dict[str, Any]:
    if os.name != "nt":
        raise ApiError(501, "A anonimização e conversão são executadas somente pelo auxiliar Windows.")
    if not source or not os.path.isdir(source):
        raise ApiError(404, "A pasta deste exame não está acessível. Verifique a rede e as permissões.")
    try:
        if not any(path.is_file() for path in Path(source).rglob("*")):
            raise ApiError(404, "A pasta deste exame não contém arquivos.")
    except OSError as exc:
        raise ApiError(404, "Não foi possível ler a pasta deste exame.") from exc

    executable = _microdicom_executable(config)
    output_root = os.path.join(_desktop_directory(), "IMAGENS PACS")
    os.makedirs(output_root, exist_ok=True)
    source_normalized = ntpath.normcase(ntpath.normpath(source))
    output_normalized = ntpath.normcase(ntpath.normpath(output_root))
    try:
        if ntpath.commonpath([source_normalized, output_normalized]) == source_normalized:
            raise ApiError(400, "A pasta de saída não pode ficar dentro da pasta original do exame.")
    except ValueError:
        pass

    run_name = f"Lote_{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    run_root = os.path.join(output_root, run_name)
    anonymized_dir = os.path.join(run_root, "DICOM_ANONIMIZADOS")
    jpeg_dir = os.path.join(run_root, "JPG_EMAIL")
    os.makedirs(anonymized_dir)
    os.makedirs(jpeg_dir)

    _run_microdicom(
        executable,
        [
            "-anonymize",
            "-in",
            source,
            "-out",
            anonymized_dir,
            "-template",
            "Default",
            "-fileNameText",
            "_anon",
            "-fileNameTextPosition",
            "end",
            "-showUI",
        ],
    )
    anonymized_files = [path for path in Path(anonymized_dir).rglob("*") if path.is_file()]
    if not anonymized_files:
        raise ApiError(422, "O MicroDicom não criou cópias anonimizadas. Confira a pasta selecionada e o template Default.")

    _run_microdicom(
        executable,
        [
            "-scanAndConvert",
            "-format",
            "jpeg",
            "-overlay",
            "anonymous",
            "-in",
            anonymized_dir,
            "-out",
            jpeg_dir,
            "-showUI",
        ],
    )
    jpeg_files = sorted(
        (path for path in Path(jpeg_dir).rglob("*") if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg"}),
        key=lambda path: str(path).casefold(),
    )
    if not jpeg_files:
        raise ApiError(422, "O MicroDicom não criou JPGs a partir das cópias anonimizadas.")

    temporary_images: list[Path] = []
    for image_path in jpeg_files:
        temporary_path = image_path.with_name(f".ceu-export-{uuid.uuid4().hex}.tmp")
        os.replace(str(image_path), str(temporary_path))
        temporary_images.append(temporary_path)
    for index, image_path in enumerate(temporary_images, start=1):
        target = os.path.join(jpeg_dir, f"imagem_{index:04d}.jpg")
        os.replace(str(image_path), target)

    opened = False
    try:
        os.startfile(jpeg_dir)  # type: ignore[attr-defined]
        opened = True
    except OSError:
        pass
    return {
        "anonymized_count": len(anonymized_files),
        "jpg_count": len(jpeg_files),
        "opened": opened,
        "folder": run_name,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "CEU-LocalHelper/" + VERSION
    config: dict[str, Any]

    def log_message(self, format: str, *args: Any) -> None:
        # Nunca registrar URL de busca, filtros, nomes ou prontuários.
        return

    def _origin(self) -> str | None:
        return self.headers.get("Origin")

    def _origin_is_allowed(self) -> bool:
        origin = self._origin()
        return bool(origin and origin in self.config["allowed_origins"])

    def _cors_headers(self) -> dict[str, str]:
        origin = self._origin()
        if not origin or origin not in self.config["allowed_origins"]:
            return {}
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Allow-Private-Network": "true",
            "Access-Control-Max-Age": "300",
            "Vary": "Origin",
        }

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(encoded)))
        for key, value in self._cors_headers().items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(encoded)

    def _read_json(self, max_bytes: int = MAX_BODY_BYTES) -> dict[str, Any]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ApiError(400, "Requisição inválida.") from exc
        if length < 1 or length > max_bytes:
            raise ApiError(413, "Requisição inválida ou muito grande.")
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ApiError(400, "JSON inválido.") from exc
        if not isinstance(body, dict):
            raise ApiError(400, "Requisição inválida.")
        return body

    def _authorized_user(self, module: str = "buscar_imagens") -> str:
        header = self.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise ApiError(401, "Entre novamente no portal para validar sua sessão.")
        return authorize(self.config, header[7:].strip(), module)

    def do_OPTIONS(self) -> None:
        if not self._origin_is_allowed():
            self._send_json(403, {"error": "Origem não autorizada."})
            return
        self.send_response(204)
        for key, value in self._cors_headers().items():
            self.send_header(key, value)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        if not self._origin_is_allowed():
            self._send_json(403, {"error": "Origem não autorizada."})
            return
        if self.path != "/health":
            self._send_json(404, {"error": "Rota não encontrada."})
            return
        self._send_json(200, {"status": "ok", "version": VERSION})

    def do_POST(self) -> None:
        if not self._origin_is_allowed():
            self._send_json(403, {"error": "Origem não autorizada."})
            return
        try:
            copiar_para_clinux = self.path == "/api/clinux-clipboard"
            user_id = self._authorized_user("laudos" if copiar_para_clinux else "buscar_imagens")
            payload = self._read_json(MAX_CLIPBOARD_BODY_BYTES if copiar_para_clinux else MAX_BODY_BYTES)
            if copiar_para_clinux:
                html_content = payload.get("html")
                plain_text = payload.get("text")
                if not isinstance(html_content, str) or not isinstance(plain_text, str):
                    raise ApiError(400, "O conteúdo do laudo está incompleto.")
                if len(html_content.encode("utf-8")) > MAX_CLIPBOARD_BODY_BYTES or len(plain_text) > MAX_CLIPBOARD_TEXT_CHARS:
                    raise ApiError(413, "O conteúdo do laudo é grande demais para copiar.")
                safe_html = sanitize_clipboard_html(html_content)
                if not safe_html.strip() or not plain_text.strip():
                    raise ApiError(400, "O laudo está vazio.")
                if os.name != "nt":
                    raise ApiError(501, "A cópia nativa para Clinux está disponível somente no auxiliar Windows.")
                rtf_text = html_to_rtf(
                    safe_html,
                    str(payload.get("fontFamily", "Garamond")),
                    str(payload.get("fontSize", "12pt")),
                    str(payload.get("letterSpacing", "normal")),
                )
                try:
                    write_windows_clipboard(safe_html, plain_text, rtf_text)
                except OSError as exc:
                    raise ApiError(503, str(exc)) from exc
                self._send_json(200, {"copied": True})
                return
            if self.path == "/api/search":
                self._send_json(200, search_all(self.config, payload, user_id))
                return
            if self.path == "/api/anonymize-export":
                result_id = str(payload.get("result_id", ""))
                entry = _result_for_owner(result_id, user_id)
                if not entry.get("path"):
                    raise ApiError(404, "O compartilhamento desse exame não está configurado.")
                if not ANONYMIZE_LOCK.acquire(blocking=False):
                    raise ApiError(409, "Já existe um processamento em andamento neste computador.")
                try:
                    result = anonymize_and_export(self.config, entry["path"])
                finally:
                    ANONYMIZE_LOCK.release()
                self._send_json(200, result)
                return
            if self.path == "/api/open-folder":
                result_id = str(payload.get("result_id", ""))
                entry = _result_for_owner(result_id, user_id)
                path = entry.get("path")
                if not path:
                    raise ApiError(404, "O compartilhamento desse exame não está configurado.")
                if not os.path.isdir(path):
                    raise ApiError(404, "A pasta não está acessível. Verifique a conexão e as permissões do compartilhamento.")
                if os.name != "nt":
                    raise ApiError(501, "Abrir o Explorador é suportado somente pelo auxiliar Windows.")
                os.startfile(path)  # type: ignore[attr-defined]
                self._send_json(200, {"opened": True})
                return
            raise ApiError(404, "Rota não encontrada.")
        except ApiError as exc:
            self._send_json(exc.status, {"error": exc.message})
        except Exception:
            # Erros inesperados não incluem parâmetros nem detalhes do banco na resposta.
            self._send_json(500, {"error": "O auxiliar local encontrou um erro inesperado."})


def main() -> int:
    parser = argparse.ArgumentParser(description="Auxiliar local CEU para pesquisa read-only de exames DICOM.")
    parser.add_argument("--config", default=str(Path(__file__).with_name("config.json")))
    args = parser.parse_args()
    try:
        config = load_config(args.config)
    except ConfigError as exc:
        print(f"Configuração pendente: {exc}")
        print("Copie config.example.json para config.json e preencha as instruções do README.")
        return 2

    Handler.config = config
    try:
        server = ThreadingHTTPServer((HOST, config["port"]), Handler)
    except OSError as exc:
        print(f"Não foi possível iniciar o auxiliar local na porta {config['port']}: {exc}")
        return 1
    server.daemon_threads = True
    print(f"Auxiliar local ativo em http://127.0.0.1:{config['port']} (somente neste computador).")
    print("Mantenha esta janela aberta enquanto usa Buscar imagens. Nenhum filtro ou resultado é registrado em log.")
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        print("Encerrando auxiliar local.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
