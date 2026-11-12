import { useMemo, useState } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReferenciaEFW } from "@/lib/fetal-biometry";
import {
  percentilPesoFmfSemanal,
  percentilPesoHadlock,
  pesoHadlock,
  zDopplerUmbilical,
  zHadlockBiometria,
  zIntergrowthHC,
  zRenal,
  zSkeletal,
} from "@/lib/fetal-biometry";

type Unidades = "mm" | "cm";
type MetodoEFW = "existente" | "biometria";
type Referencia = "auto" | "hadlock" | "fmf";
type ChaveMedida =
  | "bpd"
  | "ofd"
  | "hc"
  | "ac"
  | "fl"
  | "uaPi"
  | "uaRi"
  | "uaSd"
  | "mcaPi"
  | "cpr"
  | "tcd"
  | "ood"
  | "od"
  | "iod"
  | "mandibula"
  | "circTorax"
  | "comprimentoTorax"
  | "clavicula"
  | "escapula"
  | "estomagoLong"
  | "estomagoAp"
  | "estomagoTransversal"
  | "figado"
  | "intestinoDelgado"
  | "colon"
  | "rimDComp"
  | "rimDAP"
  | "rimDTrans"
  | "rimEComp"
  | "rimEAP"
  | "rimETrans"
  | "bexiga"
  | "humero"
  | "radio"
  | "ulna"
  | "tibia"
  | "fibula"
  | "pe";
type ValoresMedidas = Record<ChaveMedida, string>;

type DefCampo = { chave: ChaveMedida; rotulo: string; referencia?: string };

const MEDIDAS_VAZIAS: ValoresMedidas = {
  bpd: "",
  ofd: "",
  hc: "",
  ac: "",
  fl: "",
  uaPi: "",
  uaRi: "",
  uaSd: "",
  mcaPi: "",
  cpr: "",
  tcd: "",
  ood: "",
  od: "",
  iod: "",
  mandibula: "",
  circTorax: "",
  comprimentoTorax: "",
  clavicula: "",
  escapula: "",
  estomagoLong: "",
  estomagoAp: "",
  estomagoTransversal: "",
  figado: "",
  intestinoDelgado: "",
  colon: "",
  rimDComp: "",
  rimDAP: "",
  rimDTrans: "",
  rimEComp: "",
  rimEAP: "",
  rimETrans: "",
  bexiga: "",
  humero: "",
  radio: "",
  ulna: "",
  tibia: "",
  fibula: "",
  pe: "",
};

const CHAVES_LINEARES: ChaveMedida[] = [
  "bpd",
  "ofd",
  "hc",
  "ac",
  "fl",
  "tcd",
  "ood",
  "od",
  "iod",
  "mandibula",
  "circTorax",
  "comprimentoTorax",
  "clavicula",
  "escapula",
  "estomagoLong",
  "estomagoAp",
  "estomagoTransversal",
  "figado",
  "intestinoDelgado",
  "colon",
  "rimDComp",
  "rimDAP",
  "rimDTrans",
  "rimEComp",
  "rimEAP",
  "rimETrans",
  "bexiga",
  "humero",
  "radio",
  "ulna",
  "tibia",
  "fibula",
  "pe",
];

const PAINEIS: Array<{ valor: string; rotulo: string }> = [
  { valor: "core", rotulo: "EFW / Biometria" },
  { valor: "doppler", rotulo: "Doppler / FGR" },
  { valor: "cabeca", rotulo: "Cabeça" },
  { valor: "torax", rotulo: "Tórax" },
  { valor: "gi", rotulo: "GI / Fígado" },
  { valor: "renal", rotulo: "Renal / Urinário" },
  { valor: "esqueletico", rotulo: "Esquelético" },
];

