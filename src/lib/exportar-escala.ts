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

/** Exporta a grade da escala como PDF paisagem no formato de tabela do modelo. */
export function exportarEscalaPdf(grade: GradeExportacaoEscala, inicioSemana: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margem = 8;
  const largura = 297 - margem * 2;
  const larguraRotulo = 38;
  const larguraDia = (largura - larguraRotulo) / grade.dias.length;
  const alturaLinha = 24;
  const alturaCabecalho = 8;
  const alturaMaxima = 210 - margem;

  const desenharCabecalho = (titulo: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(titulo, 297 / 2, margem, { align: "center" });
    const y = margem + 5;
    doc.setFontSize(7);
    doc.rect(margem, y, larguraRotulo, alturaCabecalho);
    doc.text("Sala", margem + larguraRotulo / 2, y + 5, { align: "center" });
    grade.dias.forEach((dia, index) => {
      const x = margem + larguraRotulo + index * larguraDia;
      doc.rect(x, y, larguraDia, alturaCabecalho);
      doc.text(dia, x + larguraDia / 2, y + 5, { align: "center" });
    });
    return y + alturaCabecalho;
  };

  let y = desenharCabecalho(grade.titulo);
  grade.linhas.forEach((linha) => {
    if (y + alturaLinha > alturaMaxima) {
      doc.addPage();
      y = desenharCabecalho(grade.titulo);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.rect(margem, y, larguraRotulo, alturaLinha);
    const rotulo = doc.splitTextToSize(linha.sala, larguraRotulo - 4) as string[];
    doc.text(rotulo, margem + larguraRotulo / 2, y + 6, { align: "center" });
    linha.celulas.forEach((celula, index) => {
      const x = margem + larguraRotulo + index * larguraDia;
      doc.setFont("helvetica", "normal");
      doc.rect(x, y, larguraDia, alturaLinha);
      let linhaY = y + 5;
      const conteudo = [
        celula.colaboradoras,
        celula.medico,
        celula.inicio,
        celula.fim,
        celula.observacoes,
      ]
        .filter(Boolean)
        .join("\n");
      for (const linhaTexto of conteudo.split("\n")) {
        if (linhaTexto === "────────────") {
          doc.line(x + 2, linhaY - 2, x + larguraDia - 2, linhaY - 2);
          linhaY += 2;
          continue;
        }
        const linhasQuebradas = doc.splitTextToSize(linhaTexto, larguraDia - 4) as string[];
        doc.text(linhasQuebradas, x + larguraDia / 2, linhaY, { align: "center" });
        linhaY += linhasQuebradas.length * 3;
      }
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
    padding: "24px",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "14px",
    color: COR_TEXTO,
    width: "max-content",
  });

  raiz.appendChild(
    el(
      "div",
      {
        textAlign: "center",
        fontWeight: "700",
        fontSize: "18px",
        padding: "10px 8px",
        border: `1px solid ${COR_BORDA}`,
        borderBottom: "none",
        backgroundColor: "#262626",
      },
      grade.titulo,
    ),
  );

  const tabela = el("table", {
    borderCollapse: "collapse",
    border: `1px solid ${COR_BORDA}`,
  });

  const thead = el("thead", {});
  const trHead = el("tr", {});
  trHead.appendChild(
    el(
      "th",
      {
        border: `1px solid ${COR_BORDA}`,
        padding: "8px 10px",
        minWidth: "52px",
        textAlign: "left",
        fontWeight: "700",
        backgroundColor: "#262626",
      },
      "SL",
    ),
  );
  for (const dia of grade.dias) {
    trHead.appendChild(
      el(
        "th",
        {
          border: `1px solid ${COR_BORDA}`,
          padding: "8px 10px",
          minWidth: "180px",
          textAlign: "center",
          fontWeight: "700",
          backgroundColor: "#262626",
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
          padding: "8px 10px",
          fontWeight: "700",
          verticalAlign: "top",
          whiteSpace: "nowrap",
        },
        linha.sala,
      ),
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
    if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
  }
}
