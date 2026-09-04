import { toJpeg } from "html-to-image";
import * as XLSX from "xlsx";
import { isoParaBr } from "@/lib/datas";

export interface LinhaExportacaoEscala {
  data: string;
  diaSemana: string;
  sala: string;
  medico: string;
  colaboradoras: string;
  inicio: string;
  fim: string;
  observacoes: string;
  status: string;
}

function baixar(url: string, nome: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
}

/** Exporta a semana como planilha Excel (.xlsx), aba "Escala". */
export function exportarEscalaXlsx(linhas: LinhaExportacaoEscala[], inicioSemana: string) {
  const planilha = XLSX.utils.json_to_sheet(
    linhas.map((l) => ({
      Data: isoParaBr(l.data),
      "Dia da semana": l.diaSemana,
      Sala: l.sala,
      Médico: l.medico,
      Colaboradoras: l.colaboradoras,
      Início: l.inicio,
      Fim: l.fim,
      Observações: l.observacoes,
      Status: l.status,
    })),
  );
  planilha["!cols"] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 20 },
    { wch: 28 },
    { wch: 40 },
    { wch: 8 },
    { wch: 8 },
    { wch: 40 },
    { wch: 14 },
  ];
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, "Escala");
  XLSX.writeFile(livro, `escala-semana-${inicioSemana}.xlsx`);
}

/** Captura a grade da semana (elemento DOM) como JPEG com fundo claro. */
export async function exportarEscalaJpeg(elemento: HTMLElement, inicioSemana: string) {
  const url = await toJpeg(elemento, {
    quality: 0.95,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    filter: (node) => !(node instanceof HTMLElement && node.dataset["exportHide"] === "true"),
  });
  baixar(url, `escala-semana-${inicioSemana}.jpg`);
}
