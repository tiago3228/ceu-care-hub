import JSZip from "jszip";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export interface AutoTextoImportado {
  nome: string;
  abreviacao: string;
  conteudoHtml: string;
  conteudoTexto: string;
}

export interface ResultadoImportacaoAutoTexto {
  formato: string;
  entradas: AutoTextoImportado[];
  falhas: string[];
  status: "concluida" | "parcial" | "sem_conteudo" | "formato_nao_suportado";
  resumo: string;
}

const TAGS_PERMITIDAS = new Set([
  "p",
  "div",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ol",
  "ul",
  "li",
  "br",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "blockquote",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "font",
  "sup",
  "sub",
  "s",
  "strike",
  "hr",
]);
const ESTILOS_PERMITIDOS = new Set([
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
  "color",
  "background-color",
  "line-height",
  "margin-left",
  "margin-right",
  "text-indent",
  "break-before",
  "page-break-before",
  "border",
  "border-collapse",
  "padding",
  "vertical-align",
  "width",
]);

function estiloSeguro(value: string) {
  return !/url\s*\(|expression\s*\(|javascript:|[<>]/i.test(value);
}

/** Mantém somente marcação de texto e estilos inofensivos necessários aos autotextos. */
export function sanitizarHtmlLaudo(html: string): string {
  if (typeof document === "undefined") return "";
  const origem = document.createElement("template");
  origem.innerHTML = html;

  const copiar = (node: Node): Node | DocumentFragment | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? "");
    if (!(node instanceof HTMLElement)) return null;
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "iframe", "object", "embed", "svg", "math"].includes(tag)) {
      return null;
    }
    if (!TAGS_PERMITIDAS.has(tag)) {
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(node.childNodes)) {
        const clean = copiar(child);
        if (clean) fragment.append(clean);
      }
      return fragment;
    }

    const safeTag = tag === "font" ? "span" : tag;
    const destino = document.createElement(safeTag);
    if (node.hasAttribute("style")) {
      for (const rule of Array.from(node.style)) {
        const value = node.style.getPropertyValue(rule).trim();
        if (ESTILOS_PERMITIDOS.has(rule) && estiloSeguro(value)) {
          destino.style.setProperty(rule, value);
        }
      }
    }
    if (tag === "font") {
      const family = node.getAttribute("face")?.trim();
      if (family && /^[\p{L}\p{N} _-]{1,80}$/u.test(family)) {
        destino.style.fontFamily = family;
      }
      const legacySize = node.getAttribute("size");
      const mappedSize: Record<string, string> = {
        "1": "8pt",
        "2": "10pt",
        "3": "12pt",
        "4": "14pt",
        "5": "18pt",
        "6": "24pt",
        "7": "36pt",
      };
      if (legacySize && mappedSize[legacySize] && !destino.style.fontSize) {
        destino.style.fontSize = mappedSize[legacySize];
      }
      const color = node.getAttribute("color");
      if (color && /^#?[\da-f]{3,8}$/i.test(color)) {
        destino.style.color = color.startsWith("#") ? color : `#${color}`;
      }
    }
    for (const child of Array.from(node.childNodes)) {
      const clean = copiar(child);
      if (clean) destino.append(clean);
    }
    return destino;
  };

  const saida = document.createElement("div");
  for (const child of Array.from(origem.content.childNodes)) {
    const clean = copiar(child);
    if (clean) saida.append(clean);
  }
  return saida.innerHTML;
}

function lerAtributoWord(element: Element | null, nome: string) {
  if (!element) return "";
  return (
    element.getAttributeNS(WORD_NS, nome) ??
    element.getAttribute(`w:${nome}`) ??
    element.getAttribute(nome) ??
    ""
  );
}

function escaparHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function nomeLocal(element: Element) {
  return (element.localName || element.tagName).split(":").pop() ?? element.tagName;
}

function obterFilhos(element: Element | Document, localName: string) {
  const namespaced = Array.from(element.getElementsByTagNameNS(WORD_NS, localName));
  if (namespaced.length) return namespaced;
  const isDocument = typeof Document !== "undefined" && element instanceof Document;
  const root = isDocument ? (element as Document).documentElement : (element as Element);
  const prefix = root?.lookupPrefix?.(WORD_NS) ?? "w";
  const prefixed = Array.from(new Set([prefix, "w", ""])).flatMap((candidatePrefix) =>
    Array.from(
      element.getElementsByTagName(candidatePrefix ? `${candidatePrefix}:${localName}` : localName),
    ),
  );
  if (prefixed.length) return prefixed;
  return Array.from(element.getElementsByTagName("*")).filter(
    (candidate) => nomeLocal(candidate) === localName,
  );
}

