import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Grid2X2,
  List,
  Power,
  Search,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { brParaIso, isoParaBr, mascaraDataBr, statusValidade } from "@/lib/datas";
import {
  ajustarLote,
  darEntrada,
  darSaidaFefo,
  diasAlertaValidade,
  planejarFefo,
  type Item,
  type Lote,
} from "@/lib/estoque";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque e lotes | Clínica CEU" },
      {
        name: "description",
        content:
          "Controle de estoque da Clínica CEU por lote e validade, com baixa automática FEFO, alertas de vencimento e histórico de movimentações.",
      },
      { property: "og:title", content: "Estoque e lotes | Clínica CEU" },
      {
        property: "og:description",
        content: "Saldos por lote, validade, entradas, saídas FEFO e movimentações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaEstoque,
});

interface Movimentacao {
  id: number;
  item_id: number;
  lote_id: number | null;
  tipo: string;
  quantidade: number;
  data: string;
  hora: string | null;
  observacoes: string | null;
  usuario_nome: string | null;
}

function PaginaEstoque() {
  const { sessao, temModulo, somenteLeitura, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [soAlertas, setSoAlertas] = useState(false);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [visualizacao, setVisualizacao] = useState<"grade" | "lista">("lista");
  const [entrada, setEntrada] = useState<{
    itemId: number;
    lote: string;
    validade: string;
    quantidade: string;
    localizacao: string;
    obs: string;
  } | null>(null);
  const [saida, setSaida] = useState<{ itemId: number; quantidade: string; obs: string } | null>(
    null,
  );
  const [ajuste, setAjuste] = useState<{
    lote: Lote;
    quantidade: string;
    tipo: "ajuste" | "descarte";
    obs: string;
  } | null>(null);

  const ctx = { userId: sessao?.userId ?? null, usuarioNome: sessao?.nome ?? null };

  const dias = useQuery({ queryKey: ["dias-alerta"], queryFn: diasAlertaValidade });

  const dados = useQuery({
    queryKey: ["estoque"],
    queryFn: async () => {
      const [itens, lotes] = await Promise.all([
        supabase.from("itens").select("*").order("nome"),
        supabase.from("lotes").select("*"),
      ]);
      if (itens.error) throw itens.error;
      if (lotes.error) throw lotes.error;
      return { itens: (itens.data ?? []) as Item[], lotes: (lotes.data ?? []) as Lote[] };
    },
  });

  const movimentacoes = useQuery({
    queryKey: ["movimentacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes_estoque")
        .select("id, item_id, lote_id, tipo, quantidade, data, hora, observacoes, usuario_nome")
        .order("id", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Movimentacao[];
    },
  });

  const diasAlerta = dias.data ?? 30;

  const linhas = useMemo(() => {
    const itens = dados.data?.itens ?? [];
    const lotes = dados.data?.lotes ?? [];
    const termo = busca.trim().toLowerCase();
    return itens
      .filter((i) => mostrarInativos || i.ativo)
      .map((item) => {
        const meus = lotes.filter((l) => l.item_id === item.id);
        const saldo = meus.reduce((s, l) => s + Number(l.quantidade), 0);
        const vencidos = meus.filter(
          (l) => Number(l.quantidade) > 0 && statusValidade(l.validade, diasAlerta) === "vencido",
        );
        const alerta = meus.filter(
          (l) => Number(l.quantidade) > 0 && statusValidade(l.validade, diasAlerta) === "alerta",
        );
        return {
          item,
          lotes: meus.sort((a, b) => ((a.validade ?? "9999") < (b.validade ?? "9999") ? -1 : 1)),
          saldo,
          vencidos,
          alerta,
        };
      })
      .filter(
        (l) =>
          !termo ||
          l.item.nome.toLowerCase().includes(termo) ||
          (l.item.codigo ?? "").toLowerCase().includes(termo),
      )
      .filter((l) =>
        soAlertas ? l.vencidos.length > 0 || l.alerta.length > 0 || l.saldo <= 0 : true,
      );
  }, [dados.data, busca, soAlertas, mostrarInativos, diasAlerta]);

  const alertasValidade = useMemo(() => {
    const itens = dados.data?.itens ?? [];
    return (dados.data?.lotes ?? [])
      .filter((lote) => Number(lote.quantidade) > 0)
      .map((lote) => ({
        lote,
        item: itens.find((item) => item.id === lote.item_id),
        status: statusValidade(lote.validade, diasAlerta),
      }))
      .filter((alerta) => alerta.item?.ativo && alerta.status !== "normal")
      .sort((a, b) => (a.lote.validade ?? "9999").localeCompare(b.lote.validade ?? "9999"));
  }, [dados.data, diasAlerta]);

  const nomeItem = (id: number) => dados.data?.itens.find((i) => i.id === id)?.nome ?? `Item ${id}`;

  const mutEntrada = useMutation({
    mutationFn: async (f: NonNullable<typeof entrada>) => {
      const item = dados.data?.itens.find((i) => i.id === f.itemId);
      const validade = f.validade ? brParaIso(f.validade) : null;
      if (f.validade && !validade) throw new Error("Data de validade inválida (use DD-MM-AAAA).");
      if (item?.controla_validade && !validade)
        throw new Error("Este item controla validade: informe a data.");
      await darEntrada({
        itemId: f.itemId,
        lote: f.lote,
        validade,
        quantidade: Number(f.quantidade.replace(",", ".")),
        localizacao: f.localizacao,
        ctx: { ...ctx, observacoes: f.obs || null },
      });
    },
    onSuccess: () => {
      toast.success("Entrada registrada.");
      setEntrada(null);
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutSaida = useMutation({
    mutationFn: async (f: NonNullable<typeof saida>) => {
      const alocacoes = await darSaidaFefo({
        itemId: f.itemId,
        quantidade: Number(f.quantidade.replace(",", ".")),
        ctx: { ...ctx, observacoes: f.obs || null },
      });
      return alocacoes;
    },
    onSuccess: (alocacoes) => {
      toast.success(`Saída FEFO em ${alocacoes.length} lote(s).`);
      setSaida(null);
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutAjuste = useMutation({
    mutationFn: async (f: NonNullable<typeof ajuste>) =>
      ajustarLote({
        lote: f.lote,
        novaQuantidade: Number(f.quantidade.replace(",", ".")),
        tipo: f.tipo,
        ctx: { ...ctx, observacoes: f.obs || null },
      }),
    onSuccess: () => {
      toast.success("Lote atualizado.");
      setAjuste(null);
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const alternarAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
      const { error } = await supabase.from("itens").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { ativo }) => {
      toast.success(ativo ? "Item ativado." : "Item desativado.");
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      queryClient.invalidateQueries({ queryKey: ["itens"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const excluirItem = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item excluído.");
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      queryClient.invalidateQueries({ queryKey: ["itens"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const previaSaida = useMemo(() => {
    if (!saida) return null;
    const q = Number(saida.quantidade.replace(",", "."));
    if (!q || q <= 0) return null;
    const lotes = (dados.data?.lotes ?? []).filter((l) => l.item_id === saida.itemId);
    return planejarFefo(lotes, q);
  }, [saida, dados.data]);

  if (!carregandoSessao && !temModulo("estoque")) {
    return (
      <AppShell titulo="Estoque e lotes">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso ao módulo de estoque.
        </div>
      </AppShell>
    );
  }

  const totalAlertas = linhas.filter((l) => l.vencidos.length || l.alerta.length).length;

  return (
    <AppShell
      titulo="Estoque e lotes"
      descricao={`${linhas.length} item(ns) • alerta de validade em ${diasAlerta} dias`}
    >
      {alertasValidade.length > 0 && (
        <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <TriangleAlert className="size-4" /> Alertas de validade
              </h2>
              <p className="mt-1 text-xs">
                {alertasValidade.filter((alerta) => alerta.status === "vencido").length} lote(s) já
                vencido(s) e {alertasValidade.filter((alerta) => alerta.status === "alerta").length}{" "}
                com vencimento nos próximos {diasAlerta} dias.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSoAlertas(true)}>
              Ver somente alertas
            </Button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {alertasValidade.map(({ lote, item, status }) => (
              <div
                key={lote.id}
                className={`rounded-md border bg-white px-3 py-2 text-xs ${
                  status === "vencido"
                    ? "border-red-300 text-red-800"
                    : "border-amber-300 text-amber-800"
                }`}
              >
                <strong>{item?.nome}</strong> · lote {lote.lote || "—"} · validade{" "}
                {isoParaBr(lote.validade)}
                <span className="ml-1 font-semibold">
                  {status === "vencido" ? "(VENCIDO)" : "(vence em breve)"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      <Tabs defaultValue="saldos">
        <TabsList className="mb-4">
          <TabsTrigger value="saldos">Saldos por lote</TabsTrigger>
          <TabsTrigger value="mov">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="saldos">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar item"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={soAlertas} onCheckedChange={setSoAlertas} />
              Só alertas ({totalAlertas})
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={mostrarInativos} onCheckedChange={setMostrarInativos} />
              Mostrar inativos
            </label>
            <div
              className="ml-auto flex rounded-md border border-input bg-background p-1"
              aria-label="Modo de visualização"
            >
              <Button
                type="button"
                size="sm"
                variant={visualizacao === "lista" ? "secondary" : "ghost"}
                aria-pressed={visualizacao === "lista"}
                onClick={() => setVisualizacao("lista")}
                title="Visualizar em lista"
              >
                <List className="size-4" /> <span className="sr-only">Lista</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={visualizacao === "grade" ? "secondary" : "ghost"}
                aria-pressed={visualizacao === "grade"}
                onClick={() => setVisualizacao("grade")}
                title="Visualizar em grade"
              >
                <Grid2X2 className="size-4" /> <span className="sr-only">Grade</span>
              </Button>
            </div>
          </div>

          {dados.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div
              className={
                visualizacao === "grade" ? "grid gap-3 lg:grid-cols-2 2xl:grid-cols-3" : "space-y-3"
              }
            >
              {linhas.map(({ item, lotes, saldo, vencidos, alerta }) => (
                <article key={item.id} className="card-superficie p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-foreground">{item.nome}</h2>
                      <p className="text-xs text-muted-foreground">
                        {[item.codigo, item.tipo, item.unidade].filter(Boolean).join(" • ")}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={saldo > 0 ? "secondary" : "destructive"}
                          className="text-[11px]"
                        >
                          Saldo: {saldo}
                        </Badge>
                        {vencidos.length > 0 && (
                          <Badge variant="destructive" className="text-[10px]">
                            <TriangleAlert className="mr-1 size-3" /> {vencidos.length} lote(s)
                            vencido(s)
                          </Badge>
                        )}
                        {alerta.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {alerta.length} vencendo
                          </Badge>
                        )}
                        {!item.ativo && (
                          <Badge variant="destructive" className="text-[10px]">
                            Inativo
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!somenteLeitura && (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={item.ativo ? `Desativar ${item.nome}` : `Ativar ${item.nome}`}
                          title={item.ativo ? "Desativar item" : "Ativar item"}
                          onClick={() => alternarAtivo.mutate({ id: item.id, ativo: !item.ativo })}
                        >
                          <Power
                            className={`size-4 ${item.ativo ? "text-emerald-600" : "text-muted-foreground"}`}
                          />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Excluir ${item.nome}`}
                          title="Excluir item"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Excluir o item "${item.nome}" e seus lotes e movimentações?`,
                              )
                            ) {
                              excluirItem.mutate(item.id);
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEntrada({
                              itemId: item.id,
                              lote: "",
                              validade: "",
                              quantidade: "",
                              localizacao: "",
                              obs: "",
                            })
                          }
                        >
                          <ArrowDownToLine className="mr-1.5 size-4" /> Entrada
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSaida({ itemId: item.id, quantidade: "", obs: "" })}
                        >
                          <ArrowUpFromLine className="mr-1.5 size-4" /> Saída
                        </Button>
                      </div>
                    )}
                  </div>

                  {lotes.length > 0 && (
                    <ul className="mt-3 divide-y divide-border border-t border-border text-xs">
                      {lotes.map((l) => {
                        const st = statusValidade(l.validade, diasAlerta);
                        return (
                          <li
                            key={l.id}
                            className="flex flex-wrap items-center justify-between gap-2 py-2"
                          >
                            <span className="text-muted-foreground">
                              Lote{" "}
                              <span className="font-medium text-foreground">{l.lote || "—"}</span>
                              {" • "}validade{" "}
                              <span
                                className={
                                  st === "vencido"
                                    ? "font-medium text-destructive"
                                    : st === "alerta"
                                      ? "font-medium text-amber-600"
                                      : "text-foreground"
                                }
                              >
                                {isoParaBr(l.validade) || "sem validade"}
                              </span>
                              {l.localizacao ? ` • ${l.localizacao}` : ""}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="font-medium">{Number(l.quantidade)}</span>
                              {!somenteLeitura && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={`Ajustar lote ${l.lote ?? l.id}`}
                                  onClick={() =>
                                    setAjuste({
                                      lote: l,
                                      quantidade: String(Number(l.quantidade)),
                                      tipo: st === "vencido" ? "descarte" : "ajuste",
                                      obs: "",
                                    })
                                  }
                                >
                                  <SlidersHorizontal className="size-4" />
                                </Button>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              ))}
              {!linhas.length && (
                <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mov">
          {movimentacoes.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="card-superficie divide-y divide-border">
              {(movimentacoes.data ?? []).map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
                >
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">{nomeItem(m.item_id)}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      • {isoParaBr(m.data)} {m.hora ?? ""} • {m.usuario_nome ?? "sistema"}
                    </span>
                    {m.observacoes && (
                      <span className="block text-muted-foreground">{m.observacoes}</span>
                    )}
                  </span>
                  <Badge
                    variant={
                      m.tipo === "entrada"
                        ? "secondary"
                        : m.tipo === "saida"
                          ? "outline"
                          : "destructive"
                    }
                    className="text-[10px]"
                  >
                    {m.tipo} {Number(m.quantidade)}
                  </Badge>
                </div>
              ))}
              {!(movimentacoes.data ?? []).length && (
                <p className="p-4 text-sm text-muted-foreground">Sem movimentações registradas.</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!entrada} onOpenChange={(v) => !v && setEntrada(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Entrada de estoque</DialogTitle>
            <DialogDescription>{entrada && nomeItem(entrada.itemId)}</DialogDescription>
          </DialogHeader>
          {entrada && (
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-lote">Lote</Label>
                <Input
                  id="e-lote"
                  value={entrada.lote}
                  onChange={(e) => setEntrada({ ...entrada, lote: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-val">Validade (DD-MM-AAAA)</Label>
                <Input
                  id="e-val"
                  value={entrada.validade}
                  onChange={(e) =>
                    setEntrada({ ...entrada, validade: mascaraDataBr(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-qtd">Quantidade</Label>
                <Input
                  id="e-qtd"
                  inputMode="decimal"
                  value={entrada.quantidade}
                  onChange={(e) => setEntrada({ ...entrada, quantidade: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-loc">Localização</Label>
                <Input
                  id="e-loc"
                  value={entrada.localizacao}
                  onChange={(e) => setEntrada({ ...entrada, localizacao: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-obs">Observações</Label>
                <Textarea
                  id="e-obs"
                  rows={2}
                  value={entrada.obs}
                  onChange={(e) => setEntrada({ ...entrada, obs: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEntrada(null)}>
              Cancelar
            </Button>
            <Button
              disabled={mutEntrada.isPending}
              onClick={() => entrada && mutEntrada.mutate(entrada)}
            >
              Registrar entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!saida} onOpenChange={(v) => !v && setSaida(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Saída de estoque (FEFO)</DialogTitle>
            <DialogDescription>
              {saida && nomeItem(saida.itemId)} — o consumo começa pelo lote com validade mais
              próxima; lotes vencidos ficam de fora.
            </DialogDescription>
          </DialogHeader>
          {saida && (
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-qtd">Quantidade</Label>
                <Input
                  id="s-qtd"
                  inputMode="decimal"
                  value={saida.quantidade}
                  onChange={(e) => setSaida({ ...saida, quantidade: e.target.value })}
                />
              </div>
              {previaSaida && (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                  <p className="mb-1 font-medium">Prévia da baixa</p>
                  {previaSaida.alocacoes.map((a) => (
                    <p key={a.loteId} className="text-muted-foreground">
                      Lote {a.lote || "—"} ({isoParaBr(a.validade) || "sem validade"}):{" "}
                      {a.quantidade}
                    </p>
                  ))}
                  {previaSaida.faltante > 0 && (
                    <p className="mt-1 font-medium text-destructive">
                      Faltam {previaSaida.faltante} em lotes válidos.
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="s-obs">Observações</Label>
                <Textarea
                  id="s-obs"
                  rows={2}
                  value={saida.obs}
                  onChange={(e) => setSaida({ ...saida, obs: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaida(null)}>
              Cancelar
            </Button>
            <Button disabled={mutSaida.isPending} onClick={() => saida && mutSaida.mutate(saida)}>
              Registrar saída
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ajuste} onOpenChange={(v) => !v && setAjuste(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {ajuste?.tipo === "descarte" ? "Descarte de lote" : "Ajuste de lote"}
            </DialogTitle>
            <DialogDescription>
              {ajuste &&
                `${nomeItem(ajuste.lote.item_id)} • lote ${ajuste.lote.lote || "—"} (${isoParaBr(ajuste.lote.validade) || "sem validade"})`}
            </DialogDescription>
          </DialogHeader>
          {ajuste && (
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="a-qtd">Nova quantidade</Label>
                <Input
                  id="a-qtd"
                  inputMode="decimal"
                  value={ajuste.quantidade}
                  onChange={(e) => setAjuste({ ...ajuste, quantidade: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={ajuste.tipo === "descarte"}
                  onCheckedChange={(v) => setAjuste({ ...ajuste, tipo: v ? "descarte" : "ajuste" })}
                />
                Registrar como descarte
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="a-obs">Justificativa</Label>
                <Textarea
                  id="a-obs"
                  rows={2}
                  value={ajuste.obs}
                  onChange={(e) => setAjuste({ ...ajuste, obs: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAjuste(null)}>
              Cancelar
            </Button>
            <Button
              disabled={mutAjuste.isPending}
              onClick={() => ajuste && mutAjuste.mutate(ajuste)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
