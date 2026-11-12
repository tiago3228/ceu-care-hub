import { useMemo, useState } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  calcularUtpiGomez,
  referenciaUtpiGomez,
  UTPI_GOMEZ_MAX_DAYS,
  UTPI_GOMEZ_MIN_DAYS,
} from "@/lib/uterine-artery";
import { cn } from "@/lib/utils";

function numero(valor: string) {
  if (!valor.trim()) return null;
  const resultado = Number(valor.replace(",", "."));
  return Number.isFinite(resultado) ? resultado : null;
}

function CartaoResultado({
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

function GraficoUtpi({ diasGestacionais, ipMedio }: { diasGestacionais: number; ipMedio: number }) {
  const largura = 640;
  const altura = 280;
  const margem = { topo: 16, direita: 16, baixo: 42, esquerda: 48 };
  const larguraGrafico = largura - margem.esquerda - margem.direita;
  const alturaGrafico = altura - margem.topo - margem.baixo;
  const maxY = Math.max(3, ipMedio * 1.08);
  const amostras = Array.from({ length: 73 }, (_, indice) => {
    const dias = UTPI_GOMEZ_MIN_DAYS + ((UTPI_GOMEZ_MAX_DAYS - UTPI_GOMEZ_MIN_DAYS) * indice) / 72;
    const referencia = referenciaUtpiGomez(dias);
    return referencia ? { dias, ...referencia } : null;
  }).filter((ponto): ponto is NonNullable<typeof ponto> => ponto !== null);
  const x = (dias: number) =>
    margem.esquerda +
    ((dias - UTPI_GOMEZ_MIN_DAYS) / (UTPI_GOMEZ_MAX_DAYS - UTPI_GOMEZ_MIN_DAYS)) * larguraGrafico;
  const y = (valor: number) => margem.topo + ((maxY - valor) / maxY) * alturaGrafico;
  const linha = (chave: "mediana" | "p5" | "p95") =>
    amostras
      .map((ponto, indice) => `${indice === 0 ? "M" : "L"}${x(ponto.dias)},${y(ponto[chave])}`)
      .join(" ");
  const area = [
    ...amostras.map(
      (ponto, indice) => `${indice === 0 ? "M" : "L"}${x(ponto.dias)},${y(ponto.p95)}`,
    ),
    ...amostras
      .slice()
      .reverse()
      .map((ponto) => `L${x(ponto.dias)},${y(ponto.p5)}`),
    "Z",
  ].join(" ");
  const marcasX = [77, 112, 147, 182, 217, 252, 287];
  const marcasY = [0, 0.25, 0.5, 0.75, 1].map((fracao) => maxY * fracao);
  const rotuloX = (dias: number) => `${Math.floor(dias / 7)}`;

  return (
    <div className="mt-5 rounded-lg border border-border/70 bg-background p-3 sm:p-4">
      <h3 className="mb-2 text-sm font-medium">IP médio por idade gestacional · Gómez 2008</h3>
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        className="h-auto w-full"
        role="img"
        aria-label="Gráfico de referência do IP médio uterino com mediana, percentis 5 e 95 e o valor informado"
      >
        {marcasY.map((marca) => (
          <g key={marca}>
            <line
              x1={margem.esquerda}
              x2={largura - margem.direita}
              y1={y(marca)}
              y2={y(marca)}
              className="stroke-border"
              strokeWidth="1"
            />
            <text
              x={margem.esquerda - 8}
              y={y(marca) + 4}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize="11"
            >
              {marca.toFixed(1)}
            </text>
          </g>
        ))}
        {marcasX.map((marca) => (
          <g key={marca}>
            <line
              x1={x(marca)}
              x2={x(marca)}
              y1={margem.topo + alturaGrafico}
              y2={margem.topo + alturaGrafico + 5}
              className="stroke-border"
            />
            <text
              x={x(marca)}
              y={altura - 17}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize="11"
            >
              {rotuloX(marca)}
            </text>
          </g>
        ))}
        <path d={area} className="fill-primary/10" />
        <path
          d={linha("p5")}
          fill="none"
          className="stroke-muted-foreground"
          strokeDasharray="5 4"
        />
        <path
          d={linha("p95")}
          fill="none"
          className="stroke-muted-foreground"
          strokeDasharray="5 4"
        />
        <path d={linha("mediana")} fill="none" className="stroke-primary" strokeWidth="2.5" />
        <line
          x1={margem.esquerda}
          x2={largura - margem.direita}
          y1={margem.topo + alturaGrafico}
          y2={margem.topo + alturaGrafico}
          className="stroke-foreground/60"
        />
        <circle
          cx={x(diasGestacionais)}
          cy={y(ipMedio)}
          r="5"
          className="fill-destructive stroke-background"
          strokeWidth="2"
        />
        <text
          x={margem.esquerda + larguraGrafico / 2}
          y={altura - 2}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="11"
        >
          Idade gestacional (semanas)
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-primary" /> Mediana
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-muted-foreground" /> P5 e P95
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-destructive" /> Valor informado
        </span>
      </div>
    </div>
  );
}

export function UterineArteryCalculator() {
  const [semanas, setSemanas] = useState("");
  const [dias, setDias] = useState("0");
  const [ipMedio, setIpMedio] = useState("");

  const s = numero(semanas);
  const d = numero(dias);
  const ip = numero(ipMedio);
  const idadeValida =
    s !== null && d !== null && Number.isInteger(s) && Number.isInteger(d) && d >= 0 && d <= 6;
  const diasGestacionais = idadeValida ? s * 7 + d : null;
  const foraDaFaixa =
    diasGestacionais !== null &&
    (diasGestacionais < UTPI_GOMEZ_MIN_DAYS || diasGestacionais > UTPI_GOMEZ_MAX_DAYS);

  const resultado = useMemo(() => {
    if (diasGestacionais === null || ip === null) return null;
    return calcularUtpiGomez(ip, diasGestacionais);
  }, [diasGestacionais, ip]);

  const limpar = () => {
    setSemanas("");
    setDias("0");
    setIpMedio("");
  };

  return (
    <section className="card-superficie p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
            <path
              d="M4 18h16M6 15l3-4 3 2 5-7 2 2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div>
          <h2 className="font-semibold text-foreground">IP médio das artérias uterinas</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Compare o índice médio com a curva gestacional de Gómez (2008).
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="utpi-semanas">Idade gestacional (semanas) *</Label>
          <Input
            id="utpi-semanas"
            type="number"
            min={11}
            max={41}
            step={1}
            value={semanas}
            onChange={(event) => setSemanas(event.target.value)}
            placeholder="Ex.: 32"
            aria-required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="utpi-dias">Dias *</Label>
          <Input
            id="utpi-dias"
            type="number"
            min={0}
            max={6}
            step={1}
            value={dias}
            onChange={(event) => setDias(event.target.value)}
            aria-required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="utpi-medio">IP médio da artéria uterina *</Label>
          <Input
            id="utpi-medio"
            type="text"
            inputMode="decimal"
            value={ipMedio}
            onChange={(event) => setIpMedio(event.target.value)}
            placeholder="Ex.: 1,20"
            aria-required
          />
        </div>
      </div>

      {resultado ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <CartaoResultado rotulo="Mediana de referência" valor={resultado.mediana.toFixed(2)} />
            <CartaoResultado rotulo="P95 de referência" valor={resultado.p95.toFixed(2)} />
            <CartaoResultado rotulo="Z-score" valor={resultado.zScore.toFixed(2)} />
            <CartaoResultado
              rotulo="Percentil estimado"
              valor={`P${resultado.percentil.toFixed(1)}`}
              destaque
            />
            <CartaoResultado
              rotulo="Comparação com P95"
              valor={resultado.acimaDoP95 ? "Acima do P95" : "Até o P95"}
              destaque={resultado.acimaDoP95}
              alerta={resultado.acimaDoP95}
            />
          </div>
          <GraficoUtpi diasGestacionais={diasGestacionais!} ipMedio={ip!} />
        </>
      ) : foraDaFaixa ? (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          A curva Gómez usada por esta calculadora está disponível entre 11+0 e 41+6 semanas.
        </p>
      ) : (
        <p className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
          {idadeValida && (s! < 11 || s! > 41 || ip !== null)
            ? "Informe uma idade gestacional entre 11+0 e 41+6 semanas e um IP médio positivo."
            : "Preencha a idade gestacional e o IP médio para calcular o percentil e o Z-score."}
        </p>
      )}

      <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <p>
          Informe o IP médio bilateral (média aritmética dos valores direito e esquerdo). A curva
          usa a referência de Gómez et al. (2008), válida de 11+0 a 41+6 semanas; o marcador
          destacado corresponde a acima do P95.
        </p>
        <p className="mt-2">
          Este resultado isolado não calcula risco individual de pré-eclâmpsia nem define conduta. A
          ferramenta é educacional; referências e pontos de corte podem diferir do modelo oficial
          FMF.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <a
            href="https://doi.org/10.1002/uog.5315"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
          >
            Gómez et al. (2008) <ExternalLink className="size-3" />
          </a>
          <a
            href="https://courses.fetalmedicine.com/calculator/uterine?locale=en"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
          >
            Calculadora oficial FMF <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={limpar}>
        <RotateCcw className="mr-1.5 size-4" /> Limpar
      </Button>
    </section>
  );
}
