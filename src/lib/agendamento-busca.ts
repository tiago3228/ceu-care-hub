export type MedicoAgendamento = {
  id: string;
  name: string;
  aliases?: string[];
  crm: string;
  specialty?: string | null;
  schedules?: string[];
  generalRules?: string[];
  notPerformed?: string[];
  insuranceRestrictions?: string[];
  ultrasoundRules?: string[];
  densitometry?: string[];
  conflicts?: string[];
  interventions?: string[];
  elastography?: string[];
  diuGuidance?: string[];
  sourceText?: string[];
  exams: { name: string; slots: unknown; conditions?: string[] }[];
};

export function normalizar(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PALAVRAS_IGNORADAS = new Set([
  "a",
  "as",
  "o",
  "os",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "por",
  "para",
  "com",
  "sem",
  "ao",
  "aos",
  "qual",
  "quais",
  "quem",
  "como",
  "quando",
  "onde",
  "quanto",
  "quantos",
  "quantas",
  "medico",
  "medicos",
  "doutor",
  "doutora",
  "atende",
  "atendem",
  "atender",
  "realiza",
  "realizam",
  "realizar",
  "faz",
  "fazem",
  "fazer",
  "pode",
  "podem",
  "posso",
  "tem",
  "ter",
  "exame",
  "exames",
  "paciente",
  "pacientes",
  "regra",
  "regras",
  "particularidade",
  "particularidades",
  "gostaria",
  "preciso",
  "queria",
  "saber",
  "existe",
  "algum",
  "alguma",
  "alguns",
  "algumas",
  "meu",
  "minha",
  "favor",
  "dr",
  "dra",
]);

// Os grupos tratam formas diferentes de perguntar sobre o mesmo tema sem acrescentar fatos.
const SINONIMOS = [
  ["convenio", "convenios", "plano", "planos", "operadora"],
  ["atraso", "atrasos", "demora", "demorado", "pontual", "pontualidade", "espera"],
  [
    "peso",
    "kg",
    "quilo",
    "quilos",
    "kilo",
    "kilos",
    "quilograma",
    "quilogramas",
    "capacidade",
    "suporta",
  ],
  ["idade", "anos", "crianca", "criancas", "infantil", "adolescente", "idoso", "idosa", "menor"],
  ["manha", "matutino", "matutina", "matutinos", "matutinas"],
  ["tarde", "vespertino", "vespertina", "vespertinos", "vespertinas"],
  ["sabado", "sabados"],
  ["encaixe", "encaixes", "encaixar"],
  ["mamografia", "mama", "mamas", "axila", "axilas"],
  ["pedido", "requisicao", "solicitacao", "solicitante"],
  ["preparo", "jejum", "preparacao"],
  ["gestante", "gravida", "gravidez", "gestacao", "gestacional", "semanas", "trimestre"],
  ["pne", "pcd", "deficiencia", "comorbidade", "comorbidades", "mobilidade"],
  ["cancelar", "cancelamento", "remarcar", "remarcacao", "reagendar", "reagendamento"],
  ["limite", "maximo", "maxima", "cota", "quantidade", "quantos", "quantas"],
  ["abdome", "abdomen", "abdominal"],
  ["tireoide", "tireoidiano", "cervical"],
  ["endovaginal", "transvaginal", "vaginal"],
  ["pelvico", "pelvica", "pelve"],
  ["obstetrico", "obstetrica", "obstetricia", "gestacional"],
  ["morfologico", "morfologica", "morfológico"],
] as const;

const PALAVRAS_GENERICAS_DE_EXAME = new Set([
  "com",
  "sem",
  "para",
  "por",
  "us",
  "ultrassom",
  "ultrassonografia",
  "simples",
  "exame",
  "exames",
  "avaliacao",
  "controle",
]);

function tokensDaPergunta(texto: string) {
  return normalizar(texto)
    .split(" ")
    .filter((token) => token.length > 1 && !PALAVRAS_IGNORADAS.has(token));
}

function contemTermo(texto: string, termo: string) {
  if (termo.length <= 2) return ` ${texto} `.includes(` ${termo} `);
  return texto.includes(termo);
}

function variantesDoToken(token: string) {
  return (
    SINONIMOS.find((grupo) => grupo.some((variante) => normalizar(variante) === token)) ?? [token]
  );
}

function termosDoMedico(medico: MedicoAgendamento) {
  return [medico.name, ...(medico.aliases ?? [])]
    .flatMap((nome) => tokensDaPergunta(nome))
    .filter((token) => token.length > 3);
}

function linhaPontuada(
  linha: string,
  conceitos: string[][],
  consultaNegativa: boolean,
  consultaCompleta: string,
) {
  const texto = normalizar(linha);
  const pontos = conceitos.reduce(
    (total, variantes) => total + (variantes.some((termo) => contemTermo(texto, termo)) ? 1 : 0),
    0,
  );
  const contemNegacao = /\b(nao|nunca|proibido|proibida|contraindicado|contraindicada)\b/.test(
    texto,
  );
  const regraSemCategoria = texto.replace(/^(agenda|convenio\/restricao|conflito):\s*/, "");
  const fraseCompletaEncontrada =
    regraSemCategoria.length >= 8 && consultaCompleta.includes(regraSemCategoria);
  return (
    pontos * 3 + (fraseCompletaEncontrada ? 8 : 0) + (consultaNegativa && contemNegacao ? 1 : 0)
  );
}

function linhasDaRegra(medico: MedicoAgendamento) {
  return [
    ...(medico.schedules ?? []).map((item) => `Agenda: ${item}`),
    ...(medico.generalRules ?? []),
    ...(medico.notPerformed ?? []).map((item) => `Não realiza: ${item}`),
    ...(medico.insuranceRestrictions ?? []).map((item) => `Convênio/restrição: ${item}`),
    ...(medico.ultrasoundRules ?? []),
    ...(medico.densitometry ?? []),
    ...(medico.interventions ?? []),
    ...(medico.elastography ?? []),
    ...(medico.diuGuidance ?? []),
    ...(medico.sourceText ?? []).filter((item) => item.trim()),
    ...(medico.conflicts ?? []).map((item) => `Conflito: ${item}`),
    ...(medico.exams ?? []).flatMap((item) => [
      `${item.name}: ${(item.conditions ?? []).join(" ")}`,
    ]),
  ];
}

function nomesDeExameCorrespondentes(
  medico: MedicoAgendamento,
  consulta: string,
  conceitos: string[][],
) {
  return (medico.exams ?? []).filter((item) => {
    const nome = normalizar(item.name);
    if (nome && consulta.includes(nome)) return true;
    const termosDoNome = nome
      .split(" ")
      .filter((token) => token.length > 2 && !PALAVRAS_GENERICAS_DE_EXAME.has(token));
    return conceitos.some((variantes) =>
      variantes.some((termo) =>
        termosDoNome.some((termoDoNome) => termoDoNome === termo || termoDoNome.includes(termo)),
      ),
    );
  });
}

function examesNaoRealizadosCorrespondentes(
  medico: MedicoAgendamento,
  consulta: string,
  conceitos: string[][],
) {
  return (medico.notPerformed ?? []).filter((item) => {
    const nome = normalizar(item);
    if (nome && consulta.includes(nome)) return true;
    const termosDoNome = nome
      .split(" ")
      .filter((token) => token.length > 2 && !PALAVRAS_GENERICAS_DE_EXAME.has(token));
    const termosRestritivos = termosDoNome.filter((termo) =>
      /masculin|feminin|apos|antes|depois|somente|apenas|controle|contagem|pesquisa|segundo|trimestre|semanas/.test(
        termo,
      ),
    );
    const termosCorrespondentes = termosDoNome.filter((termoDoNome) =>
      conceitos.some((variantes) =>
        variantes.some((variante) => termoDoNome === variante || termoDoNome.includes(variante)),
      ),
    );
    const restricoesCorrespondentes = termosRestritivos.every((termo) =>
      conceitos.some((variantes) => variantes.some((variante) => termo === variante)),
    );
    return (
      termosCorrespondentes.length >= Math.min(2, termosDoNome.length) && restricoesCorrespondentes
    );
  });
}

export function temParticularidades(medico: MedicoAgendamento) {
  return Boolean(
    (medico.schedules?.length ?? 0) > 0 ||
    (medico.generalRules?.length ?? 0) > 0 ||
    (medico.notPerformed?.length ?? 0) > 0 ||
    (medico.insuranceRestrictions?.length ?? 0) > 0 ||
    (medico.ultrasoundRules?.length ?? 0) > 0 ||
    (medico.densitometry?.length ?? 0) > 0 ||
    (medico.conflicts?.length ?? 0) > 0 ||
    (medico.interventions?.length ?? 0) > 0 ||
    (medico.elastography?.length ?? 0) > 0 ||
    (medico.diuGuidance?.length ?? 0) > 0 ||
    (medico.sourceText?.some((item) => item.trim().length > 0) ?? false) ||
    (medico.exams?.some((item) => (item.conditions?.length ?? 0) > 0) ?? false),
  );
}

export function responderAjuda(pergunta: string, base: readonly MedicoAgendamento[]) {
  const consulta = normalizar(pergunta.trim());
  const tokens = [...new Set(tokensDaPergunta(consulta))];
  const medicosEncontrados = base.filter((medico) => {
    const termos = termosDoMedico(medico);
    return termos.some((termo) => tokens.includes(termo));
  });
  const termosDosMedicos = new Set(medicosEncontrados.flatMap(termosDoMedico));
  const tokensDeConteudo = tokens.filter((token) => !termosDosMedicos.has(token));
  const tokensComSinonimos = new Set(tokensDeConteudo);
  for (const grupo of SINONIMOS) {
    if (grupo.some((variante) => tokensDeConteudo.includes(normalizar(variante)))) {
      grupo.forEach((variante) => tokensComSinonimos.add(normalizar(variante)));
    }
  }
  if (/kg|quilo|kilo|quilograma|peso/.test(consulta)) {
    [
      "peso",
      "kg",
      "quilo",
      "quilos",
      "kilo",
      "kilos",
      "quilograma",
      "quilogramas",
      "capacidade",
      "suporta",
    ].forEach((termo) => tokensComSinonimos.add(termo));
  }
  if (/quantas|quantos|limite|por dia|por turno/.test(consulta)) {
    ["limite", "maximo", "maxima", "cota", "quantidade", "dia", "turno"].forEach((termo) =>
      tokensComSinonimos.add(termo),
    );
  }
  const conceitos: string[][] = [];
  const conceitosVistos = new Set<string>();
  for (const token of tokensComSinonimos) {
    const variantes = [...variantesDoToken(token)].map(normalizar);
    const chave = variantes.slice().sort().join("|");
    if (!conceitosVistos.has(chave)) {
      conceitosVistos.add(chave);
      conceitos.push(variantes);
    }
  }
  const consultaNegativa = /\b(nao|nunca|proibido|proibida|contraindicado|contraindicada)\b/.test(
    consulta,
  );
  const perguntaSobreAtraso = /atras|demora|pontual|espera/.test(consulta);
  const candidatos = medicosEncontrados.length ? medicosEncontrados : base;

  const resultadosOrdenados = candidatos
    .map((medico) => {
      const linhas = linhasDaRegra(medico);
      const pontuacoes = linhas
        .map((linha) => ({
          linha,
          pontos: linhaPontuada(linha, conceitos, consultaNegativa, consulta),
        }))
        .filter((item) => item.pontos > 0)
        .sort((a, b) => b.pontos - a.pontos);
      const examesCorrespondentes = nomesDeExameCorrespondentes(medico, consulta, conceitos);
      const examesNaoRealizados = examesNaoRealizadosCorrespondentes(medico, consulta, conceitos);
      const medicoFoiNomeado =
        medicosEncontrados.some((item) => item.id === medico.id) ||
        (base.length === 1 && base[0].id === medico.id);
      let respostaDireta: string | undefined;

      if (examesNaoRealizados.length > 0) {
        respostaDireta = `Não. A base informa que não realiza: ${examesNaoRealizados.join("; ")}.`;
      } else if (examesCorrespondentes.length > 0) {
        respostaDireta = `Sim. O exame aparece na base: ${examesCorrespondentes
          .map(
            (item) =>
              `${item.name}${item.slots != null ? ` (${typeof item.slots === "object" ? "conforme duração" : `${item.slots} horário(s)`})` : ""}`,
          )
          .join("; ")}. Confira as condições específicas antes de confirmar.`;
      } else if (perguntaSobreAtraso && medicoFoiNomeado) {
        const regraAtraso = linhas.find((linha) => /atras|demora|pontual|horario/i.test(linha));
        respostaDireta = regraAtraso
          ? `A ficha informa: ${regraAtraso}`
          : `Não encontrei na ficha uma observação explícita sobre atraso, pontualidade ou demora para ${medico.name}. Confira as regras completas abaixo.`;
      }

      const linhasExibidas =
        pontuacoes.length > 0
          ? pontuacoes.slice(0, perguntaSobreAtraso ? 8 : 6).map((item) => item.linha)
          : medicoFoiNomeado
            ? linhas.slice(0, 8)
            : [];
      const relevancia =
        (medicoFoiNomeado ? 100 : 0) +
        pontuacoes.reduce((total, item) => total + item.pontos, 0) +
        examesCorrespondentes.length * 5 +
        examesNaoRealizados.length * 8;
      return { medico, linhas: Array.from(new Set(linhasExibidas)), respostaDireta, relevancia };
    })
    .filter((item) => item.linhas.length > 0 || item.respostaDireta)
    .sort(
      (a, b) => b.relevancia - a.relevancia || a.medico.name.localeCompare(b.medico.name, "pt-BR"),
    )
    .slice(0, 8);

  if (!resultadosOrdenados.length) {
    return {
      texto:
        "Não encontrei uma regra explícita para essa pergunta. A ausência de regra não significa autorização; confirme no resumo do médico ou em sala antes de agendar.",
      resultados: [],
    };
  }

  const resultados = resultadosOrdenados.map(({ medico, linhas, respostaDireta }) => ({
    medico,
    linhas,
    respostaDireta,
  }));
  const respostasDiretas = resultados.filter((item) => item.respostaDireta).length;
  const perguntaSobreLista = /quais|qual medico|qual profissional|quem atende/.test(consulta);
  const texto =
    respostasDiretas > 0 && !perguntaSobreLista
      ? `Encontrei ${respostasDiretas} resposta(s) direta(s) na lista de exames e regras cadastradas. Confira também as condições abaixo.`
      : medicosEncontrados.length > 0
        ? `Encontrei informações na ficha de ${medicosEncontrados[0].name}, priorizando as regras mais relacionadas à sua pergunta. Confira os detalhes antes de confirmar no Clinux.`
        : base.length === 1
          ? `Busca limitada à ficha de ${base[0].name}. Os trechos abaixo mostram as regras mais relacionadas; se não houver correspondência explícita, confirme com a sala.`
          : perguntaSobreLista
            ? `Encontrei ${resultados.length} médico(s) com regras relacionadas. Os resultados estão ordenados pela relevância; confira as condições completas antes de confirmar.`
            : `Encontrei informações relacionadas nas fichas cadastradas, ordenadas pela relevância. A busca não substitui a confirmação no Clinux.`;
  return { texto, resultados };
}

export type SugestoesAgendamento = {
  exames: string[];
  convenios: string[];
  solicitantes: string[];
};

const INICIOS_DE_REGRA_NAO_SAO_CONVENIO = new Set([
  "agenda",
  "agendamento",
  "quarta",
  "quinta",
  "sexta",
  "segunda",
  "terca",
  "atencao",
  "atraso",
  "aceita",
  "aceitam",
  "ate",
  "cancelamento",
  "cintilografia",
  "contraste",
  "demais",
  "dois",
  "drenagem",
  "exige",
  "idade",
  "intervalo",
  "marcacao",
  "marcar",
  "maximo",
  "minimo",
  "pode",
  "retorno",
  "crm",
  "sala",
  "resultado",
  "verificar",
  "perguntar",
  "se",
  "tres",
  "protocolo",
  "qualquer",
  "gestacao",
  "gemelar",
  "intervalo",
  "geralmente",
  "manter",
  "trigemelar",
  "telefonar",
  "telefone",
  "preferencialmente",
  "obter",
  "libera",
  "entrada",
  "exclusivamente",
  "puncao",
  "parceria",
  "sabado",
  "domingo",
  "manha",
  "tarde",
  "noite",
  "realiza",
  "realizam",
  "atende",
  "atendem",
  "atender",
  "nao",
  "somente",
  "exame",
  "exames",
  "ultrassom",
  "ultrassonografia",
  "us",
  "doppler",
  "morfologico",
  "transvaginal",
  "endovaginal",
  "abdome",
  "tireoide",
  "translucencia",
  "alcoolizacao",
  "biopsia",
  "biopsias",
  "mapa",
  "diu",
  "medicina",
  "nuclear",
  "paciente",
  "pacientes",
  "pedido",
  "covid",
  "puncao",
  "particular",
  "convenio",
  "convenios",
  "plano",
  "planos",
  "cota",
  "limite",
  "regra",
]);

function opcoesUnicas(valores: string[]) {
  const unicas = new Map<string, string>();
  for (const valor of valores) {
    const texto = valor
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.,;:!?]+$/g, "");
    const chave = normalizar(texto);
    if (texto.length >= 2 && texto.length <= 70 && !unicas.has(chave)) unicas.set(chave, texto);
  }
  return [...unicas.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function nomesDeExamesUnicos(valores: string[]) {
  const unicos = new Map<string, string>();
  for (const valor of valores) {
    const nome = valor
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.,;:!?]+$/g, "");
    const chave = normalizar(nome);
    if (nome.length >= 2 && !unicos.has(chave)) unicos.set(chave, nome);
  }
  return [...unicos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function nomesDePagadoresNasRegras(base: readonly MedicoAgendamento[]) {
  const opcoes: string[] = [];
  const regras = base.flatMap((medico) => [
    ...(medico.insuranceRestrictions ?? []),
    ...(medico.generalRules ?? []),
    ...(medico.exams ?? []).flatMap((exame) => exame.conditions ?? []),
    ...(medico.ultrasoundRules ?? []),
    ...(medico.densitometry ?? []),
    ...(medico.interventions ?? []),
    ...(medico.elastography ?? []),
  ]);
  const contextoFinanceiro =
    /conv[eê]nio|plano|operadora|unimed|amil|bradesco|sul.?am[eé]rica|\bSUS\b|pagamento|desconto|cota|pmmg|stelantis|fundac[aã]o ita[uú]|geap|copass|postal|sa[uú]de/i;
  const nomesCapitalizados =
    /(?<![\p{L}\p{N}])\p{Lu}[\p{L}\p{N}'’-]*(?:\s+(?:(?:de|da|do|dos|das|e)\s+)?\p{Lu}[\p{L}\p{N}'’-]*){0,4}/gu;
  const termosDeExame = new Set(
    base.flatMap((medico) =>
      (medico.exams ?? []).flatMap((exame) => normalizar(exame.name).split(" ")),
    ),
  );

  const adicionar = (bruto: string) => {
    for (const parte of bruto.split(/[,;.!?]|\s+e\s+|\s+ou\s+/i)) {
      const nomeBase = parte
        .replace(/\([^)]*\)/g, " ")
        .replace(
          /^(?:exames?|conv[eê]nios?|planos?|operadoras?|pacientes?|parceria com pacientes? do)\s+/i,
          "",
        )
        .replace(/\s+/g, " ")
        .trim();
      const nome = normalizar(nomeBase) === "unimeds" ? "Unimed" : nomeBase;
      const primeiraPalavra = normalizar(nome).split(" ")[0];
      if (
        nome &&
        nome.split(" ").length <= 3 &&
        !/^(?:dr\.?|dra\.?|doutor(?:a)?)\s*$/i.test(nome) &&
        !/^dr\.?\s|^dra\.?\s|^doutor/i.test(nome) &&
        !INICIOS_DE_REGRA_NAO_SAO_CONVENIO.has(primeiraPalavra) &&
        !termosDeExame.has(primeiraPalavra)
      ) {
        opcoes.push(nome);
      }
    }
  };

  for (const medico of base) {
    for (const regra of medico.insuranceRestrictions ?? []) {
      const cabecalho = regra.split(/[:;.!?—–]/, 1)[0]?.trim();
      if (cabecalho) adicionar(cabecalho);
      for (const alias of regra.matchAll(
        /\((?:antiga|atual|atualmente|tamb[eé]m chamada?)\s+([^)]+)\)/gi,
      )) {
        adicionar(alias[1]);
      }
    }
  }

  for (const regra of regras) {
    if (/\bparticulares?\b/i.test(regra)) opcoes.push("Particular");
    if (/\bSUS\b/i.test(regra)) opcoes.push("SUS");
    if (/\bSUS\s+desconto\b/i.test(regra)) opcoes.push("SUS desconto");
    if (/\bCEU\s+colaboradores\b/i.test(regra)) opcoes.push("CEU colaboradores");
    if (/\bPMMG\b/i.test(regra) && contextoFinanceiro.test(regra)) opcoes.push("PMMG");

    const temContextoFinanceiro = contextoFinanceiro.test(regra);
    if (temContextoFinanceiro) {
      for (const nome of regra.matchAll(nomesCapitalizados)) {
        const inicio = nome.index ?? 0;
        const textoAnterior = regra.slice(Math.max(0, inicio - 8), inicio);
        if (/(?:Dr\.?|Dra\.?|Doutor(?:a)?)\s*$/i.test(textoAnterior)) continue;
        adicionar(nome[0]);
      }
      for (const sigla of regra.matchAll(/\b[A-ZÀ-Þ]{2,}\b/g)) {
        if (!/^(US|USG|DIU|TN|MAPA|ECG|CRM|PNE|PCD|ARFI|P1|P2)$/i.test(sigla[0])) {
          opcoes.push(sigla[0]);
        }
      }
    }

    const cabecalho = regra.split(/[:—–]/, 1)[0]?.trim();
    if (temContextoFinanceiro && cabecalho && cabecalho.length <= 70) {
      const cabecalhoLimpo = cabecalho.replace(/^(?:exames?|planos?|conv[eê]nios?)\s+/i, "");
      const primeiraPalavra = normalizar(cabecalhoLimpo).split(" ")[0];
      if (primeiraPalavra && !INICIOS_DE_REGRA_NAO_SAO_CONVENIO.has(primeiraPalavra)) {
        adicionar(cabecalhoLimpo);
      }
    }
  }

  return opcoesUnicas(["Todos", ...opcoes]);
}

