import sqlite3
import tempfile
import time
import types
import unittest
from pathlib import Path
from unittest.mock import patch

import bridge


class BridgeTests(unittest.TestCase):
    def test_sqlite_uri_unc_nao_usa_host_como_autoridade(self):
        uri = bridge._sqlite_uri(
            r"\\192.168.0.249\legado\APLICATIVO DE BUSCAR DICOM\dicomfinder.db"
        )
        self.assertEqual(
            uri,
            "file:////192.168.0.249/legado/APLICATIVO%20DE%20BUSCAR%20DICOM/dicomfinder.db?mode=ro",
        )

    def test_normaliza_datas_aceitas(self):
        self.assertEqual(bridge.normalize_date("15/06/2021"), "20210615")
        self.assertEqual(bridge.normalize_date("06/2021"), "202106")
        self.assertEqual(bridge.normalize_date("2021"), "2021")
        self.assertEqual(bridge.normalize_date(""), None)

    def test_rejeita_data_invalida(self):
        with self.assertRaises(bridge.ApiError):
            bridge.normalize_date("31/02/2021")

    def test_resultado_e_restrito_ao_usuario_e_expira(self):
        result_id = "resultado-teste"
        bridge.RESULTS[result_id] = {
            "path": r"\\192.168.0.249\legado\exame",
            "created": time.time(),
            "owner_id": "usuario-a",
        }
        try:
            self.assertEqual(bridge._result_for_owner(result_id, "usuario-a")["owner_id"], "usuario-a")
            with self.assertRaises(bridge.ApiError):
                bridge._result_for_owner(result_id, "usuario-b")
            bridge.RESULTS[result_id]["created"] = time.time() - bridge.CACHE_TTL_SECONDS - 1
            with self.assertRaises(bridge.ApiError):
                bridge._result_for_owner(result_id, "usuario-a")
        finally:
            bridge.RESULTS.pop(result_id, None)

    def test_anonymize_export_usa_duas_etapas_e_abre_somente_jpg(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "exame-original"
            desktop = root / "desktop"
            source.mkdir()
            desktop.mkdir()
            original = source / "arquivo-original.dcm"
            original.write_bytes(b"DICOM original de teste")
            calls = []

            def fake_run(_executable, arguments):
                calls.append(arguments)
                output = Path(arguments[arguments.index("-out") + 1])
                if arguments[0] == "-anonymize":
                    (output / "arquivo_anon.dcm").write_bytes(b"DICOM anonimizado de teste")
                else:
                    (output / "nome-com-dado.jpg").write_bytes(b"JPEG teste 1")
                    (output / "outro-nome.jpg").write_bytes(b"JPEG teste 2")

            fake_os = types.SimpleNamespace(**vars(bridge.os))
            fake_os.name = "nt"
            fake_os.startfile = lambda _path: None
            with (
                patch.object(bridge, "os", fake_os),
                patch.object(bridge, "_desktop_directory", return_value=str(desktop)),
                patch.object(bridge, "_microdicom_executable", return_value="mDicom.exe"),
                patch.object(bridge, "_run_microdicom", side_effect=fake_run),
            ):
                result = bridge.anonymize_and_export({}, str(source))

            self.assertEqual(len(calls), 2)
            self.assertEqual(calls[0][0], "-anonymize")
            self.assertIn("Default", calls[0])
            self.assertIn("_anon", calls[0])
            self.assertEqual(calls[1][0], "-scanAndConvert")
            self.assertIn("anonymous", calls[1])
            self.assertEqual(result["anonymized_count"], 1)
            self.assertEqual(result["jpg_count"], 2)
            self.assertTrue(result["opened"])
            self.assertEqual(original.read_bytes(), b"DICOM original de teste")
            opened_path = Path(desktop) / "IMAGENS PACS" / result["folder"] / "JPG_EMAIL"
            self.assertEqual(
                sorted(path.name for path in Path(opened_path).iterdir()),
                ["imagem_0001.jpg", "imagem_0002.jpg"],
            )

    def test_mapeia_apenas_pasta_configurada(self):
        mappings = [
            {
                "source_prefix": r"G:\WTT\Storage\dicom",
                "unc_root": r"\\192.168.0.174\dicom",
            }
        ]
        self.assertEqual(
            bridge.map_source_path(r"G:\WTT\Storage\dicom\2025\exame1", mappings),
            r"\\192.168.0.174\dicom\2025\exame1",
        )
        self.assertIsNone(bridge.map_source_path(r"G:\WTT\Storage\dicom-privado\x", mappings))

    def _criar_banco(self, pasta: Path, data: str, paciente: str, prontuario: str):
        db_path = pasta / "dicomfinder.db"
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                """CREATE TABLE exames (
                    paciente TEXT,
                    prontuario TEXT,
                    data_exame TEXT,
                    modalidade TEXT,
                    caminho TEXT,
                    quantidade_imagens INTEGER
                )"""
            )
            conn.execute(
                "INSERT INTO exames VALUES (?, ?, ?, ?, ?, ?)",
                (paciente, prontuario, data, "US", r"G:\WTT\Storage\dicom\2025\exame1", 3),
            )
        return str(db_path)

    def test_busca_read_only_com_parametros_e_unicode(self):
        with tempfile.TemporaryDirectory() as temp:
            db_file = self._criar_banco(Path(temp), "20250615", "Paciente SINTÉTICO", "ABC123")
            db_config = {
                "database_path": db_file,
                "label": "Servidor de teste",
                "path_mappings": [
                    {
                        "source_prefix": r"G:\WTT\Storage\dicom",
                        "unc_root": r"\\192.168.0.174\dicom",
                    }
                ],
            }
            results = bridge.search_database(
                db_config,
                {"paciente": "Sintetico", "prontuario": "", "data": "", "modalidade": "US"},
                owner_id="usuario-teste",
            )
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["patient_id"], "ABC123")
            self.assertEqual(results[0]["path"], r"\\192.168.0.174\dicom\2025\exame1")
            self.assertEqual(bridge.RESULTS[results[0]["id"]]["owner_id"], "usuario-teste")

            injected = bridge.search_database(
                db_config,
                {"paciente": "%'; DROP TABLE exames;--", "prontuario": "", "data": "", "modalidade": "US"},
                owner_id="usuario-teste",
            )
            self.assertEqual(injected, [])

            with sqlite3.connect(f"{Path(db_file).as_uri()}?mode=ro", uri=True) as conn:
                with self.assertRaises(sqlite3.OperationalError):
                    conn.execute("INSERT INTO exames VALUES ('x','x','x','US','x',0)")

    def test_indice_sem_coluna_prontuario_nao_quebra(self):
        with tempfile.TemporaryDirectory() as temp:
            db_path = Path(temp) / "dicomfinder.db"
            with sqlite3.connect(db_path) as conn:
                conn.execute(
                    "CREATE TABLE exames (paciente TEXT, data_exame TEXT, modalidade TEXT, caminho TEXT)"
                )
                conn.execute(
                    "INSERT INTO exames VALUES (?, ?, ?, ?)",
                    ("Paciente Sintético", "20250615", "US", r"G:\WTT\Storage\dicom\2025"),
                )
            result = bridge.search_database(
                {
                    "database_path": str(db_path),
                    "label": "Índice antigo",
                    "path_mappings": [
                        {"source_prefix": r"G:\WTT\Storage\dicom", "unc_root": r"\\192.168.0.174\dicom"}
                    ],
                },
                {"paciente": "", "prontuario": "ABC", "data": "", "modalidade": "US"},
                owner_id="usuario-teste",
            )
            self.assertEqual(result, [])


if __name__ == "__main__":
    unittest.main()
