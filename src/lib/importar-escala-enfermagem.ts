import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import mammoth from "mammoth";

// O PDF.js não consegue localizar o worker automaticamente quando é empacotado
// pelo Vite. Usar o asset URL gerado pelo bundler funciona em dev e produção.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type CelulaEscalaImportada = {
  sala: string;
  dias: string[];
};

export type SecaoEscalaImportada = {
  titulo: string;
  turno: string;
  cabecalho: string[];
  linhas: CelulaEscalaImportada[];
};

export type EscalaImportada = {
  titulo: string;
  inicio: string | null;
  fim: string | null;
  secoes: SecaoEscalaImportada[];
};

function limparTexto(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function extrairPeriodo(texto: string) {
  const match = texto.match(/(\d{1,2}\/\d{2})\s+a\s+(\d{1,2}\/\d{2})\/(\d{4})/i);
  if (!match) return { inicio: null, fim: null };
  const ano = match[3] ?? "2000";
  const iso = (valor: string) => {
    const [dia = "01", mes = "01"] = valor.split("/");
    return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  };
  return { inicio: iso(match[1] ?? "01/01"), fim: iso(match[2] ?? "01/01") };
}

function identificarTurno(titulo: string) {
  const valor = titulo.toLocaleLowerCase();
  if (valor.includes("tarde")) return "Tarde";
  if (valor.includes("noite")) return "Noite";
  return "Manhã";
}

function normalizarLinhas(celulas: string[][]) {
  return celulas
    .map((linha) => linha.map(limparTexto))
    .filter((linha) => linha.some(Boolean))
    .map((linha) => [...linha, "", "", "", "", "", ""].slice(0, 6));
}

function montarSecao(titulo: string, celulas: string[][]): SecaoEscalaImportada | null {
  const linhas = normalizarLinhas(celulas);
  if (linhas.length < 2) return null;
  const primeiraLinha = linhas[0] ?? [];
  const cabecalho =
    primeiraLinha.length === 6
      ? primeiraLinha
      : ["Sala", "Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
  const corpo = primeiraLinha.length === 6 ? linhas.slice(1) : linhas;
  return {
    titulo,
    turno: identificarTurno(titulo),
    cabecalho,
    linhas: corpo.map((linha) => ({
      sala: linha[0] ?? "Sem sala",
      dias: Array.from({ length: 5 }, (_, indice) => linha[indice + 1] ?? ""),
    })),
  };
}

export async function importarDocx(file: File): Promise<EscalaImportada> {
  const resultado = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const documento = new DOMParser().parseFromString(resultado.value, "text/html");
  const tabelas = [...documento.querySelectorAll("table")];
  const secoes = tabelas
    .map((tabela, indice) => {
      const anterior = tabela.previousElementSibling?.textContent?.trim() ?? "";
      const titulo = anterior || `Escala de Enfermagem — ${indice === 0 ? "Manhã" : "Tarde"}`;
      const linhas = [...tabela.querySelectorAll("tr")].map((linha) =>
        [...linha.querySelectorAll("th,td")].map((celula) => celula.textContent ?? ""),
      );
      return montarSecao(titulo, linhas);
    })
    .filter(Boolean) as SecaoEscalaImportada[];
  const texto = limparTexto(documento.body.textContent ?? file.name);
  const periodo = extrairPeriodo(texto);
  return {
    titulo: texto.match(/Escala de Enfermagem[^\n]*/i)?.[0] ?? file.name,
    ...periodo,
    secoes,
  };
}

type ItemPdf = { x: number; y: number; texto: string };

async function extrairItensPdf(file: File) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    .promise;
  const paginas: ItemPdf[][][] = [];
  for (let paginaNumero = 1; paginaNumero <= pdf.numPages; paginaNumero += 1) {
    const pagina = await pdf.getPage(paginaNumero);
    const conteudo = await pagina.getTextContent();
    const itens = conteudo.items as Array<{ str?: string; transform?: number[] }>;
    const linhas = new Map<number, ItemPdf[]>();
    for (const item of itens) {
      const texto = limparTexto(item.str ?? "");
      if (!texto) continue;
      const x = item.transform?.[4] ?? 0;
      const yBruto = item.transform?.[5] ?? 0;
      // agrupa itens com diferença de até 2pt na mesma linha
      let y = Math.round(yBruto);
      for (const chave of linhas.keys()) if (Math.abs(chave - yBruto) <= 2) y = chave;
      const linha = linhas.get(y) ?? [];
      linha.push({ x, y, texto });
      linhas.set(y, linha);
    }
    paginas.push(
      [...linhas.entries()].sort(([a], [b]) => b - a).map(([, l]) => l.sort((a, b) => a.x - b.x)),
    );
  }
  return paginas;
}

const DIAS_CABECALHO = ["segunda", "terça", "terca", "quarta", "quinta", "sexta"];
const ROTULOS_IGNORADOS = /^(sala|manh[ãa]|tarde|noite|enfermagem|-)$/i;

function normalizar(valor: string) {
  return valor
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extrairPeriodoPdf(texto: string, nomeArquivo: string) {
  const padrao = extrairPeriodo(texto);
  if (padrao.inicio) return padrao;
  const ano = texto.match(/\b(20\d{2})\b/)?.[1] ?? String(new Date().getFullYear());
  const m = `${texto} ${nomeArquivo}`.match(/(\d{1,2})[./](\d{1,2})\s*a\s*(\d{1,2})[./](\d{1,2})/i);
  if (!m) return { inicio: null, fim: null };
  const iso = (d: string, mm: string) => `${ano}-${mm.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return { inicio: iso(m[1]!, m[2]!), fim: iso(m[3]!, m[4]!) };
}

export async function importarPdf(file: File): Promise<EscalaImportada> {
  const paginas = await extrairItensPdf(file);
  const texto = paginas
    .flat()
    .map((l) => l.map((i) => i.texto).join(" "))
    .join(" ");
  const periodo = extrairPeriodoPdf(texto, file.name);
  const secoes: SecaoEscalaImportada[] = [];
  let turnoAtual = "Manhã";
  for (const linhas of paginas) {
    let colunas: number[] | null = null;
    let secao: SecaoEscalaImportada | null = null;
    let atual: CelulaEscalaImportada | null = null;
    for (const linha of linhas) {
      const textoLinha = normalizar(linha.map((i) => i.texto).join(" "));
      const diasNaLinha = linha.filter((i) =>
        DIAS_CABECALHO.some((d) => normalizar(i.texto).startsWith(normalizar(d))),
      );
      if (diasNaLinha.length >= 3) {
        // cabeçalho: define as posições das colunas e inicia nova seção
        const primeiro = linha[0]?.x ?? 0;
        colunas = [
          Math.min(primeiro, (diasNaLinha[0]?.x ?? 0) - 80),
          ...diasNaLinha.map((i) => i.x),
        ].slice(0, 6);
        secao = {
          titulo: `Escala de Enfermagem (${turnoAtual})`,
          turno: turnoAtual,
          cabecalho: ["Sala", "Segunda", "Terça", "Quarta", "Quinta", "Sexta"],
          linhas: [],
        };
        secoes.push(secao);
        atual = null;
        continue;
      }
      if (textoLinha.includes("tarde") && linha.length <= 3) turnoAtual = "Tarde";
      else if (textoLinha.includes("manha") && linha.length <= 3) turnoAtual = "Manhã";
      if (!colunas || !secao) continue;
      if (secao.turno !== turnoAtual && linha.length <= 3 && !secao.linhas.length) {
        secao.turno = turnoAtual;
        secao.titulo = `Escala de Enfermagem (${turnoAtual})`;
      }
      const cols = colunas;
      const celulas: string[] = ["", "", "", "", "", ""];
      for (const item of linha) {
        // coluna = a última cuja posição inicial (com tolerância) é <= x
        let indice = 0;
        for (let c = 0; c < cols.length; c += 1) if (item.x >= (cols[c] ?? 0) - 15) indice = c;
        celulas[indice] = limparTexto(`${celulas[indice]} ${item.texto}`);
      }
      const sala = celulas[0] ?? "";
      const temDias = celulas.slice(1).some(Boolean);
      if (sala && !ROTULOS_IGNORADOS.test(sala)) {
        atual = { sala, dias: celulas.slice(1, 6) };
        secao.linhas.push(atual);
      } else if (temDias && atual) {
        atual.dias = atual.dias.map((d, i) => limparTexto(`${d} ${celulas[i + 1] ?? ""}`));
      }
    }
  }
  return {
    titulo: texto.match(/Escala de Enfermagem[^\n]*?(?=\s{2}|$)/i)?.[0]?.slice(0, 80) ?? file.name,
    ...periodo,
    secoes: secoes.filter((s) => s.linhas.length),
  };
}

export async function importarEscalaArquivo(file: File) {
  const nome = file.name.toLocaleLowerCase();
  if (nome.endsWith(".docx")) return importarDocx(file);
  if (nome.endsWith(".pdf")) return importarPdf(file);
  throw new Error("Selecione um arquivo Word (.docx) ou PDF (.pdf).");
}
