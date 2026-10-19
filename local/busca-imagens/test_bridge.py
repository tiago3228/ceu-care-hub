import sqlite3
import tempfile
import unittest
from pathlib import Path

import bridge


class BridgeTests(unittest.TestCase):
    def test_normaliza_datas_aceitas(self):
        self.assertEqual(bridge.normalize_date("15/06/2021"), "20210615")
        self.assertEqual(bridge.normalize_date("06/2021"), "202106")
        self.assertEqual(bridge.normalize_date("2021"), "2021")
        self.assertEqual(bridge.normalize_date(""), None)

    def test_rejeita_data_invalida(self):
        with self.assertRaises(bridge.ApiError):
            bridge.normalize_date("31/02/2021")

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
