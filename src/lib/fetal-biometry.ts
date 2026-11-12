export type ReferenciaEFW = "hadlock" | "fmf";

export type PercentilEFW = {
  percentil: number;
  referencia: ReferenciaEFW;
  faixasDias: [number, number];
};

const Z_ANCHORS = [-1.880793608, -1.281551566, 0, 1.281551566, 1.880793608];

// Hadlock et al., Radiology 1991, Table 1: P3, P10, P50, P90, P97 (g).
// The printed P97 value for week 30 is non-monotone (1,649 g); 1,953 g is
// used as the monotone continuation of the published curve and neighboring anchors.
const HADLOCK_1991: Array<[number, number, number, number, number]> = [
  [26, 29, 35, 41, 44],
  [34, 37, 45, 53, 56],
  [43, 48, 58, 68, 73],
  [55, 61, 73, 85, 91],
  [70, 77, 93, 109, 116],
  [88, 97, 117, 137, 146],
  [110, 121, 146, 171, 183],
  [136, 150, 181, 212, 226],
  [167, 185, 223, 261, 279],
  [205, 227, 273, 319, 341],
  [248, 275, 331, 387, 414],
  [299, 331, 399, 467, 499],
  [359, 398, 478, 559, 598],
  [426, 471, 568, 665, 710],
  [503, 556, 670, 784, 838],
  [589, 652, 785, 918, 981],
  [685, 758, 913, 1068, 1141],
  [791, 876, 1055, 1234, 1319],
  [908, 1004, 1210, 1416, 1513],
  [1034, 1145, 1379, 1613, 1724],
  [1169, 1294, 1559, 1824, 1953],
  [1313, 1453, 1751, 2049, 2189],
  [1465, 1621, 1953, 2285, 2441],
  [1622, 1794, 2162, 2530, 2703],
  [1783, 1973, 2377, 2781, 2971],
  [1946, 2154, 2595, 3036, 3244],
  [2110, 2335, 2813, 3291, 3516],
  [2271, 2513, 3028, 3543, 3785],
  [2427, 2686, 3236, 3786, 4045],
  [2576, 2851, 3435, 4019, 4294],
  [2714, 3004, 3619, 4234, 4524],
];

// Nicolaides et al., UOG 2018, Table 1 EFW-only weekly anchors.
// The published Table S3 daily file was not available in the source session;
// these weekly anchors are interpolated only within their stated 20+3–41+3 range.
const FMF_2018_WEEKLY: Array<[number, number, number, number, number]> = [
  [300, 314, 346, 381, 399],
  [358, 375, 413, 455, 477],
  [424, 444, 491, 542, 567],
  [501, 525, 580, 641, 671],
  [588, 616, 682, 754, 791],
  [686, 719, 797, 883, 926],
  [796, 835, 926, 1027, 1078],
  [918, 964, 1070, 1188, 1248],
  [1052, 1105, 1228, 1365, 1435],
  [1197, 1258, 1400, 1558, 1638],
  [1353, 1423, 1586, 1767, 1858],
  [1518, 1598, 1782, 1988, 2092],
  [1691, 1780, 1988, 2221, 2338],
  [1868, 1968, 2201, 2461, 2593],
  [2048, 2159, 2416, 2705, 2851],
  [2226, 2347, 2631, 2948, 3110],
  [2398, 2531, 2839, 3186, 3362],
  [2561, 2704, 3037, 3412, 3602],
  [2709, 2862, 3219, 3620, 3824],
  [2839, 3001, 3379, 3804, 4021],
  [2945, 3115, 3512, 3959, 4187],
  [3025, 3201, 3613, 4078, 4315],
];

export function percentilNormal(z: number) {
  // Abramowitz & Stegun 7.1.26 approximation to Phi(z), returned continuously.
  const sinal = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return Math.max(0, Math.min(100, 50 * (1 + sinal * erf)));
}

function interpolar(a: number, b: number, proporcao: number) {
  return a + (b - a) * proporcao;
}

function ancorasNaIdade(
  diasGestacionais: number,
  dados: Array<[number, number, number, number, number]>,
  primeiroDia: number,
  ultimoDia: number,
  deslocamentoSemanal: number,
) {
  if (diasGestacionais < primeiroDia || diasGestacionais > ultimoDia) return null;
  const posicao = (diasGestacionais - primeiroDia) / 7;
  const indice = Math.min(Math.floor(posicao), dados.length - 1);
  const proximo = Math.min(indice + 1, dados.length - 1);
  const fracao = Math.max(0, Math.min(1, posicao - indice));
  const linhaA = dados[indice];
  const linhaB = dados[proximo];
  const idadeA = primeiroDia + indice * 7;
  const idadeB = Math.min(primeiroDia + proximo * 7, ultimoDia);
  if (deslocamentoSemanal !== 0 && diasGestacionais > idadeB && indice < dados.length - 1)
    return null;
  return {
    valores: linhaA.map((valor, i) => interpolar(valor, linhaB[i], fracao)),
    faixa: [idadeA, idadeB] as [number, number],
  };
}

