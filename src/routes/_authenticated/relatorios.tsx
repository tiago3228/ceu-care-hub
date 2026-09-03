import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { brParaIso, hojeIso, isoParaBr, mascaraDataBr, statusValidade } from "@/lib/datas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios | Clínica CEU" },
      {
        name: "description",
        content:
          "Relatórios gerenciais da Clínica CEU: escalas por médico e sala, atendimentos de enfermagem, consumo de materiais, solicitações e validade de lotes.",
      },
      { property: "og:title", content: "Relatórios | Clínica CEU" },
      { property: "og:description", content: "Indicadores de escala, enfermagem e suprimentos por período." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaRelatorios,
});

function primeiroDiaMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function baixarCsv(nome: string, cabecalho: string[], linhas: (string | number)[][]) {
  const conteudo = [cabecalho, ...linhas]
    .map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${conteudo}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Agrupado {
  rotulo: string;
  total: number;
}

function agrupar(chaves: (string | null | undefined)[]): Agrupado[] {
  const mapa = new Map<string, number>();
  for (const c of chaves) {
    const k = c || "Não informado";
    mapa.set(k, (mapa.get(k) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([rotulo, total]) => ({ rotulo, total }))
    .sort((a, b) => b.total - a.total);
}

function Tabela({
  titulo,
  colunas,
  linhas,
  nomeArquivo,
}: {
  titulo: string;
  colunas: string[];
  linhas: (string | number)[][];
  nomeArquivo: string;
}) {
  return (
    <section className="card-superficie p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
        <Button
          size="sm"
          variant="outline"
          disabled={!linhas.length}
          onClick={() => baixarCsv(nomeArquivo, colunas, linhas)}
        >
          <Download className="mr-1.5 size-4" /> CSV
        </Button>
      </div>
      {linhas.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                {colunas.map((c) => (
                  <th key={c} className="py-2 pr-4 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.slice(0, 100).map((l, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  {l.map((c, j) => (
                    <td key={j} className="py-2 pr-4">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sem dados no período selecionado.</p>
      )}
    </section>
  );
}

function PaginaRelatorios() {
  const { temModulo, isLoading: carregandoSessao } = useSessao();
  const [inicio, setInicio] = useState(isoParaBr(primeiroDiaMes()));
  const [fim, setFim] = useState(isoParaBr(hojeIso()));

  const inicioIso = brParaIso(inicio) ?? primeiroDiaMes();
  const fimIso = brParaIso(fim) ?? hojeIso();

  const dados = useQuery({
    queryKey: ["relatorios", inicioIso, fimIso],
    queryFn: async () => {
      const [escalas, medicos, salas, atendimentos, procedimentos, movimentacoes, itens, solicitacoes, lotes] =
        await Promise.all([
          supabase.from("escalas").select("id, data, medico_id, sala_id, status_compatibilidade").gte("data", inicioIso).lte("data", fimIso),
          supabase.from("medicos").select("id, nome"),
          supabase.from("salas").select("id, nome"),
          supabase
            .from("atendimentos_enfermagem")
            .select("id, data, procedimento, colaboradora_id")
            .gte("data", inicioIso)
            .lte("data", fimIso),
          supabase.from("colaboradoras").select("id, nome"),
          supabase
            .from("movimentacoes_estoque")
            .select("id, data, tipo, quantidade, item_id")
            .gte("data", inicioIso)
            .lte("data", fimIso),
          supabase.from("itens").select("id, nome, unidade"),
          supabase.from("solicitacoes").select("id, data, status, setor").gte("data", inicioIso).lte("data", fimIso),
          supabase.from("lotes").select("id, item_id, lote, validade, quantidade").gt("quantidade", 0),
        ]);
      return {
        escalas: escalas.data ?? [],
        medicos: medicos.data ?? [],
        salas: salas.data ?? [],
        atendimentos: atendimentos.data ?? [],
        colaboradoras: procedimentos.data ?? [],
        movimentacoes: movimentacoes.data ?? [],
        itens: itens.data ?? [],
        solicitacoes: solicitacoes.data ?? [],
        lotes: lotes.data ?? [],
      };
    },
  });

  const d = dados.data;

  const nomeDe = (lista: { id: number; nome: string }[], id: number | null) =>
    lista.find((x) => x.id === id)?.nome ?? "Não informado";

  const escalaPorMedico = useMemo(
    () => (d ? agrupar(d.escalas.map((e) => nomeDe(d.medicos, e.medico_id))) : []),
    [d],
  );
  const escalaPorSala = useMemo(
    () => (d ? agrupar(d.escalas.map((e) => nomeDe(d.salas, e.sala_id))) : []),
    [d],
  );
  const escalaPorStatus = useMemo(
    () => (d ? agrupar(d.escalas.map((e) => e.status_compatibilidade)) : []),
    [d],
  );
  const atendPorProcedimento = useMemo(
    () => (d ? agrupar(d.atendimentos.map((a) => a.procedimento)) : []),
    [d],
  );
  const atendPorColaboradora = useMemo(
    () => (d ? agrupar(d.atendimentos.map((a) => nomeDe(d.colaboradoras, a.colaboradora_id))) : []),
    [d],
  );
  const consumoPorItem = useMemo(() => {
    if (!d) return [] as { nome: string; unidade: string; saida: number; entrada: number }[];
    const mapa = new Map<number, { saida: number; entrada: number }>();
    for (const m of d.movimentacoes) {
      const atual = mapa.get(m.item_id) ?? { saida: 0, entrada: 0 };
      if (m.tipo === "saida" || m.tipo === "descarte") atual.saida += Number(m.quantidade);
      if (m.tipo === "entrada") atual.entrada += Number(m.quantidade);
      mapa.set(m.item_id, atual);
    }
    return [...mapa.entries()]
      .map(([itemId, v]) => {
        const item = d.itens.find((i) => i.id === itemId);
        return { nome: item?.nome ?? `Item ${itemId}`, unidade: item?.unidade ?? "", ...v };
      })
      .sort((a, b) => b.saida - a.saida);
  }, [d]);
  const solicitacoesPorStatus = useMemo(
    () => (d ? agrupar(d.solicitacoes.map((s) => s.status)) : []),
    [d],
  );
  const lotesCriticos = useMemo(() => {
    if (!d) return [] as { item: string; lote: string; validade: string; quantidade: number; situacao: string }[];
    return d.lotes
      .map((l) => ({
        item: d.itens.find((i) => i.id === l.item_id)?.nome ?? `Item ${l.item_id}`,
        lote: l.lote ?? "-",
        validade: isoParaBr(l.validade),
        quantidade: Number(l.quantidade),
        situacao: statusValidade(l.validade, 30),
      }))
      .filter((l) => l.situacao !== "normal")
      .sort((a, b) => a.validade.split("-").reverse().join().localeCompare(b.validade.split("-").reverse().join()));
  }, [d]);

  if (!carregandoSessao && !temModulo("relatorios")) {
    return (
      <AppShell titulo="Relatórios">
        <div className="card-superficie max-w-md p-6 text-sm">Você não tem acesso aos relatórios.</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Relatórios"
      descricao={`Período de ${inicio} a ${fim}`}
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="r-inicio">Início (DD-MM-AAAA)</Label>
          <Input
            id="r-inicio"
            className="w-40"
            value={inicio}
            onChange={(e) => setInicio(mascaraDataBr(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-fim">Fim (DD-MM-AAAA)</Label>
          <Input id="r-fim" className="w-40" value={fim} onChange={(e) => setFim(mascaraDataBr(e.target.value))} />
        </div>
        {d && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{d.escalas.length} escala(s)</Badge>
            <Badge variant="secondary">{d.atendimentos.length} atendimento(s)</Badge>
            <Badge variant="secondary">{d.movimentacoes.length} movimentação(ões)</Badge>
            <Badge variant="secondary">{d.solicitacoes.length} solicitação(ões)</Badge>
          </div>
        )}
      </div>

      {dados.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="escala">
          <TabsList>
            <TabsTrigger value="escala">Escala</TabsTrigger>
            <TabsTrigger value="enfermagem">Enfermagem</TabsTrigger>
            <TabsTrigger value="suprimentos">Suprimentos</TabsTrigger>
          </TabsList>

          <TabsContent value="escala" className="mt-4 grid gap-4 xl:grid-cols-2">
            <Tabela
              titulo="Escalas por médico"
              colunas={["Médico", "Escalas"]}
              linhas={escalaPorMedico.map((l) => [l.rotulo, l.total])}
              nomeArquivo="escalas-por-medico"
            />
            <Tabela
              titulo="Escalas por sala"
              colunas={["Sala", "Escalas"]}
              linhas={escalaPorSala.map((l) => [l.rotulo, l.total])}
              nomeArquivo="escalas-por-sala"
            />
            <Tabela
              titulo="Status de compatibilidade"
              colunas={["Status", "Escalas"]}
              linhas={escalaPorStatus.map((l) => [l.rotulo, l.total])}
              nomeArquivo="escalas-por-status"
            />
          </TabsContent>

          <TabsContent value="enfermagem" className="mt-4 grid gap-4 xl:grid-cols-2">
            <Tabela
              titulo="Atendimentos por procedimento"
              colunas={["Procedimento", "Atendimentos"]}
              linhas={atendPorProcedimento.map((l) => [l.rotulo, l.total])}
              nomeArquivo="atendimentos-por-procedimento"
            />
            <Tabela
              titulo="Atendimentos por colaboradora"
              colunas={["Colaboradora", "Atendimentos"]}
              linhas={atendPorColaboradora.map((l) => [l.rotulo, l.total])}
              nomeArquivo="atendimentos-por-colaboradora"
            />
          </TabsContent>

          <TabsContent value="suprimentos" className="mt-4 grid gap-4 xl:grid-cols-2">
            <Tabela
              titulo="Consumo e entradas por item"
              colunas={["Item", "Unidade", "Saídas", "Entradas"]}
              linhas={consumoPorItem.map((l) => [l.nome, l.unidade, l.saida, l.entrada])}
              nomeArquivo="consumo-por-item"
            />
            <Tabela
              titulo="Solicitações por status"
              colunas={["Status", "Solicitações"]}
              linhas={solicitacoesPorStatus.map((l) => [l.rotulo, l.total])}
              nomeArquivo="solicitacoes-por-status"
            />
            <Tabela
              titulo="Lotes vencidos ou próximos do vencimento (30 dias)"
              colunas={["Item", "Lote", "Validade", "Quantidade", "Situação"]}
              linhas={lotesCriticos.map((l) => [l.item, l.lote, l.validade, l.quantidade, l.situacao])}
              nomeArquivo="lotes-criticos"
            />
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