const CAMPOS: Record<string, DefCampo[]> = {
  core: [
    { chave: "bpd", rotulo: "DBP / BPD", referencia: "Hadlock 1984" },
    { chave: "ofd", rotulo: "OFD" },
    { chave: "hc", rotulo: "CC / HC", referencia: "Hadlock 1984" },
    { chave: "ac", rotulo: "CA / AC", referencia: "Hadlock 1984" },
    { chave: "fl", rotulo: "CF / FL", referencia: "Hadlock 1984" },
  ],
  doppler: [
    { chave: "uaPi", rotulo: "Artéria umbilical · PI", referencia: "INTERGROWTH-21st" },
    { chave: "uaRi", rotulo: "Artéria umbilical · RI" },
    { chave: "uaSd", rotulo: "Artéria umbilical · S/D", referencia: "INTERGROWTH-21st" },
    { chave: "mcaPi", rotulo: "Artéria cerebral média · PI", referencia: "Baschat" },
    { chave: "cpr", rotulo: "CPR manual (opcional)", referencia: "Baschat" },
  ],
  cabeca: [
    { chave: "tcd", rotulo: "Diâmetro transverso do cerebelo · TCD", referencia: "Pinar" },
    { chave: "ood", rotulo: "Distância orbitária externa · OOD", referencia: "Merz" },
    { chave: "od", rotulo: "Diâmetro orbitário · OD", referencia: "Merz" },
    { chave: "iod", rotulo: "Distância orbitária interna · IOD", referencia: "Merz" },
    { chave: "mandibula", rotulo: "Comprimento da mandíbula", referencia: "Otto" },
  ],
  torax: [
    { chave: "circTorax", rotulo: "Circunferência torácica", referencia: "Chitkara" },
    { chave: "comprimentoTorax", rotulo: "Comprimento torácico", referencia: "Chitkara" },
    { chave: "clavicula", rotulo: "Clavícula", referencia: "Yarkoni" },
    { chave: "escapula", rotulo: "Escápula" },
  ],
  gi: [
    { chave: "estomagoLong", rotulo: "Estômago · longitudinal", referencia: "Goldstein" },
    { chave: "estomagoAp", rotulo: "Estômago · AP", referencia: "Goldstein / Kepkep" },
    { chave: "estomagoTransversal", rotulo: "Estômago · transversal", referencia: "Goldstein" },
    { chave: "figado", rotulo: "Comprimento do fígado", referencia: "Tongprasert" },
    { chave: "intestinoDelgado", rotulo: "Lúmen do intestino delgado", referencia: "Lap" },
    { chave: "colon", rotulo: "Lúmen do cólon", referencia: "Lap" },
  ],
  renal: [
    { chave: "rimDComp", rotulo: "Rim direito · comprimento", referencia: "Chitty 2003" },
    { chave: "rimDAP", rotulo: "Rim direito · diâmetro AP", referencia: "Chitty 2003" },
    { chave: "rimDTrans", rotulo: "Rim direito · transversal", referencia: "Chitty 2003" },
    { chave: "rimEComp", rotulo: "Rim esquerdo · comprimento", referencia: "Chitty 2003" },
    { chave: "rimEAP", rotulo: "Rim esquerdo · diâmetro AP", referencia: "Chitty 2003" },
    { chave: "rimETrans", rotulo: "Rim esquerdo · transversal", referencia: "Chitty 2003" },
    { chave: "bexiga", rotulo: "Bexiga · diâmetro longitudinal", referencia: "Fontanella 2021" },
  ],
  esqueletico: [
    { chave: "humero", rotulo: "Úmero", referencia: "Chitty" },
    { chave: "radio", rotulo: "Rádio", referencia: "Chitty" },
    { chave: "ulna", rotulo: "Ulna", referencia: "Chitty" },
    { chave: "tibia", rotulo: "Tíbia", referencia: "Chitty" },
    { chave: "fibula", rotulo: "Fíbula", referencia: "Chitty" },
    { chave: "pe", rotulo: "Pé", referencia: "Chitty" },
  ],
};

const NOME_MEDIDA: Record<string, string> = {
  bpd: "BPD",
  hc: "HC",
  ac: "AC",
  fl: "FL",
  uaPi: "PI umbilical",
  uaSd: "S/D umbilical",
  rimDComp: "Rim D comprimento",
  rimDAP: "Rim D AP",
  rimDTrans: "Rim D transversal",
  rimEComp: "Rim E comprimento",
  rimEAP: "Rim E AP",
  rimETrans: "Rim E transversal",
  humero: "Úmero",
  radio: "Rádio",
  ulna: "Ulna",
  tibia: "Tíbia",
  fibula: "Fíbula",
  pe: "Pé",
};

function lerNumero(valor: string) {
  const numero = Number(valor.replace(",", "."));
  return Number.isFinite(numero) && valor.trim() !== "" ? numero : null;
}

