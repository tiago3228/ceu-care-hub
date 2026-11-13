import { toJpeg } from "html-to-image";
import { jsPDF } from "jspdf";
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

/** Exporta a grade semanal como uma tabela impressa, no padrão do modelo de enfermagem. */
export function exportarEscalaPdf(grade: GradeExportacaoEscala, inicioSemana: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margem = 8;
  const largura = 297 - margem * 2;
  const larguraRotulo = 40;
  const larguraDia = (largura - larguraRotulo) / grade.dias.length;
  const alturaCabecalho = 8;
  const alturaUtil = 210 - margem;
  const espacamentoLinha = 3.8;
  const tamanhoFonte = 9;

  const textoCelula = (celula: CelulaGradeEscala) =>
    [celula.colaboradoras, celula.medico, celula.inicio, celula.fim, celula.observacoes]
      .filter(Boolean)
      .join("\n");

  const quebrar = (texto: string, larguraTexto: number) => {
    const linhas: string[] = [];
    for (const linha of texto.split("\n")) {
      if (linha === "────────────") {
        linhas.push(linha);
      } else {
        linhas.push(...(doc.splitTextToSize(linha, larguraTexto) as string[]));
      }
    }
    return linhas.length ? linhas : [""];
  };

  const desenharCabecalho = () => {
    doc.setTextColor(15, 15, 15);
    doc.setFont("times", "bold");
    doc.setFontSize(15);
    doc.text(grade.titulo, 297 / 2, margem + 1, { align: "center" });
    const y = margem + 6;
    doc.setFontSize(9);
    doc.setLineWidth(0.25);
    doc.rect(margem, y, larguraRotulo, alturaCabecalho);
    doc.text("Sala", margem + larguraRotulo / 2, y + 5.2, { align: "center" });
    grade.dias.forEach((dia, index) => {
      const x = margem + larguraRotulo + index * larguraDia;
      doc.rect(x, y, larguraDia, alturaCabecalho);
      doc.text(dia, x + larguraDia / 2, y + 5.2, { align: "center" });
    });
    return y + alturaCabecalho;
  };

  let y = desenharCabecalho();
  grade.linhas.forEach((linha) => {
    const rotuloLinhas = quebrar(linha.sala, larguraRotulo - 4);
    const celulasLinhas = linha.celulas.map((celula) =>
      quebrar(textoCelula(celula), larguraDia - 4),
    );
    const quantidadeLinhas = Math.max(
      rotuloLinhas.length,
      ...celulasLinhas.map((linhas) => linhas.length),
    );
    const alturaLinha = Math.max(12, quantidadeLinhas * espacamentoLinha + 4);
    if (y + alturaLinha > alturaUtil) {
      doc.addPage();
      y = desenharCabecalho();
    }

    doc.setFont("times", "bold");
    doc.setFontSize(tamanhoFonte);
    doc.rect(margem, y, larguraRotulo, alturaLinha);
    const topoRotulo = y + (alturaLinha - rotuloLinhas.length * espacamentoLinha) / 2 + 2.8;
    doc.text(rotuloLinhas, margem + larguraRotulo / 2, topoRotulo, { align: "center" });

    linha.celulas.forEach((celula, index) => {
      const x = margem + larguraRotulo + index * larguraDia;
      doc.setFont("times", "normal");
      doc.rect(x, y, larguraDia, alturaLinha);
      const linhas = celulasLinhas[index] ?? [""];
      const topo = y + (alturaLinha - linhas.length * espacamentoLinha) / 2 + 2.8;
      linhas.forEach((linhaTexto, indice) => {
        const linhaY = topo + indice * espacamentoLinha;
        if (linhaTexto === "────────────") {
          doc.line(x + 3, linhaY - 1, x + larguraDia - 3, linhaY - 1);
        } else {
          doc.text(linhaTexto, x + larguraDia / 2, linhaY, { align: "center" });
        }
      });
    });
    y += alturaLinha;
  });
  doc.save(`escala-enfermagem-${inicioSemana}.pdf`);
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

const COR_FUNDO = "#ffffff";
const COR_BORDA = "#111111";
const COR_TEXTO = "#111111";
const COR_COLAB = "#111111";
const COR_MEDICO = "#111111";

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
  texto.split("\n").forEach((linha) => {
    if (linha === "────────────") {
      container.appendChild(el("div", { borderTop: `1px solid ${COR_BORDA}`, margin: "3px 0" }));
      return;
    }
    container.appendChild(
      el("div", { color: cor, fontWeight: negrito ? "700" : "400", whiteSpace: "pre-line" }, linha),
    );
  });
}

/** Monta a grade da semana como tabela (estilo da escala impressa) e exporta em JPEG. */
export async function exportarEscalaJpeg(grade: GradeExportacaoEscala, inicioSemana: string) {
  const raiz = el("div", {
    position: "fixed",
    left: "0",
    top: "0",
    zIndex: "-1",
    pointerEvents: "none",
    backgroundColor: COR_FUNDO,
    padding: "8px",
    boxSizing: "border-box",
    fontFamily: '"Times New Roman", Georgia, serif',
    fontSize: "12px",
    lineHeight: "1.2",
    color: COR_TEXTO,
    width: "1060px",
  });

  raiz.appendChild(
    el(
      "div",
      {
        textAlign: "center",
        fontWeight: "700",
        fontSize: "16px",
        padding: "4px 6px",
        border: `1px solid ${COR_BORDA}`,
        borderBottom: "none",
        backgroundColor: COR_FUNDO,
      },
      grade.titulo,
    ),
  );

  const tabela = el("table", {
    borderCollapse: "collapse",
    border: `1px solid ${COR_BORDA}`,
    width: "100%",
    tableLayout: "fixed",
  });

  const thead = el("thead", {});
  const trHead = el("tr", {});
  trHead.appendChild(
    el(
      "th",
      {
        border: `1px solid ${COR_BORDA}`,
        padding: "4px 5px",
        width: "14%",
        textAlign: "center",
        fontWeight: "700",
        backgroundColor: COR_FUNDO,
      },
      "Sala",
    ),
  );
  for (const dia of grade.dias) {
    trHead.appendChild(
      el(
        "th",
        {
          border: `1px solid ${COR_BORDA}`,
          padding: "4px 5px",
          width: `${86 / grade.dias.length}%`,
          textAlign: "center",
          fontWeight: "700",
          backgroundColor: COR_FUNDO,
        },
        dia,
      ),
    );
  }
  thead.appendChild(trHead);
  tabela.appendChild(thead);

  const tbody = el("tbody", {});
  for (const linha of grade.linhas) {
    const tr = el("tr", {});
    tr.appendChild(
      el(
        "td",
        {
          border: `1px solid ${COR_BORDA}`,
          padding: "4px 5px",
          fontWeight: "700",
          verticalAlign: "middle",
          textAlign: "center",
          whiteSpace: "pre-line",
        },
        linha.sala,
      ),
    );
    for (const celula of linha.celulas) {
      const td = el("td", {
        border: `1px solid ${COR_BORDA}`,
        padding: "4px 5px",
        textAlign: "center",
        verticalAlign: "middle",
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
      pixelRatio: 1.5,
      backgroundColor: COR_FUNDO,
      skipFonts: true,
    });
    baixar(url, `escala-semana-${inicioSemana}.jpg`);
  } finally {
    if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
  }
}