function obterEstiloRun(run: Element) {
  const rPr = obterFilhos(run, "rPr")[0];
  if (!rPr) return "";
  const estilos: string[] = [];
  const bold = obterFilhos(rPr, "b")[0];
  const italic = obterFilhos(rPr, "i")[0];
  const underline = obterFilhos(rPr, "u")[0];
  const color = obterFilhos(rPr, "color")[0];
  const size = obterFilhos(rPr, "sz")[0];
  const fonts = obterFilhos(rPr, "rFonts")[0];
  if (bold && lerAtributoWord(bold, "val") !== "0" && lerAtributoWord(bold, "val") !== "false") {
    estilos.push("font-weight:bold");
  }
  if (
    italic &&
    lerAtributoWord(italic, "val") !== "0" &&
    lerAtributoWord(italic, "val") !== "false"
  ) {
    estilos.push("font-style:italic");
  }
  if (underline && !["none", "0", "false"].includes(lerAtributoWord(underline, "val"))) {
    estilos.push("text-decoration:underline");
  }
  const hexColor = lerAtributoWord(color, "val");
  if (/^[\da-f]{6}$/i.test(hexColor)) estilos.push(`color:#${hexColor}`);
  const halfPoints = Number(lerAtributoWord(size, "val"));
  if (Number.isFinite(halfPoints) && halfPoints > 0) estilos.push(`font-size:${halfPoints / 2}pt`);
  const family = lerAtributoWord(fonts, "ascii") || lerAtributoWord(fonts, "hAnsi");
  if (family && /^[\p{L}\p{N} _-]{1,80}$/u.test(family)) {
    estilos.push(`font-family:${family}`);
  }
  return estilos.join(";");
}

function converterRun(run: Element): string {
  const partes: string[] = [];
  for (const child of Array.from(run.children)) {
    const tipo = nomeLocal(child);
    if (tipo === "t" || tipo === "delText" || tipo === "instrText") {
      partes.push(escaparHtml(child.textContent ?? ""));
    } else if (tipo === "tab") {
      partes.push("&nbsp;&nbsp;&nbsp;&nbsp;");
    } else if (tipo === "br" || tipo === "cr") {
      partes.push("<br>");
    }
  }
  if (!partes.length && run.textContent) partes.push(escaparHtml(run.textContent));
  const estilos = obterEstiloRun(run);
  return estilos
    ? `<span style="${escaparHtml(estilos)}">${partes.join("")}</span>`
    : partes.join("");
}

function converterParagrafo(paragrafo: Element): string {
  const pPr = obterFilhos(paragrafo, "pPr")[0];
  const alinhamento = lerAtributoWord(obterFilhos(pPr ?? paragrafo, "jc")[0], "val");
  const alinhamentoCss: Record<string, string> = {
    left: "left",
    start: "left",
    center: "center",
    right: "right",
    end: "right",
    both: "justify",
    distribute: "justify",
  };
  const estilos: string[] = [];
  if (alinhamentoCss[alinhamento]) estilos.push(`text-align:${alinhamentoCss[alinhamento]}`);
  const spacing = obterFilhos(pPr ?? paragrafo, "spacing")[0];
  const line = Number(lerAtributoWord(spacing, "line"));
  if (line > 0 && lerAtributoWord(spacing, "lineRule") !== "exact") {
    estilos.push(`line-height:${Math.max(1, Math.min(3, line / 240))}`);
  }
  const indent = Number(lerAtributoWord(obterFilhos(pPr ?? paragrafo, "ind")[0], "left"));
  if (indent > 0) estilos.push(`margin-left:${Math.min(indent / 15, 240)}px`);
  const pageBreak = obterFilhos(pPr ?? paragrafo, "pageBreakBefore")[0];
  if (pageBreak) estilos.push("break-before:page");
  const runs = Array.from(paragrafo.children)
    .map((child) => {
      if (nomeLocal(child) === "r") return converterRun(child);
      if (["hyperlink", "smartTag", "sdt"].includes(nomeLocal(child))) {
        return obterFilhos(child, "r").map(converterRun).join("");
      }
      return "";
    })
    .join("");
  return `<p${estilos.length ? ` style="${estilos.join(";")}"` : ""}>${runs || "<br>"}</p>`;
}

