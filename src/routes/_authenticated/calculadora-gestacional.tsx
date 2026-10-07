import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Calculator, CalendarDays, ExternalLink, HeartPulse, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { brParaIso, hojeIso, isoParaBr, mascaraDataBr, somarDiasIso } from "@/lib/datas";

export const Route = createFileRoute("/_authenticated/calculadora-gestacional")({
  head: () => ({
    meta: [
      { title: "Calculadora gestacional | Clínica CEU" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaCalculadoraGestacional,
});

type SexoFetal = "desconhecido" | "feminino" | "masculino";
type Medida = "bpd" | "hc" | "ac" | "fl";

function numero(valor: string) {
  const resultado = Number(valor.replace(",", "."));
  return Number.isFinite(resultado) ? resultado : null;
}

function dataValida(iso: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && Boolean(brParaIso(isoParaBr(iso)));
}

function diferencaDias(inicio: string, fim: string) {
  const [ia = 0, im = 1, id = 1] = inicio.split("-").map(Number);
  const [fa = 0, fm = 1, fd = 1] = fim.split("-").map(Number);
  return Math.round((Date.UTC(fa, fm - 1, fd) - Date.UTC(ia, im - 1, id)) / 86_400_000);
}

function idadeGestacional(dias: number) {
  const seguros = Math.max(0, dias);
  return { semanas: Math.floor(seguros / 7), dias: seguros % 7 };
}

function formatarIdade(semanas: number, dias: number) {
  return `${semanas} semanas e ${dias} dia${dias === 1 ? "" : "s"}`;
}

function dataInput(valor: string, onChange: (valor: string) => void, id: string) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder="DD-MM-AAAA"
      value={isoParaBr(valor)}
      onChange={(event) => onChange(brParaIso(mascaraDataBr(event.target.value)) ?? "")}
      maxLength={10}
    />
  );
}

function percentilNormal(z: number) {
  const sinal = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return Math.max(0, Math.min(100, Math.round(50 * (1 + sinal * y))));
}

function pLabel(percentil: number) {
  if (percentil < 5) return `P${percentil} · abaixo do P5`;
  if (percentil > 95) return `P${percentil} · acima do P95`;
  return `P${percentil}`;
}

function Resultado({
  rotulo,
  valor,
  destaque = false,
  alerta = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
  alerta?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-muted/60 p-3",
        destaque && "border border-primary/30 bg-primary/10",
        alerta && "border border-amber-300 bg-amber-50 dark:bg-amber-950/30",
      )}
    >
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{valor}</p>
    </div>
  );
}

