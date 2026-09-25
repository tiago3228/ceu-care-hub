import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";

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

async function extrairPaginasPdf(file: File) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    .promise;
  const paginas: string[][] = [];
  for (let paginaNumero = 1; paginaNumero <= pdf.numPages; paginaNumero += 1) {
    const pagina = await pdf.getPage(paginaNumero);
    const conteudo = await pagina.getTextContent();
    const itens = conteudo.items as Array<{ str?: string; transform?: number[] }>;
    const linhas = new Map<number, Array<{ x: number; texto: string }>>();
    for (const item of itens) {
      const texto = limparTexto(item.str ?? "");
      const x = item.transform?.[4] ?? 0;
      const y = Math.round(item.transform?.[5] ?? 0);
      if (!texto) continue;
      const linha = linhas.get(y) ?? [];
      linha.push({ x, texto });
      linhas.set(y, linha);
    }
    paginas.push(
      [...linhas.entries()]
        .sort(([a], [b]) => b - a)
        .map(([, itensDaLinha]) =>
          itensDaLinha
            .sort((a, b) => a.x - b.x)
            .map((item) => item.texto)
            .join(" "),
        ),
    );
  }
  return paginas;
}

export async function importarPdf(file: File): Promise<EscalaImportada> {
  const paginas = await extrairPaginasPdf(file);
  const texto = paginas.flat().join(" ");
  const periodo = extrairPeriodo(texto);
  const secoes = paginas.map((linhas, pagina) => {
    const turno = pagina === 0 ? "Manhã" : "Tarde";
    const celulas = linhas
      .filter((linha) => linha.trim())
      .map((linha) => [linha, "", "", "", "", ""]);
    return montarSecao(`Escala de Enfermagem (${turno})`, celulas);
  });
  return {
    titulo: texto.match(/Escala de Enfermagem[^\n]*/i)?.[0] ?? file.name,
    ...periodo,
    secoes: secoes.filter(Boolean) as SecaoEscalaImportada[],
  };
}

export async function importarEscalaArquivo(file: File) {
  const nome = file.name.toLocaleLowerCase();
  if (nome.endsWith(".docx")) return importarDocx(file);
  if (nome.endsWith(".pdf")) return importarPdf(file);
  throw new Error("Selecione um arquivo Word (.docx) ou PDF (.pdf).");
}