function percentileFromAnchors(pesoGramas: number, ancoras: number[]) {
  if (!Number.isFinite(pesoGramas) || pesoGramas <= 0) return null;
  const logPeso = Math.log(pesoGramas);
  let indice = 0;
  if (logPeso <= Math.log(ancoras[0])) indice = 0;
  else if (logPeso >= Math.log(ancoras[ancoras.length - 1])) indice = ancoras.length - 2;
  else {
    for (let i = 0; i < ancoras.length - 1; i += 1) {
      if (pesoGramas <= ancoras[i + 1]) {
        indice = i;
        break;
      }
    }
  }
  const a = ancoras[indice];
  const b = ancoras[indice + 1];
  if (!a || !b || a <= 0 || b <= a) return null;
  const proporcao = (logPeso - Math.log(a)) / (Math.log(b) - Math.log(a));
  const z = interpolar(Z_ANCHORS[indice], Z_ANCHORS[indice + 1], proporcao);
  return percentilNormal(z);
}

export function percentilPesoHadlock(
  pesoGramas: number,
  diasGestacionais: number,
): PercentilEFW | null {
  const semanal = ancorasNaIdade(diasGestacionais, HADLOCK_1991, 70, 280, 0);
  if (!semanal) return null;
  const percentil = percentileFromAnchors(pesoGramas, semanal.valores);
  return percentil === null
    ? null
    : { percentil, referencia: "hadlock", faixasDias: semanal.faixa };
}

export function percentilPesoFmfSemanal(
  pesoGramas: number,
  diasGestacionais: number,
): PercentilEFW | null {
  // Table 1 reports weekly values at 20+3, 21+3, ... 41+3.
  const semanal = ancorasNaIdade(diasGestacionais, FMF_2018_WEEKLY, 143, 290, 0);
  if (!semanal) return null;
  const percentil = percentileFromAnchors(pesoGramas, semanal.valores);
  return percentil === null ? null : { percentil, referencia: "fmf", faixasDias: semanal.faixa };
}

export function zHadlockBiometria(tipo: "bpd" | "hc" | "ac" | "fl", medidaMm: number, ga: number) {
  const equacoes = {
    bpd: { media: -3.08 + 0.41 * ga - 0.000061 * ga ** 3, sd: 0.3 },
    hc: { media: -11.48 + 1.56 * ga - 0.0002548 * ga ** 3, sd: 1 },
    ac: { media: -13.3 + 1.61 * ga - 0.00998 * ga ** 2, sd: 1.34 },
    fl: { media: -3.91 + 0.427 * ga - 0.0034 * ga ** 2, sd: 0.3 },
  } as const;
  const { media, sd } = equacoes[tipo];
  const z = (medidaMm / 10 - media) / sd;
  return { z, percentil: percentilNormal(z) };
}

export function pesoHadlock(medidasMm: Partial<Record<"bpd" | "hc" | "ac" | "fl", number>>) {
  const bpd = medidasMm.bpd !== undefined ? medidasMm.bpd / 10 : null;
  const hc = medidasMm.hc !== undefined ? medidasMm.hc / 10 : null;
  const ac = medidasMm.ac !== undefined ? medidasMm.ac / 10 : null;
  const fl = medidasMm.fl !== undefined ? medidasMm.fl / 10 : null;
  if (ac === null || fl === null || ac <= 0 || fl <= 0) return null;

  if (bpd !== null && hc !== null && bpd > 0 && hc > 0) {
    const logPeso =
      1.3596 - 0.00386 * ac * fl + 0.0064 * hc + 0.00061 * bpd * ac + 0.0424 * ac + 0.174 * fl;
    return { peso: 10 ** logPeso, formula: "Hadlock 4 · BPD + HC + AC + FL" };
  }
  if (hc !== null && hc > 0) {
    const logPeso = 1.326 - 0.00326 * ac * fl + 0.0107 * hc + 0.0438 * ac + 0.158 * fl;
    return { peso: 10 ** logPeso, formula: "Hadlock · HC + AC + FL" };
  }
  if (bpd !== null && bpd > 0) {
    const logPeso = 1.335 - 0.0034 * ac * fl + 0.0316 * bpd + 0.0457 * ac + 0.1623 * fl;
    return { peso: 10 ** logPeso, formula: "Hadlock · BPD + AC + FL" };
  }
  const logPeso = 1.304 + 0.05281 * ac + 0.1938 * fl - 0.004 * ac * fl;
  return { peso: 10 ** logPeso, formula: "Hadlock · AC + FL" };
}