function CartaoCalculadora({
  titulo,
  descricao,
  icone,
  children,
}: {
  titulo: string;
  descricao: string;
  icone: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card-superficie p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {icone}
        </span>
        <div>
          <h2 className="font-semibold text-foreground">{titulo}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function CampoMedida({
  id,
  label,
  valor,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  valor: string;
  onChange: (valor: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label} (cm)</Label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder={placeholder}
        value={valor}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function CalculadoraCrescimento() {
  const [semanas, setSemanas] = useState("");
  const [dias, setDias] = useState("0");
  const [sexo, setSexo] = useState<SexoFetal>("desconhecido");
  const [medidas, setMedidas] = useState<Record<Medida, string>>({
    bpd: "",
    hc: "",
    ac: "",
    fl: "",
  });
  const resultado = useMemo(() => {
    const gaSemanas = numero(semanas);
    const gaDias = numero(dias);
    const bpd = numero(medidas.bpd);
    const hc = numero(medidas.hc);
    const ac = numero(medidas.ac);
    const fl = numero(medidas.fl);
    if (
      gaSemanas === null ||
      gaDias === null ||
      gaSemanas < 14 ||
      gaSemanas > 44 ||
      !Number.isInteger(gaSemanas) ||
      !Number.isInteger(gaDias) ||
      gaDias < 0 ||
      gaDias > 6 ||
      ac === null ||
      fl === null ||
      ac <= 0 ||
      fl <= 0
    )
      return null;
    // Hadlock 1-4: entradas em centímetros, resultado em gramas.
    let formula = "Hadlock 1 (AC + FL)";
    let logPeso = 1.304 + 0.05281 * ac + 0.1938 * fl - 0.004 * ac * fl;
    if (bpd !== null && hc !== null && bpd > 0 && hc > 0) {
      formula = "Hadlock 4 (BPD + HC + AC + FL)";
      logPeso =
        1.3596 - 0.00386 * ac * fl + 0.0064 * hc + 0.00061 * bpd * ac + 0.0424 * ac + 0.174 * fl;
    } else if (hc !== null && hc > 0) {
      formula = "Hadlock 3 (HC + AC + FL)";
      logPeso = 1.326 - 0.00326 * ac * fl + 0.0107 * hc + 0.0438 * ac + 0.158 * fl;
    } else if (bpd !== null && bpd > 0) {
      formula = "Hadlock 2 (BPD + AC + FL)";
      logPeso = 1.335 - 0.0034 * ac * fl + 0.0316 * bpd + 0.0457 * ac + 0.1623 * fl;
    }
    const peso = 10 ** logPeso;
    const ga = gaSemanas + gaDias / 7;
    // Referência Hadlock para o percentil do peso fetal estimado; sexo desconhecido usa a média das referências.
    const referencias = (["feminino", "masculino"] as SexoFetal[]).filter(
      (item) => sexo === "desconhecido" || item === sexo,
    );
    const percentis = referencias.map((item) => {
      const feminino = item === "feminino";
      const esperado =
        (feminino ? -802.062 : -862.626) +
        (feminino ? -3.15 : -2.861) * ga +
        (feminino ? 2.66 : 2.65) * ga ** 2 +
        (feminino ? -43.429 : 56.695);
      const variancia =
        (feminino ? 225994.844 : 233312.938) +
        2 * (feminino ? -9904.393 : -10190.313) * ga +
        (feminino ? 435.527 : 447.121) * ga ** 2 +
        (feminino ? 8250.502 : 8752.502);
      return percentilNormal((peso - esperado) / Math.sqrt(Math.max(variancia, 1)));
    });
    return {
      peso,
      formula,
      percentil: Math.round(percentis.reduce((soma, item) => soma + item, 0) / percentis.length),
    };
  }, [dias, medidas, semanas, sexo]);

  const limpar = () => {
    setSemanas("");
    setDias("0");
    setSexo("desconhecido");
    setMedidas({ bpd: "", hc: "", ac: "", fl: "" });
  };
  return (
    <CartaoCalculadora
      titulo="Crescimento fetal e percentil"
      descricao="Informe a idade gestacional e as medidas biométricas do ultrassom."
      icone={<Calculator className="size-5" />}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="crescimento-semanas">Idade gestacional (semanas)</Label>
          <Input
            id="crescimento-semanas"
            type="number"
            min={14}
            max={44}
            value={semanas}
            onChange={(e) => setSemanas(e.target.value)}
            placeholder="Ex.: 32"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="crescimento-dias">Dias</Label>
          <Input
            id="crescimento-dias"
            type="number"
            min={0}
            max={6}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sexo-fetal">Sexo fetal (referência)</Label>
          <select
            id="sexo-fetal"
            value={sexo}
            onChange={(e) => setSexo(e.target.value as SexoFetal)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="desconhecido">Não informado</option>
            <option value="feminino">Feminino</option>
            <option value="masculino">Masculino</option>
          </select>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CampoMedida
          id="bpd"
          label="DBP / BPD"
          valor={medidas.bpd}
          onChange={(v) => setMedidas((m) => ({ ...m, bpd: v }))}
          placeholder="Ex.: 8,20"
        />
        <CampoMedida
          id="hc"
          label="CC / HC"
          valor={medidas.hc}
          onChange={(v) => setMedidas((m) => ({ ...m, hc: v }))}
          placeholder="Ex.: 29,50"
        />
        <CampoMedida
          id="ac"
          label="CA / AC"
          valor={medidas.ac}
          onChange={(v) => setMedidas((m) => ({ ...m, ac: v }))}
          placeholder="Ex.: 28,00"
        />
        <CampoMedida
          id="fl"
          label="CF / FL"
          valor={medidas.fl}
          onChange={(v) => setMedidas((m) => ({ ...m, fl: v }))}
          placeholder="Ex.: 6,10"
        />
      </div>
      {resultado ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Resultado
            rotulo="Peso fetal estimado (EFW)"
            valor={`${Math.round(resultado.peso)} g (${(resultado.peso / 1000).toFixed(2)} kg)`}
            destaque
          />
          <Resultado
            rotulo="Percentil fetal estimado"
            valor={pLabel(resultado.percentil)}
            destaque
            alerta={resultado.percentil < 5 || resultado.percentil > 95}
          />
          <Resultado rotulo="Fórmula utilizada" valor={resultado.formula} />
        </div>
      ) : (
        <p className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Preencha idade gestacional, CA/AC e CF/FL. DBP/BPD e CC/HC são opcionais e determinam a
          versão de Hadlock utilizada.
        </p>
      )}
      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={limpar}>
        <RotateCcw className="mr-1.5 size-4" /> Limpar
      </Button>
    </CartaoCalculadora>
  );
}

function CalculadoraDoppler() {
  const [semanas, setSemanas] = useState("");
  const [dias, setDias] = useState("0");
  const [umbilical, setUmbilical] = useState("");
  const [cerebral, setCerebral] = useState("");
  const [uterinaEsquerda, setUterinaEsquerda] = useState("");
  const [uterinaDireita, setUterinaDireita] = useState("");
  const resultado = useMemo(() => {
    const s = numero(semanas);
    const d = numero(dias);
    const ua = numero(umbilical);
    const mca = numero(cerebral);
    const utE = numero(uterinaEsquerda);
    const utD = numero(uterinaDireita);
    if (
      s === null ||
      d === null ||
      s < 11 ||
      s > 44 ||
      !Number.isInteger(s) ||
      !Number.isInteger(d) ||
      d < 0 ||
      d > 6 ||
      ua === null ||
      mca === null ||
      utE === null ||
      utD === null ||
      [ua, mca, utE, utD].some((v) => v <= 0)
    )
      return null;
    const ga = s + d / 7;
    const diasGestacao = s * 7 + d;
    const mediaUterina = (utE + utD) / 2;
    const uaZ = (ua - (3.55219 - 0.13558 * ga + 0.00174 * ga ** 2)) / 0.299;
    const mcaSd = -0.88005 + 0.08182 * ga - 0.00133 * ga ** 2;
    const mcaZ = (mca - (-2.7317 + 0.3335 * ga - 0.0058 * ga ** 2)) / Math.max(mcaSd, 0.01);
    const uterinaZ =
      (Math.log(mediaUterina) - (1.39 - 0.012 * diasGestacao + 1.98e-5 * diasGestacao ** 2)) /
      Math.max(0.272 - 0.000259 * diasGestacao, 0.01);
    const cpr = mca / ua;
    const cprSd = -0.9664 + 0.09027 * ga - 0.0014 * ga ** 2;
    const cprZ = (cpr - (-4.0636 + 0.383 * ga - 0.0059 * ga ** 2)) / Math.max(cprSd, 0.01);
    return {
      ua,
      mca,
      mediaUterina,
      cpr,
      uaP: percentilNormal(uaZ),
      mcaP: percentilNormal(mcaZ),
      uterinaP: percentilNormal(uterinaZ),
      cprP: percentilNormal(cprZ),
    };
  }, [cerebral, dias, semanas, umbilical, uterinaDireita, uterinaEsquerda]);
  const limpar = () => {
    setSemanas("");
    setDias("0");
    setUmbilical("");
    setCerebral("");
    setUterinaEsquerda("");
    setUterinaDireita("");
  };
  return (
    <CartaoCalculadora
      titulo="Doppler obstétrico"
      descricao="Informe os índices de pulsatilidade (PI) do laudo e compare com a referência gestacional."
      icone={<HeartPulse className="size-5" />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="doppler-semanas">Idade gestacional (semanas)</Label>
          <Input
            id="doppler-semanas"
            type="number"
            min={11}
            max={44}
            value={semanas}
            onChange={(e) => setSemanas(e.target.value)}
            placeholder="Ex.: 32"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doppler-dias">Dias</Label>
          <Input
            id="doppler-dias"
            type="number"
            min={0}
            max={6}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
          />
        </div>
        <CampoMedida
          id="doppler-umbilical"
          label="Artéria umbilical · PI"
          valor={umbilical}
          onChange={setUmbilical}
          placeholder="Ex.: 0,90"
        />
        <CampoMedida
          id="doppler-cerebral"
          label="Artéria cerebral média · PI"
          valor={cerebral}
          onChange={setCerebral}
          placeholder="Ex.: 1,50"
        />
        <CampoMedida
          id="doppler-uterina-esquerda"
          label="Artéria uterina esquerda · PI"
          valor={uterinaEsquerda}
          onChange={setUterinaEsquerda}
          placeholder="Ex.: 0,70"
        />
        <CampoMedida
          id="doppler-uterina-direita"
          label="Artéria uterina direita · PI"
          valor={uterinaDireita}
          onChange={setUterinaDireita}
          placeholder="Ex.: 0,70"
        />
      </div>
      {resultado ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Resultado
            rotulo="Umbilical · percentil"
            valor={pLabel(resultado.uaP)}
            alerta={resultado.uaP > 95}
          />
          <Resultado
            rotulo="Cerebral média · percentil"
            valor={pLabel(resultado.mcaP)}
            alerta={resultado.mcaP < 5}
          />
          <Resultado
            rotulo="Média uterina · percentil"
            valor={pLabel(resultado.uterinaP)}
            alerta={resultado.uterinaP > 95}
          />
          <Resultado
            rotulo="CPR (cerebroplacentária)"
            valor={`${resultado.cpr.toFixed(2)} · ${pLabel(resultado.cprP)}`}
            destaque
            alerta={resultado.cprP < 5}
          />
        </div>
      ) : (
        <p className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Preencha a idade gestacional e os quatro índices PI do Doppler para calcular a CPR e os
          percentis.
        </p>
      )}
      {resultado ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Os percentis são estimativas baseadas nas equações de referência utilizadas pela
          calculadora de crescimento fetal. Não geram diagnóstico ou conduta.
        </p>
      ) : null}
      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={limpar}>
        <RotateCcw className="mr-1.5 size-4" /> Limpar
      </Button>
    </CartaoCalculadora>
  );
}

function CalculadoraDatacao() {
  const [dum, setDum] = useState("");
  const [referencia, setReferencia] = useState(hojeIso());
  const resultado = useMemo(() => {
    if (!dataValida(dum) || !dataValida(referencia)) return null;
    const dias = diferencaDias(dum, referencia);
    if (dias < 0 || dias > 320) return null;
    const idade = idadeGestacional(dias);
    return { ...idade, dpp: somarDiasIso(dum, 280), restantes: Math.max(0, 280 - dias) };
  }, [dum, referencia]);
  return (
    <CartaoCalculadora
      titulo="Datação gestacional"
      descricao="Calcule idade gestacional e DPP pela DUM."
      icone={<CalendarDays className="size-5" />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="dum">Data da última menstruação (DUM)</Label>
          {dataInput(dum, setDum, "dum")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="referencia">Data de referência</Label>
          {dataInput(referencia, setReferencia, "referencia")}
        </div>
      </div>
      {resultado ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Resultado
            rotulo="Idade gestacional"
            valor={formatarIdade(resultado.semanas, resultado.dias)}
            destaque
          />
          <Resultado rotulo="DPP estimada" valor={isoParaBr(resultado.dpp)} destaque />
          <Resultado rotulo="Dias estimados até a DPP" valor={`${resultado.restantes} dias`} />
        </div>
      ) : (
        <p className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Informe a DUM e a data de referência para calcular.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => {
          setDum("");
          setReferencia(hojeIso());
        }}
      >
        <RotateCcw className="mr-1.5 size-4" /> Limpar
      </Button>
    </CartaoCalculadora>
  );
}

function PaginaCalculadoraGestacional() {
  const { temModulo, isLoading } = useSessao();
  if (!isLoading && !temModulo("calculadora_gestacional")) {
    return (
      <AppShell titulo="Calculadora">
        <div className="card-superficie max-w-lg p-6 text-sm">
          Você não tem acesso à calculadora gestacional. Solicite a permissão ao administrador do
          sistema.
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell
      titulo="Calculadora"
      descricao="Percentil fetal, Hadlock e Doppler para apoio à rotina das salas"
    >
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          <Calculator className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            Ferramenta de apoio para conferência de medidas e índices do ultrassom. Os resultados
            são estimativas: confirme sempre no laudo e com profissional habilitado antes de
            qualquer interpretação ou conduta.
          </p>
        </div>
        <Tabs defaultValue="crescimento" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="crescimento">Crescimento fetal / Hadlock</TabsTrigger>
            <TabsTrigger value="doppler">Doppler obstétrico</TabsTrigger>
            <TabsTrigger value="datacao">Datação</TabsTrigger>
          </TabsList>
          <TabsContent value="crescimento" className="mt-0">
            <CalculadoraCrescimento />
          </TabsContent>
          <TabsContent value="doppler" className="mt-0">
            <CalculadoraDoppler />
          </TabsContent>
          <TabsContent value="datacao" className="mt-0">
            <CalculadoraDatacao />
          </TabsContent>
        </Tabs>
        <section className="card-superficie p-5">
          <div className="mb-3">
            <h2 className="font-semibold text-foreground">Opções de calculadoras</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Acesse outras calculadoras de medicina fetal em uma nova aba.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <a
              href="https://fetalmedicinebarcelona.org/calc/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Fetal Medicine Barcelona
              <ExternalLink className="size-4 shrink-0" />
            </a>
            <a
              href="https://calc.fetalmedicinebarcelona.org/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Calculadora Fetal BCN
              <ExternalLink className="size-4 shrink-0" />
            </a>
            <a
              href="https://intergrowth21.ndog.ox.ac.uk/pt/ManualEntry/Compute"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              INTERGROWTH-21st
              <ExternalLink className="size-4 shrink-0" />
            </a>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
