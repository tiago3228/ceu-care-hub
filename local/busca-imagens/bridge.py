from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import ntpath
import os
import re
import sqlite3
import threading
import time
import unicodedata
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

VERSION = "0.1.0"
HOST = "127.0.0.1"  # Nunca exponha o auxiliar na interface de rede.
DEFAULT_PORT = 8765
MAX_BODY_BYTES = 16_384
MAX_PER_DATABASE = 500
CACHE_TTL_SECONDS = 900
CACHE_MAX_ENTRIES = 2_000
RESULTS: dict[str, dict[str, Any]] = {}
RESULTS_LOCK = threading.Lock()


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


def authorize(config: dict[str, Any], token: str) -> str:
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
        body={"_user_id": user_id, "_modulo": "buscar_imagens"},
    )
    if permitted is not True:
        raise ApiError(403, "Seu usuário não tem a permissão Buscar imagens.")
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

    def _read_json(self) -> dict[str, Any]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ApiError(400, "Requisição inválida.") from exc
        if length < 1 or length > MAX_BODY_BYTES:
            raise ApiError(413, "Requisição inválida ou muito grande.")
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ApiError(400, "JSON inválido.") from exc
        if not isinstance(body, dict):
            raise ApiError(400, "Requisição inválida.")
        return body

    def _authorized_user(self) -> str:
        header = self.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise ApiError(401, "Entre novamente no portal para validar sua sessão.")
        return authorize(self.config, header[7:].strip())

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
            user_id = self._authorized_user()
            payload = self._read_json()
            if self.path == "/api/search":
                self._send_json(200, search_all(self.config, payload, user_id))
                return
            if self.path == "/api/open-folder":
                result_id = str(payload.get("result_id", ""))
                with RESULTS_LOCK:
                    entry = RESULTS.get(result_id)
                if not entry or entry.get("owner_id") != user_id or time.time() - entry["created"] > CACHE_TTL_SECONDS:
                    raise ApiError(404, "O resultado expirou. Faça a busca novamente.")
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