export function zDopplerUmbilical(tipo: "pi" | "sd", valor: number, ga: number) {
  const lnGa = Math.log(ga);
  if (tipo === "pi") {
    const l = -0.0768617;
    const m = 1.02944 + 77.7456 * ga ** -2 - 0.000004455 * ga ** 3;
    const s = -0.00645693 + 254.885 * lnGa * ga ** -2 - 715.949 * ga ** -2;
    if (s <= 0) return null;
    const z = (Math.pow(valor / m, l) - 1) / (l * s);
    return { z, percentil: percentilNormal(z) };
  }
  const l = -0.2752483;
  const m = 2.60358 + 445.991 * ga ** -2 - 0.0000108754 * ga ** 3;
  const s = -0.503202 + 1268.37 * lnGa * ga ** -2 - 3417.37 * ga ** -2;
  if (s <= 0) return null;
  const z = (Math.pow(valor / m, l) - 1) / (l * s);
  return { z, percentil: percentilNormal(z) };
}

export function zIntergrowthHC(hcMm: number, ga: number) {
  const lnGa = Math.log(ga);
  const ga2 = ga ** 2;
  const ga3 = ga ** 3;
  const mediana = -28.2849 + 1.69267 * ga2 - 0.397485 * ga2 * lnGa;
  const sd = 1.98735 + 0.0136772 * ga3 - 0.00726264 * ga3 * lnGa + 0.000976253 * ga3 * lnGa ** 2;
  if (sd <= 0) return null;
  const z = (hcMm - mediana) / sd;
  return { z, percentil: percentilNormal(z) };
}

export function zRenal(tipo: "comprimento" | "ap" | "transversal", valorMm: number, ga: number) {
  const base = ga / 10;
  const lnBase = Math.log(base);
  const raiz = Math.sqrt(base);
  let media: number;
  let sd: number;
  if (tipo === "comprimento") {
    media = 5.4141 * lnBase - 5.0562 * raiz + 6.3939;
    sd = 0.1165;
  } else if (tipo === "ap") {
    media = 5.0861 * lnBase - 4.8576 * raiz + 5.9114;
    sd = -0.0018793 * ga + 0.21053;
  } else {
    media = 4.532 * lnBase - 4.0868 * raiz + 5.1504;
    sd = -0.0019741 * ga + 0.21256;
  }
  if (valorMm <= 0 || sd <= 0) return null;
  const z = (Math.log(valorMm) - media) / sd;
  return { z, percentil: percentilNormal(z) };
}

export function zSkeletal(
  tipo: "fl" | "humerus" | "radius" | "ulna" | "tibia" | "fibula" | "foot",
  valorMm: number,
  ga: number,
) {
  const lnGa = Math.log(ga);
  let media: number;
  let sd: number;
  switch (tipo) {
    case "fl":
      media = 3.4162 * ga - 0.0004791 * ga ** 3 - 32.425;
      sd = 0.058328 * ga + 1.0605;
      break;
    case "humerus":
      media = 11.459 * ga - 2.2362 * ga * lnGa - 63.704;
      sd = 0.040292 * ga + 1.3464;
      break;
    case "radius":
      media = 7983 / ga ** 2 - 1698.6 / ga + 91.634;
      sd = 0.046386 * ga + 1.1933;
      break;
    case "ulna":
      media = 11120 / ga ** 2 - 2146.3 / ga + 108.94;
      sd = 0.049218 * ga + 1.2021;
      break;
    case "tibia":
      media = 14451 / ga ** 2 - 2553.2 / ga + 120.05;
      sd = 0.049978 * ga + 1.1102;
      break;
    case "fibula":
      media = 13697 / ga ** 2 - 2458 / ga + 116.51;
      sd = 0.053841 * ga + 1.0451;
      break;
    case "foot":
      media = 0.36909 * ga ** 2 - 0.084175 * ga ** 2 * lnGa - 14.158;
      sd = 0.10865 * ga + 0.27971;
      break;
  }
  if (valorMm <= 0 || sd <= 0) return null;
  const z = (valorMm - media) / sd;
  return { z, percentil: percentilNormal(z) };
}