function converterTabela(tabela: Element): string {
  const linhas = obterFilhos(tabela, "tr");
  const trs = linhas
    .map((linha) => {
      const celulas = Array.from(linha.children)
        .filter((element) => nomeLocal(element) === "tc")
        .map((celula) => {
          const paragrafos = obterFilhos(celula, "p").map(converterParagrafo).join("");
          return `<td style="border:1px solid #777;padding:4px">${paragrafos || "<p><br></p>"}</td>`;
        })
        .join("");
      return `<tr>${celulas}</tr>`;
    })
    .join("");
  return `<table style="border-collapse:collapse;width:100%"><tbody>${trs}</tbody></table>`;
}

function textoDeHtml(html: string) {
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]*>/g, " ").trim();
  const documento = new DOMParser().parseFromString(html, "text/html");
  return (documento.body.textContent || documento.documentElement.textContent || "")
    .replace(/\u00a0/g, " ")
    .trim();
}

/** Extrai entradas AutoText do glossary OOXML (.dotx/.dotm/.docx), sem alterar o arquivo. */
export async function importarAutoTextosWord(file: File): Promise<ResultadoImportacaoAutoTexto> {
  const extensao = file.name.split(".").pop()?.toLowerCase() ?? "";
  const formato = extensao || "desconhecido";
  if (!["dotx", "dotm", "docx", "docm"].includes(extensao)) {
    return {
      formato,
      entradas: [],
      falhas: [
        `O formato .${formato} é binário legado e não pode ser lido com segurança pelo importador do navegador. Nenhuma entrada foi alterada ou descartada; converta/exporte o AutoText para .dotx ou .docx com as entradas preservadas.`,
      ],
      status: "formato_nao_suportado",
      resumo: "Arquivo preservado localmente; nenhum autotexto foi importado.",
    };
  }

  try {
    const pacote = await JSZip.loadAsync(await file.arrayBuffer());
    const glossary = pacote.file("word/glossary/document.xml");
    if (!glossary) {
      return {
        formato,
        entradas: [],
        falhas: [
          "O pacote não contém word/glossary/document.xml; o texto do corpo não foi tratado como AutoText para evitar importação incorreta.",
        ],
        status: "sem_conteudo",
        resumo: "Nenhuma entrada de AutoText foi encontrada no glossário do modelo.",
      };
    }

    const xml = await glossary.async("string");
    const documento = new DOMParser().parseFromString(xml, "application/xml");
    if (documento.getElementsByTagName("parsererror").length) {
      throw new Error("O XML de glossário está malformado.");
    }
    const parts = obterFilhos(documento, "docPart");
    const entradas: AutoTextoImportado[] = [];
    const falhas: string[] = [];
    const vistos = new Set<string>();

    for (const part of parts) {
      const properties = Array.from(part.children).find(
        (element) => nomeLocal(element) === "docPartPr",
      );
      const tipos = properties
        ? obterFilhos(properties, "type").map((element) => lerAtributoWord(element, "val"))
        : [];
      const galerias = properties
        ? obterFilhos(properties, "gallery").map((element) => lerAtributoWord(element, "val"))
        : [];
      const nomeNode = properties ? (obterFilhos(properties, "name")[0] ?? null) : null;
      const aliasNode = properties ? (obterFilhos(properties, "alias")[0] ?? null) : null;
      const nome = (lerAtributoWord(nomeNode, "val") || lerAtributoWord(aliasNode, "val")).trim();
      const body = Array.from(part.children).find(
        (element) => nomeLocal(element) === "docPartBody",
      );
      const ehAutoTexto = galerias.includes("autoTxt") || tipos.includes("autoTxt");
      if (!ehAutoTexto) continue;
      if (!nome || !body) {
        falhas.push(`${nome || "Entrada sem nome"}: falta o nome ou o conteúdo do autotexto.`);
        continue;
      }
      const htmlParts = Array.from(body.children)
        .map((element) => {
          if (nomeLocal(element) === "p") return converterParagrafo(element);
          if (nomeLocal(element) === "tbl") return converterTabela(element);
          return "";
        })
        .filter(Boolean);
      const conteudoHtml = sanitizarHtmlLaudo(htmlParts.join(""));
      const conteudoTexto = textoDeHtml(conteudoHtml);
      if (!conteudoTexto) {
        falhas.push(`${nome}: o conteúdo do autotexto está vazio ou não foi reconhecido.`);
        continue;
      }
      const chave = nome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
      if (vistos.has(chave)) {
        falhas.push(`${nome}: entrada duplicada dentro do arquivo; mantida somente a primeira.`);
        continue;
      }
      vistos.add(chave);
      entradas.push({ nome, abreviacao: nome, conteudoHtml, conteudoTexto });
    }

    if (!entradas.length) {
      return {
        formato,
        entradas,
        falhas: falhas.length
          ? falhas
          : ["O glossário não contém partes classificadas como AutoText."],
        status: "sem_conteudo",
        resumo: "Nenhuma entrada utilizável foi importada; veja os detalhes do arquivo.",
      };
    }
    const status = falhas.length ? "parcial" : "concluida";
    return {
      formato,
      entradas,
      falhas,
      status,
      resumo: `${entradas.length} autotexto(s) recuperado(s)${falhas.length ? `; ${falhas.length} entrada(s) requer(em) revisão` : ""}.`,
    };
  } catch (error) {
    return {
      formato,
      entradas: [],
      falhas: [`Falha de leitura: ${(error as Error).message}`],
      status: "sem_conteudo",
      resumo: "O arquivo permaneceu intacto; nenhum autotexto foi gravado.",
    };
  }
}

