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

export interface CelulaGradeEscala {
  colaboradoras: string;
  medico: string;
  inicio: string;
  fim: string;
  observacoes: string;
  fechada: boolean;
}

export interface GradeExportacaoEscala {
  titulo: string;
  dias: string[];
  linhas: { sala: string; celulas: CelulaGradeEscala[] }[];
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

const COR_FUNDO = "#1c1c1c";
const COR_BORDA = "#8a8a8a";
const COR_TEXTO = "#f3f4f6";
const COR_COLAB = "#4ade80";
const COR_MEDICO = "#f87171";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  estilo: Partial<CSSStyleDeclaration>,
  texto?: string,
) {
  const e = document.createElement(tag);
  Object.assign(e.style, estilo);
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function linhaCelula(container: HTMLElement, texto: string, cor: string, negrito = false) {
  if (!texto) return;
  const div = el("div", {
    color: cor,
    fontWeight: negrito ? "700" : "400",
    whiteSpace: "pre-line",
  }, texto);
  container.appendChild(div);
}

/** Monta a grade da semana como tabela (estilo da escala impressa) e exporta em JPEG. */
export async function exportarEscalaJpeg(grade: GradeExportacaoEscala, inicioSemana: string) {
  const raiz = el("div", {
    position: "fixed",
    left: "-10000px",
    top: "0",
    backgroundColor: COR_FUNDO,
    padding: "24px",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "14px",
    color: COR_TEXTO,
    width: "max-content",
  });

  raiz.appendChild(
    el("div", {
      textAlign: "center",
      fontWeight: "700",
      fontSize: "18px",
      padding: "10px 8px",
      border: `1px solid ${COR_BORDA}`,
      borderBottom: "none",
      backgroundColor: "#262626",
    }, grade.titulo),
  );

  const tabela = el("table", {
    borderCollapse: "collapse",
    border: `1px solid ${COR_BORDA}`,
  });

  const thead = el("thead", {});
  const trHead = el("tr", {});
  trHead.appendChild(
    el("th", {
      border: `1px solid ${COR_BORDA}`,
      padding: "8px 10px",
      minWidth: "52px",
      textAlign: "left",
      fontWeight: "700",
      backgroundColor: "#262626",
    }, "SL"),
  );
  for (const dia of grade.dias) {
    trHead.appendChild(
      el("th", {
        border: `1px solid ${COR_BORDA}`,
        padding: "8px 10px",
        minWidth: "180px",
        textAlign: "center",
        fontWeight: "700",
        backgroundColor: "#262626",
      }, dia),
    );
  }
  thead.appendChild(trHead);
  tabela.appendChild(thead);

  const tbody = el("tbody", {});
  for (const linha of grade.linhas) {
    const tr = el("tr", {});
    tr.appendChild(
      el("td", {
        border: `1px solid ${COR_BORDA}`,
        padding: "8px 10px",
        fontWeight: "700",
        verticalAlign: "top",
        whiteSpace: "nowrap",
      }, linha.sala),
    );
    for (const celula of linha.celulas) {
      const td = el("td", {
        border: `1px solid ${COR_BORDA}`,
        padding: "8px 10px",
        textAlign: "center",
        verticalAlign: "top",
      });
      if (celula.fechada) {
        linhaCelula(td, "FECHADA", COR_MEDICO, true);
      }
      linhaCelula(td, celula.colaboradoras, COR_COLAB, true);
      const horario =
        celula.inicio && celula.fim
          ? `${celula.inicio} às ${celula.fim}`
          : celula.inicio || celula.fim || "";
      const medicoLinha = [celula.medico, horario].filter(Boolean).join(" ");
      linhaCelula(td, medicoLinha, celula.medico ? COR_MEDICO : COR_TEXTO);
      linhaCelula(td, celula.observacoes, COR_TEXTO);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tabela.appendChild(tbody);
  raiz.appendChild(tabela);

  document.body.appendChild(raiz);
  try {
    const url = await toJpeg(raiz, {
      quality: 0.95,
      pixelRatio: 2,
      backgroundColor: COR_FUNDO,
      skipFonts: true,
    });
    baixar(url, `escala-semana-${inicioSemana}.jpg`);
  } finally {
    raiz.remove();
  }
}