function medicosSolicitantesCitados(base: readonly MedicoAgendamento[]) {
  const nomes: string[] = [];
  const regraDeRecusa =
    /\b(?:não|nao)\s+(?:atende|realiza|agenda|aceita|recebe|marca|faz)\b|\brecusa\b/i;
  const referenciasDeSolicitante = [
    /pacientes?\s+(?:do|da|de|dos|das)\s+(.+)/i,
    /solicitantes?\s*(?::|—|–|-|,|\bcomo\b|\bincluindo\b|\bexemplo(?:s)?\b)?\s+(.+)/i,
    /(?:pedidos?|exames?|solicitações?)\s+(?:(?:solicitados?|pedidos?)\s+)?(?:por|do|da|de|dos|das)\s+(.+)/i,
    /a pedido\s+(?:do|da|de|dos|das)\s+(.+)/i,
  ];
  for (const medico of base) {
    const regras = [
      ...(medico.generalRules ?? []),
      ...(medico.notPerformed ?? []),
      ...(medico.conflicts ?? []),
      ...(medico.insuranceRestrictions ?? []),
    ];
    for (const regra of regras) {
      if (!regraDeRecusa.test(regra)) continue;
      const referencias = referenciasDeSolicitante
        .map((padrao) => regra.match(padrao)?.[1])
        .filter((referencia): referencia is string => Boolean(referencia));
      for (const referencia of referencias) {
        for (const trecho of referencia.split(
          /[,;]|\s+(?:e|ou)\s+(?=(?:Dr\.?|Dra\.?|Doutor(?:a)?)\s)|\s+nem\s+(?:do|da|de|dos|das)\s+(?=(?:Dr\.?|Dra\.?|Doutor(?:a)?)\s)/i,
        )) {
          const nome = trecho
            .trim()
            .replace(/^(?:exemplo(?:s)?|por exemplo|como|incluindo)\s*:?\s*/i, "")
            .replace(/\s+(?:e|ou|nem)(?:\s+(?:do|da|de|dos|das))?$/i, "")
            .replace(/[.;:!?]+$/g, "")
            .trim();
          if (
            /^(?:Dr\.?|Dra\.?|Doutor(?:a)?)\s+[\p{Lu}]/u.test(nome) ||
            /^[\p{Lu}][\p{L}'’.-]*(?:\s+(?:(?:de|da|do|dos|das|e)\s+)?[\p{Lu}][\p{L}'’.-]*){1,6}$/u.test(
              nome,
            )
          )
            nomes.push(nome);
        }
      }
    }
  }
  return opcoesUnicas(nomes);
}

export function listarSugestoesAgendamento(
  base: readonly MedicoAgendamento[],
): SugestoesAgendamento {
  return {
    exames: nomesDeExamesUnicos(
      base.flatMap((medico) => (medico.exams ?? []).map((exame) => exame.name)),
    ),
    convenios: nomesDePagadoresNasRegras(base),
    solicitantes: medicosSolicitantesCitados(base),
  };
}