function idadeValida(semanas: string, dias: string) {
  const s = Number(semanas);
  const d = Number(dias);
  return Number.isInteger(s) && Number.isInteger(d) && s >= 10 && s <= 44 && d >= 0 && d <= 6;
}

function rotuloPercentil(valor: number | null) {
  return valor === null ? "—" : `P${valor.toFixed(1)}`;
}

function CartaoResultado({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${destaque ? "border-primary/30 bg-primary/10" : "border-border bg-muted/40"}`}
    >
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{valor}</p>
    </div>
  );
}

function CampoLinear({
  campo,
  unidade,
  valor,
  onChange,
}: {
  campo: DefCampo;
  unidade: Unidades;
  valor: string;
  onChange: (valor: string) => void;
}) {
  const id = `fetal-biometry-${campo.chave}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex flex-wrap items-center justify-between gap-2">
        <span>{campo.rotulo}</span>
        {campo.referencia && (
          <span className="text-[10px] font-normal text-muted-foreground">{campo.referencia}</span>
        )}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          placeholder={unidade === "mm" ? "mm" : "cm"}
          value={valor}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {unidade}
        </span>
      </div>
    </div>
  );
}

function ResultadoZ({ rotulo, z, percentil }: { rotulo: string; z: number; percentil: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
      <span>{rotulo}</span>
      <span className="font-medium tabular-nums">
        z {z.toFixed(2)} · {rotuloPercentil(percentil)}
      </span>
    </div>
  );
}