type FormatoRun = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontFamily?: string;
  fontSize?: string;
};

function escaparXml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function extrairFormato(element: HTMLElement, inherited: FormatoRun): FormatoRun {
  const tag = element.tagName.toLowerCase();
  const next = { ...inherited };
  if (["b", "strong"].includes(tag)) next.bold = true;
  if (["i", "em"].includes(tag)) next.italic = true;
  if (tag === "u") next.underline = true;
  const font = element.getAttribute("face");
  const inlineFamily = element.style.fontFamily || font;
  if (inlineFamily && /^[\p{L}\p{N} _-]{1,80}$/u.test(inlineFamily.replaceAll(/["']/g, ""))) {
    next.fontFamily = inlineFamily.replaceAll(/["']/g, "");
  }
  if (element.style.fontSize) next.fontSize = element.style.fontSize;
  if (element.style.color && estiloSeguro(element.style.color)) next.color = element.style.color;
  if (element.style.fontWeight === "bold" || Number(element.style.fontWeight) >= 600)
    next.bold = true;
  if (element.style.fontStyle === "italic") next.italic = true;
  if (element.style.textDecoration.includes("underline")) next.underline = true;
  return next;
}

function xmlRun(texto: string, format: FormatoRun): string {
  if (!texto) return "";
  const rPr: string[] = [];
  if (format.bold) rPr.push("<w:b/>");
  if (format.italic) rPr.push("<w:i/>");
  if (format.underline) rPr.push('<w:u w:val="single"/>');
  if (format.fontFamily) {
    const family = escaparXml(format.fontFamily);
    rPr.push(`<w:rFonts w:ascii="${family}" w:hAnsi="${family}" w:eastAsia="${family}"/>`);
  }
  if (format.color && /^#?[\da-f]{3,8}$/i.test(format.color)) {
    rPr.push(`<w:color w:val="${format.color.replace("#", "")}"/>`);
  }
  if (format.fontSize) {
    const match = format.fontSize.match(/([\d.]+)\s*(px|pt)?/i);
    if (match) {
      const value = Number(match[1]) * (match[2]?.toLowerCase() === "px" ? 0.75 : 1);
      if (Number.isFinite(value) && value >= 4 && value <= 96) {
        const halfPoints = Math.round(value * 2);
        rPr.push(`<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`);
      }
    }
  }
  const text = escaparXml(texto);
  return `<w:r>${rPr.length ? `<w:rPr>${rPr.join("")}</w:rPr>` : ""}<w:t xml:space="preserve">${text}</w:t></w:r>`;
}

function converterInline(node: Node, inherited: FormatoRun): string {
  if (node.nodeType === Node.TEXT_NODE) return xmlRun(node.textContent ?? "", inherited);
  if (!(node instanceof HTMLElement)) return "";
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "<w:r><w:br/></w:r>";
  const format = extrairFormato(node, inherited);
  return Array.from(node.childNodes)
    .map((child) => converterInline(child, format))
    .join("");
}

function convertParagraph(element: HTMLElement, prefix = "") {
  const style = element.style;
  const pPr: string[] = [];
  const align: Record<string, string> = {
    left: "left",
    center: "center",
    right: "right",
    justify: "both",
  };
  if (align[style.textAlign]) pPr.push(`<w:jc w:val="${align[style.textAlign]}"/>`);
  const leftMargin = style.marginLeft || style.textIndent;
  const indent = leftMargin.match(/([\d.]+)\s*(px|pt)?/i);
  if (indent) {
    const px = Number(indent[1]) * (indent[2]?.toLowerCase() === "pt" ? 96 / 72 : 1);
    if (px > 0 && px < 1000) pPr.push(`<w:ind w:left="${Math.round(px * 15)}"/>`);
  }
  const lineHeight = style.lineHeight;
  if (lineHeight && /^[\d.]+$/.test(lineHeight)) {
    const line = Math.round(Number(lineHeight) * 240);
    if (line > 0 && line < 1000) pPr.push(`<w:spacing w:line="${line}" w:lineRule="auto"/>`);
  }
  if (["page", "always"].includes(style.breakBefore || style.pageBreakBefore)) {
    pPr.push("<w:pageBreakBefore/>");
  }
  const tag = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) pPr.push(`<w:pStyle w:val="Heading${tag.slice(1)}"/>`);
  const body = `${prefix ? xmlRun(prefix, {}) : ""}${Array.from(element.childNodes)
    .map((child) => converterInline(child, {}))
    .join("")}`;
  return `<w:p>${pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : ""}${body || "<w:r><w:t></w:t></w:r>"}</w:p>`;
}

function converterBlocos(container: HTMLElement): string {
  const blocos: string[] = [];
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) blocos.push(`<w:p>${xmlRun(node.textContent, {})}</w:p>`);
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === "table") {
      const rows = Array.from(node.querySelectorAll(":scope > tbody > tr, :scope > tr"));
      const xmlRows = rows
        .map((row) => {
          const cells = Array.from(row.children)
            .filter((cell) => ["td", "th"].includes(cell.tagName.toLowerCase()))
            .map((cell) => {
              const cellHtml = cell as HTMLElement;
              const cellBlocks = converterBlocos(cellHtml) || "<w:p/>";
              return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${cellBlocks}</w:tc>`;
            })
            .join("");
          return `<w:tr>${cells}</w:tr>`;
        })
        .join("");
      blocos.push(
        `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${xmlRows}</w:tbl>`,
      );
    } else if (["ul", "ol"].includes(tag)) {
      const items = Array.from(node.children).filter(
        (child) => child.tagName.toLowerCase() === "li",
      );
      items.forEach((item, index) => {
        const bullet = tag === "ol" ? `${index + 1}. ` : "• ";
        blocos.push(convertParagraph(item as HTMLElement, bullet));
      });
    } else if (
      tag === "p" ||
      tag === "li" ||
      /^h[1-6]$/.test(tag) ||
      tag === "blockquote" ||
      tag === "pre"
    ) {
      blocos.push(convertParagraph(node));
    } else if (["div", "section", "article", "body"].includes(tag)) {
      if (node.querySelector("p,div,table,ul,ol,h1,h2,h3,h4,h5,h6")) {
        blocos.push(converterBlocos(node));
      } else {
        blocos.push(convertParagraph(node));
      }
    } else {
      blocos.push(convertParagraph(node));
    }
  }
  return blocos.join("");
}

/** Gera um pacote DOCX leve no navegador, mantendo estilos e estrutura de parágrafos/tabelas. */
export async function gerarDocxLaudo(titulo: string, html: string, fontePadrao = "Garamond") {
  const safeHtml = sanitizarHtmlLaudo(html);
  const container = document.createElement("div");
  container.innerHTML = safeHtml;
  const corpo = converterBlocos(container) || "<w:p/>";
  const fonte = escaparXml(fontePadrao.replaceAll(/["']/g, ""));
  const tituloXml = `<w:p><w:pPr><w:pStyle w:val="Title"/><w:spacing w:after="240"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="30"/></w:rPr><w:t xml:space="preserve">${escaparXml(titulo.trim() || "Laudo")}</w:t></w:r></w:p>`;
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      "</Types>",
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>",
  );
  zip.file(
    "word/document.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:body>${tituloXml}${corpo}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  zip.file(
    "word/styles.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${fonte}" w:hAnsi="${fonte}"/><w:sz w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120"/></w:pPr></w:pPrDefault></w:docDefaults>` +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>' +
      "</w:styles>",
  );
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
}

export function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