export function FetalBiometryCalculator() {
  const [semanas, setSemanas] = useState("32");
  const [dias, setDias] = useState("0");
  const [unidade, setUnidade] = useState<Unidades>("mm");
  const [medidas, setMedidas] = useState<ValoresMedidas>(MEDIDAS_VAZIAS);
  const [efwExistente, setEfwExistente] = useState("");
  const [metodoEFW, setMetodoEFW] = useState<MetodoEFW>("existente");
  const [referenciaEFW, setReferenciaEFW] = useState<Referencia>("auto");
  const [fluxoDiastolico, setFluxoDiastolico] = useState("nao-avaliado");
  const [achadoUrinario, setAchadoUrinario] = useState("nenhum");

  const idade = idadeValida(semanas, dias);
  const ga = idade ? Number(semanas) + Number(dias) / 7 : null;
  const diasGestacionais = idade ? Number(semanas) * 7 + Number(dias) : null;
  const medidasMm = useMemo(() => {
    const resultado = {} as Partial<Record<ChaveMedida, number>>;
    for (const [chave, valor] of Object.entries(medidas)) {
      const lido = lerNumero(valor);
      if (lido !== null && lido > 0) {
        const chaveMedida = chave as ChaveMedida;
        resultado[chaveMedida] =
          unidade === "cm" && CHAVES_LINEARES.includes(chaveMedida) ? lido * 10 : lido;
      }
    }
    return resultado;
  }, [medidas, unidade]);

  const calculos = useMemo(() => {
    if (ga === null || diasGestacionais === null) return null;
    const pesoCalculado = pesoHadlock(medidasMm);
    const pesoManual = lerNumero(efwExistente);
    const peso = metodoEFW === "existente" ? pesoManual : (pesoCalculado?.peso ?? null);
    const referenciaAtiva: ReferenciaEFW =
      referenciaEFW === "auto" ? (ga > 40 ? "fmf" : "hadlock") : referenciaEFW;
    const resultadoEFW =
      peso === null
        ? null
        : referenciaAtiva === "hadlock"
          ? percentilPesoHadlock(peso, diasGestacionais)
          : percentilPesoFmfSemanal(peso, diasGestacionais);
    const percentilAC =
      medidasMm.ac !== undefined ? zHadlockBiometria("ac", medidasMm.ac, ga).percentil : null;
    const percentisCore = (["bpd", "hc", "ac", "fl"] as const).flatMap((tipo) => {
      const valor = medidasMm[tipo];
      return valor === undefined ? [] : [{ tipo, ...zHadlockBiometria(tipo, valor, ga) }];
    });
    const percentilEFW = resultadoEFW?.percentil ?? null;
    const fgr =
      percentilEFW !== null && percentilEFW < 3
        ? "EFW abaixo do P3 · critério de FGR grave por EFW"
        : (percentilEFW !== null && percentilEFW < 10) || (percentilAC !== null && percentilAC < 10)
          ? "EFW ou AC abaixo do P10 · atende critério biométrico de FGR"
          : percentilEFW !== null || percentilAC !== null
            ? "Percentis disponíveis ≥ P10 · não atende ao critério isolado por tamanho"
            : "Dados insuficientes para classificar";
    const hcIntergrowth = medidasMm.hc ? zIntergrowthHC(medidasMm.hc, ga) : null;
    const uaPi = medidasMm.uaPi ? zDopplerUmbilical("pi", medidasMm.uaPi, ga) : null;
    const uaSd = medidasMm.uaSd ? zDopplerUmbilical("sd", medidasMm.uaSd, ga) : null;
    const renais = (
      [
        ["rimDComp", "comprimento"],
        ["rimDAP", "ap"],
        ["rimDTrans", "transversal"],
        ["rimEComp", "comprimento"],
        ["rimEAP", "ap"],
        ["rimETrans", "transversal"],
      ] as const
    ).flatMap(([chave, tipo]) => {
      const valor = medidasMm[chave];
      const resultado = valor ? zRenal(tipo, valor, ga) : null;
      return resultado ? [{ chave, ...resultado }] : [];
    });
    const ossos = (
      [
        ["fl", "fl"],
        ["humero", "humerus"],
        ["radio", "radius"],
        ["ulna", "ulna"],
        ["tibia", "tibia"],
        ["fibula", "fibula"],
        ["pe", "foot"],
      ] as const
    ).flatMap(([chave, tipo]) => {
      const valor = medidasMm[chave];
      const resultado = valor ? zSkeletal(tipo, valor, ga) : null;
      return resultado ? [{ chave, ...resultado }] : [];
    });
    const bpd = medidasMm.bpd;
    const ofd = medidasMm.ofd;
    const ci = bpd && ofd ? (bpd / ofd) * 100 : null;
    return {
      peso,
      pesoCalculado,
      referenciaAtiva,
      resultadoEFW,
      percentilAC,
      percentisCore,
      fgr,
      hcIntergrowth,
      uaPi,
      uaSd,
      renais,
      ossos,
      ci,
    };
  }, [diasGestacionais, efwExistente, ga, medidasMm, metodoEFW, referenciaEFW]);

  function atualizarMedida(chave: ChaveMedida, valor: string) {
    setMedidas((anterior) => ({ ...anterior, [chave]: valor }));
  }

  function trocarUnidade(nova: Unidades) {
    if (nova === unidade) return;
    const fator = unidade === "mm" ? 0.1 : 10;
    setMedidas((anterior) => {
      const convertidas = { ...anterior };
      for (const chave of CHAVES_LINEARES) {
        const valor = lerNumero(convertidas[chave]);
        if (valor !== null) convertidas[chave] = String(Number((valor * fator).toFixed(3)));
      }
      return convertidas;
    });
    setUnidade(nova);
  }

  function limpar() {
    setSemanas("32");
    setDias("0");
    setUnidade("mm");
    setMedidas(MEDIDAS_VAZIAS);
    setEfwExistente("");
    setMetodoEFW("existente");
    setReferenciaEFW("auto");
    setFluxoDiastolico("nao-avaliado");
    setAchadoUrinario("nenhum");
  }

  function camposLinear(campos: DefCampo[]) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campos.map((campo) => (
          <CampoLinear
            key={campo.chave}
            campo={campo}
            unidade={unidade}
            valor={medidas[campo.chave]}
            onChange={(valor) => atualizarMedida(campo.chave, valor)}
          />
        ))}
      </div>
    );
  }

  const referenciaTexto = calculos?.referenciaAtiva === "hadlock" ? "Hadlock 1991" : "FMF 2018";
  const percentilAtual = calculos?.resultadoEFW?.percentil ?? null;

  return (
    <section className="card-superficie space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">
            Biometria fetal · Fetal Biometry 5.0 v4 BETA
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Referência de 11/09/2026 · biometria, EFW, Doppler e medidas fetais detalhadas
          </p>
        </div>
        <a
          href="https://perinatology.com/calculators/Fetal%20Biometry%205.0.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-input px-3 text-xs font-medium text-foreground hover:bg-muted"
        >
          Fonte Perinatology <ExternalLink className="size-3.5" />
        </a>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Study details</h3>
          <Button type="button" variant="outline" size="sm" onClick={limpar}>
            <RotateCcw className="mr-1.5 size-4" /> Limpar entradas
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="biometry-weeks">Idade gestacional (semanas)</Label>
            <Input
              id="biometry-weeks"
              type="number"
              min={10}
              max={44}
              value={semanas}
              onChange={(event) => setSemanas(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biometry-days">Dias</Label>
            <Input
              id="biometry-days"
              type="number"
              min={0}
              max={6}
              value={dias}
              onChange={(event) => setDias(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biometry-units">Unidades de medida</Label>
            <select
              id="biometry-units"
              value={unidade}
              onChange={(event) => trocarUnidade(event.target.value as Unidades)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="mm">mm</option>
              <option value="cm">cm</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              Trocar a unidade converte as medidas já digitadas.
            </p>
          </div>
        </div>
        {!idade && (
          <p className="mt-3 text-xs font-medium text-destructive">
            Informe semanas inteiras de 10 a 44 e dias de 0 a 6.
          </p>
        )}
        <a
          href="https://www.perinatology.com/ultrasound/Biometry%20Thresholds.html"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
        >
          Limites de biometria <ExternalLink className="size-3" />
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoResultado
          rotulo="Peso fetal estimado · EFW"
          valor={calculos?.peso ? `${Math.round(calculos.peso).toLocaleString("pt-BR")} g` : "—"}
          destaque
        />
        <CartaoResultado
          rotulo={`Percentil EFW · ${referenciaTexto}`}
          valor={rotuloPercentil(percentilAtual)}
          destaque
        />
        <CartaoResultado
          rotulo="Percentil AC · Hadlock 1984"
          valor={rotuloPercentil(calculos?.percentilAC ?? null)}
        />
        <CartaoResultado
          rotulo="Avaliação de crescimento"
          valor={calculos?.fgr ?? "Dados insuficientes"}
        />
      </div>
      {calculos?.peso && calculos.resultadoEFW === null && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          O EFW em gramas está disponível, mas não há âncora publicada nesta implementação para a
          idade gestacional e a referência selecionada. Nenhum percentil foi extrapolado.
        </p>
      )}

      <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="efw-method">Peso fetal estimado</Label>
          <select
            id="efw-method"
            value={metodoEFW}
            onChange={(event) => setMetodoEFW(event.target.value as MetodoEFW)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="existente">Usar EFW já informado (padrão)</option>
            <option value="biometria">Calcular a partir da biometria</option>
          </select>
        </div>
        {metodoEFW === "existente" ? (
          <div className="space-y-1.5">
            <Label htmlFor="efw-existing">EFW existente (g)</Label>
            <Input
              id="efw-existing"
              inputMode="decimal"
              placeholder="Peso do laudo em gramas"
              value={efwExistente}
              onChange={(event) => setEfwExistente(event.target.value)}
            />
          </div>
        ) : (
          <p className="self-end text-xs text-muted-foreground lg:col-span-2">
            Informe AC e FL; BPD e HC são opcionais. A fórmula Hadlock é selecionada conforme as
            medidas disponíveis.
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="efw-reference">Referência do percentil EFW</Label>
          <select
            id="efw-reference"
            value={referenciaEFW}
            onChange={(event) => setReferenciaEFW(event.target.value as Referencia)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="auto">Automática (Hadlock → FMF após 40+0)</option>
            <option value="hadlock">Hadlock 1991 · 10+0–40+0</option>
            <option value="fmf">FMF 2018 · âncoras disponíveis</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Referência dos percentis HC / AC</Label>
          <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
            Hadlock (padrão)
          </div>
          <p className="text-[11px] text-muted-foreground">Independente da referência de EFW.</p>
        </div>
      </div>
      <p className="-mt-2 text-[11px] text-muted-foreground">
        Referências distintas podem alterar o percentil sem mudança de crescimento. Para comparações
        seriadas, mantenha a mesma referência.
      </p>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Measurements</h3>
          <p className="text-xs text-muted-foreground">
            EFW · Doppler / FGR · Head · Thorax · GI · Renal · Skeletal
          </p>
        </div>
        <Tabs defaultValue="core" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            {PAINEIS.map((painel) => (
              <TabsTrigger key={painel.valor} value={painel.valor}>
                {painel.rotulo}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="core" className="mt-0 space-y-4">
            <p className="text-xs text-muted-foreground">
              HC/CC e AC/CA usam Hadlock por padrão. O cálculo do EFW é independente da referência
              de percentil selecionada.
            </p>
            {camposLinear(CAMPOS.core)}
            {calculos && calculos.percentisCore.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">Percentis da biometria · Hadlock 1984</h4>
                {calculos.percentisCore.map((item) => (
                  <ResultadoZ
                    key={item.tipo}
                    rotulo={NOME_MEDIDA[item.tipo] ?? item.tipo.toUpperCase()}
                    z={item.z}
                    percentil={item.percentil}
                  />
                ))}
              </div>
            )}
            {calculos?.ci !== null && calculos?.ci !== undefined && (
              <CartaoResultado
                rotulo="Índice cefálico · BPD / OFD × 100"
                valor={`${calculos.ci.toFixed(1)}%`}
              />
            )}
            {metodoEFW === "biometria" && calculos?.pesoCalculado && (
              <p className="text-[11px] text-muted-foreground">
                Fórmula de peso: {calculos.pesoCalculado.formula}.
              </p>
            )}
          </TabsContent>

          <TabsContent value="doppler" className="mt-0 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CAMPOS.doppler.map((campo) => (
                <div key={campo.chave} className="space-y-1.5">
                  <Label htmlFor={`fetal-biometry-${campo.chave}`}>
                    {campo.rotulo}
                    {campo.referencia ? ` · ${campo.referencia}` : ""}
                  </Label>
                  <Input
                    id={`fetal-biometry-${campo.chave}`}
                    inputMode="decimal"
                    placeholder="Ex.: 1,20"
                    value={medidas[campo.chave]}
                    onChange={(event) => atualizarMedida(campo.chave, event.target.value)}
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="end-diastolic-flow">Fluxo diastólico</Label>
                <select
                  id="end-diastolic-flow"
                  value={fluxoDiastolico}
                  onChange={(event) => setFluxoDiastolico(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="nao-avaliado">Não avaliado / não informado</option>
                  <option value="forward">Fluxo anterógrado presente</option>
                  <option value="aedf">Ausente · AEDF</option>
                  <option value="redf">Reverso · REDF</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              {calculos?.uaPi && (
                <ResultadoZ
                  rotulo="Artéria umbilical · PI"
                  z={calculos.uaPi.z}
                  percentil={calculos.uaPi.percentil}
                />
              )}
              {calculos?.uaSd && (
                <ResultadoZ
                  rotulo="Artéria umbilical · S/D"
                  z={calculos.uaSd.z}
                  percentil={calculos.uaSd.percentil}
                />
              )}
              {medidas.cpr && (
                <p className="rounded-md bg-muted/50 p-3 text-sm">
                  CPR manual informado: {medidas.cpr}. O percentil não é calculado nesta
                  implementação.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                PI e S/D umbilicais usam equações LMS INTERGROWTH-21st. MCA PI, RI e CPR são
                mostrados como valores informados, sem centil local validado.
              </p>
              {fluxoDiastolico !== "nao-avaliado" && (
                <p className="rounded-md bg-muted/50 p-3 text-sm">
                  Fluxo diastólico registrado:{" "}
                  {fluxoDiastolico === "forward"
                    ? "anterógrado presente"
                    : fluxoDiastolico === "aedf"
                      ? "ausente (AEDF)"
                      : "reverso (REDF)"}
                  . O registro não gera recomendação de conduta.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="cabeca" className="mt-0 space-y-4">
            <p className="text-xs text-muted-foreground">
              HC é compartilhada com a biometria central. Não duplique a medida.
            </p>
            {camposLinear(CAMPOS.cabeca)}
            {calculos?.hcIntergrowth && (
              <ResultadoZ
                rotulo="HC · INTERGROWTH-21st"
                z={calculos.hcIntergrowth.z}
                percentil={calculos.hcIntergrowth.percentil}
              />
            )}
          </TabsContent>

          <TabsContent value="torax" className="mt-0 space-y-4">
            {camposLinear(CAMPOS.torax)}
            <p className="text-xs text-muted-foreground">
              As medidas são registradas com as referências indicadas; os nomogramas tabulares
              específicos do tórax não estão incluídos nesta versão.
            </p>
          </TabsContent>

          <TabsContent value="gi" className="mt-0 space-y-4">
            {camposLinear(CAMPOS.gi)}
            <p className="text-xs text-muted-foreground">
              Os resultados dimensionais de estômago, fígado e alças dependem de nomogramas
              próprios, não incluídos nesta versão.
            </p>
          </TabsContent>

          <TabsContent value="renal" className="mt-0 space-y-4">
            {camposLinear(CAMPOS.renal)}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="urinary-findings">Achados urinários associados</Label>
                <select
                  id="urinary-findings"
                  value={achadoUrinario}
                  onChange={(event) => setAchadoUrinario(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="nenhum">Nenhum especificado</option>
                  <option value="calices">Dilatação calicial</option>
                  <option value="parenquima">Alteração parenquimatosa</option>
                  <option value="ureter">Dilatação ureteral</option>
                  <option value="bexiga">Alteração vesical</option>
                  <option value="multiplos">Múltiplos achados associados</option>
                </select>
              </div>
              <p className="self-end text-xs text-muted-foreground">
                Comprimento e diâmetros renais usam as equações de Chitty 2003 citadas pela
                referência.
              </p>
            </div>
            {calculos && calculos.renais.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">Z-scores renais · Chitty 2003</h4>
                {calculos.renais.map((item) => (
                  <ResultadoZ
                    key={item.chave}
                    rotulo={NOME_MEDIDA[item.chave] ?? item.chave}
                    z={item.z}
                    percentil={item.percentil}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="esqueletico" className="mt-0 space-y-4">
            <p className="text-xs text-muted-foreground">
              O comprimento do fêmur (FL) é compartilhado com a biometria central.
            </p>
            {camposLinear(CAMPOS.esqueletico)}
            {calculos && calculos.ossos.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">
                  Z-scores esqueléticos · equações da referência
                </h4>
                {calculos.ossos.map((item) => (
                  <ResultadoZ
                    key={item.chave}
                    rotulo={NOME_MEDIDA[item.chave] ?? item.chave}
                    z={item.z}
                    percentil={item.percentil}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 dark:bg-amber-950/25 dark:text-amber-100">
        <p className="font-semibold">
          Apoio à decisão clínica; não é diagnóstico nem recomendação de conduta.
        </p>
        <p>
          Hadlock 1991 usa âncoras publicadas de P3/P10/P50/P90/P97 para 10+0–40+0. FMF 2018 usa
          nesta versão os pontos EFW semanais publicados na Tabela 1 (20+3–41+3), interpolados entre
          semanas; não é a tabela diária S3 completa. Fora da faixa disponível, nenhum percentil FMF
          é extrapolado.
        </p>
        <p>
          A linha de 30 semanas na digitalização de Hadlock 1991 mostra P97 (1.649 g) abaixo do P90
          (1.824 g). Para evitar percentis fora de ordem, esta implementação usa 1.953 g para P97
          nessa semana; confirme esse ponto na fonte antes de uso clínico.
        </p>
        <p>
          Os percentis Hadlock de biometria usam as médias e desvios-padrão de Hadlock 1984. Os
          valores de RI, MCA PI, CPR e medidas tabulares dos painéis Head, Thorax e GI são
          informativos, mas não recebem percentis locais nesta versão. Confirme medidas, método,
          fonte de referência e interpretação em contexto clínico.
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
          <a
            className="underline underline-offset-2"
            href="https://perinatology.com/calculators/Fetal%20Biometry%205.0.html"
            target="_blank"
            rel="noreferrer"
          >
            Perinatology · Fetal Biometry 5.0
          </a>
          <a
            className="underline underline-offset-2"
            href="https://obgyn.utoronto.ca/sites/default/files/Hadlock%20Radiology%201984.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Hadlock 1984
          </a>
          <a
            className="underline underline-offset-2"
            href="https://obgyn.utoronto.ca/sites/default/files/Hadlock%20Growth%20Chart-Radiology-1991.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Hadlock 1991
          </a>
          <a
            className="underline underline-offset-2"
            href="https://doi.org/10.1002/uog.19073"
            target="_blank"
            rel="noreferrer"
          >
            FMF 2018
          </a>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Os valores digitados permanecem apenas no estado desta página e não são enviados ao site de
        referência.
      </p>
    </section>
  );
}
