import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { hojeIso, isoParaBr } from "@/lib/datas";
import { darSaidaFefo, type Item } from "@/lib/estoque";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/solicitacoes")({
  head: () => ({
    meta: [
      { title: "Solicitações de materiais | Clínica CEU" },
      {
        name: "description",
        content:
          "Solicitações de materiais por setor na Clínica CEU: pedido, atendimento parcial ou total com baixa automática de estoque por validade.",
      },
      { property: "og:title", content: "Solicitações de materiais | Clínica CEU" },
      { property: "og:description", content: "Pedidos de materiais por setor com atendimento e baixa FEFO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaSolicitacoes,
});

interface Solicitacao {
  id: number;
  solicitante_id: number | null;
  setor: string | null;
  data: string;
  status: string;
  observacoes: string | null;
}

interface SolicitacaoItem {
  id: number;
  solicitacao_id: number;
  item_id: number;
  quantidade_solicitada: number;
  quantidade_atendida: number;
  observacoes: string | null;
  data_atendimento: string | null;
}

interface LinhaNova {
  itemId: number | null;
  quantidade: string;
}

function PaginaSolicitacoes() {
  const { sessao, temModulo, somenteLeitura, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("pendentes");
  const [nova, setNova] = useState<{ setor: string; solicitanteId: number | null; obs: string; linhas: LinhaNova[] } | null>(null);
  const [atender, setAtender] = useState<{ solicitacao: Solicitacao; quantidades: Record<number, string> } | null>(null);

  const apoio = useQuery({
    queryKey: ["solicitacoes-apoio"],
    queryFn: async () => {
      const [itens, colabs] = await Promise.all([
        supabase.from("itens").select("*").eq("ativo", true).order("nome"),
        supabase.from("colaboradoras").select("id, nome").eq("desativada", false).order("nome"),
      ]);
      return {
        itens: (itens.data ?? []) as Item[],
        colaboradoras: (colabs.data ?? []) as { id: number; nome: string }[],
      };
    },
  });

  const dados = useQuery({
    queryKey: ["solicitacoes"],
    queryFn: async () => {
      const [sol, itens] = await Promise.all([
        supabase.from("solicitacoes").select("*").order("id", { ascending: false }).limit(300),
        supabase.from("solicitacao_itens").select("*"),
      ]);
      if (sol.error) throw sol.error;
      if (itens.error) throw itens.error;
      return {
        solicitacoes: (sol.data ?? []) as Solicitacao[],
        itens: (itens.data ?? []) as SolicitacaoItem[],
      };
    },
  });

  const nomeItem = (id: number) => apoio.data?.itens.find((i) => i.id === id)?.nome ?? `Item ${id}`;
  const nomeColab = (id: number | null) =>
    id ? apoio.data?.colaboradoras.find((c) => c.id === id)?.nome ?? `#${id}` : "—";

  const lista = useMemo(() => {
    const todas = dados.data?.solicitacoes ?? [];
    if (status === "todas") return todas;
    if (status === "pendentes") return todas.filter((s) => s.status !== "atendida" && s.status !== "cancelada");
    return todas.filter((s) => s.status === status);
  }, [dados.data, status]);

  const itensDe = (solicitacaoId: number) =>
    (dados.data?.itens ?? []).filter((i) => i.solicitacao_id === solicitacaoId);

  const criar = useMutation({
    mutationFn: async (f: NonNullable<typeof nova>) => {
      const linhas = f.linhas.filter((l) => l.itemId && Number(l.quantidade.replace(",", ".")) > 0);
      if (!linhas.length) throw new Error("Inclua ao menos um item com quantidade.");
      const { data, error } = await supabase
        .from("solicitacoes")
        .insert({
          solicitante_id: f.solicitanteId,
          setor: f.setor.trim() || null,
          data: hojeIso(),
          status: "pendente",
          observacoes: f.obs.trim() || null,
          created_by: sessao?.userId ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: erroItens } = await supabase.from("solicitacao_itens").insert(
        linhas.map((l) => ({
          solicitacao_id: data.id as number,
          item_id: l.itemId as number,
          quantidade_solicitada: Number(l.quantidade.replace(",", ".")),
          quantidade_atendida: 0,
        })),
      );
      if (erroItens) throw erroItens;
    },
    onSuccess: () => {
      toast.success("Solicitação registrada.");
      setNova(null);
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const atenderMut = useMutation({
    mutationFn: async (f: NonNullable<typeof atender>) => {
      const itens = itensDe(f.solicitacao.id);
      let algum = false;
      for (const it of itens) {
        const qtd = Number((f.quantidades[it.id] ?? "0").replace(",", "."));
        if (!qtd || qtd <= 0) continue;
        const pendente = Number(it.quantidade_solicitada) - Number(it.quantidade_atendida);
        if (qtd > pendente) throw new Error(`${nomeItem(it.item_id)}: quantidade acima do pendente (${pendente}).`);
        await darSaidaFefo({
          itemId: it.item_id,
          quantidade: qtd,
          ctx: {
            userId: sessao?.userId ?? null,
            usuarioNome: sessao?.nome ?? null,
            observacoes: `Solicitação #${f.solicitacao.id}`,
            solicitacaoItemId: it.id,
          },
        });
        const { error } = await supabase
          .from("solicitacao_itens")
          .update({
            quantidade_atendida: Number(it.quantidade_atendida) + qtd,
            data_atendimento: hojeIso(),
          })
          .eq("id", it.id);
        if (error) throw error;
        algum = true;
      }
      if (!algum) throw new Error("Informe ao menos uma quantidade a atender.");

      const atualizados = itens.map((it) => ({
        ...it,
        quantidade_atendida: Number(it.quantidade_atendida) + Number((f.quantidades[it.id] ?? "0").replace(",", ".") || 0),
      }));
      const completa = atualizados.every((it) => Number(it.quantidade_atendida) >= Number(it.quantidade_solicitada));
      const { error: erroStatus } = await supabase
        .from("solicitacoes")
        .update({ status: completa ? "atendida" : "parcial" })
        .eq("id", f.solicitacao.id);
      if (erroStatus) throw erroStatus;
    },
    onSuccess: () => {
      toast.success("Atendimento registrado com baixa FEFO.");
      setAtender(null);
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const cancelar = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("solicitacoes").update({ status: "cancelada" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação cancelada.");
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!carregandoSessao && !temModulo("solicitacoes")) {
    return (
      <AppShell titulo="Solicitações de materiais">
        <div className="card-superficie max-w-md p-6 text-sm">Você não tem acesso às solicitações.</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Solicitações de materiais"
      descricao={`${lista.length} solicitação(ões)`}
      acoes={
        !somenteLeitura && (
          <Button size="sm" onClick={() => setNova({ setor: sessao?.setor ?? "", solicitanteId: null, obs: "", linhas: [{ itemId: null, quantidade: "" }] })}>
            <Plus className="mr-1.5 size-4" /> Nova solicitação
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendentes">Em aberto</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="parcial">Parciais</SelectItem>
            <SelectItem value="atendida">Atendidas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {dados.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((s) => {
            const itens = itensDe(s.id);
            const pendente = itens.some((i) => Number(i.quantidade_atendida) < Number(i.quantidade_solicitada));
            return (
              <article key={s.id} className="card-superficie p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Solicitação #{s.id} • {isoParaBr(s.data)}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {[s.setor, nomeColab(s.solicitante_id)].filter(Boolean).join(" • ")}
                    </p>
                    {s.observacoes && <p className="mt-1 text-xs text-muted-foreground">{s.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={s.status === "atendida" ? "secondary" : s.status === "cancelada" ? "destructive" : "outline"}
                      className="text-[10px] capitalize"
                    >
                      {s.status}
                    </Badge>
                    {!somenteLeitura && pendente && s.status !== "cancelada" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setAtender({
                              solicitacao: s,
                              quantidades: Object.fromEntries(
                                itens.map((i) => [
                                  i.id,
                                  String(Number(i.quantidade_solicitada) - Number(i.quantidade_atendida)),
                                ]),
                              ),
                            })
                          }
                        >
                          <Check className="mr-1.5 size-4" /> Atender
                        </Button>
                        <Button size="icon" variant="ghost" aria-label={`Cancelar solicitação ${s.id}`} onClick={() => cancelar.mutate(s.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <ul className="mt-3 divide-y divide-border border-t border-border text-xs">
                  {itens.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="text-foreground">{nomeItem(i.item_id)}</span>
                      <span className="text-muted-foreground">
                        {Number(i.quantidade_atendida)} / {Number(i.quantidade_solicitada)} atendido(s)
                      </span>
                    </li>
                  ))}
                  {!itens.length && <li className="py-2 text-muted-foreground">Sem itens.</li>}
                </ul>
              </article>
            );
          })}
          {!lista.length && <p className="text-sm text-muted-foreground">Nenhuma solicitação neste filtro.</p>}
        </div>
      )}

      <Dialog open={!!nova} onOpenChange={(v) => !v && setNova(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova solicitação</DialogTitle>
            <DialogDescription>A baixa de estoque acontece só no atendimento, sempre por FEFO.</DialogDescription>
          </DialogHeader>
          {nova && (
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="n-setor">Setor</Label>
                  <Input id="n-setor" value={nova.setor} onChange={(e) => setNova({ ...nova, setor: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Solicitante</Label>
                  <Select
                    value={nova.solicitanteId ? String(nova.solicitanteId) : ""}
                    onValueChange={(v) => setNova({ ...nova, solicitanteId: Number(v) })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(apoio.data?.colaboradoras ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Itens</Label>
                {nova.linhas.map((l, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Select
                      value={l.itemId ? String(l.itemId) : ""}
                      onValueChange={(v) => {
                        const linhas = [...nova.linhas];
                        linhas[idx] = { ...l, itemId: Number(v) };
                        setNova({ ...nova, linhas });
                      }}
                    >
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione o item" /></SelectTrigger>
                      <SelectContent>
                        {(apoio.data?.itens ?? []).map((i) => (
                          <SelectItem key={i.id} value={String(i.id)}>{i.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="w-24"
                      inputMode="decimal"
                      placeholder="Qtd"
                      value={l.quantidade}
                      onChange={(e) => {
                        const linhas = [...nova.linhas];
                        linhas[idx] = { ...l, quantidade: e.target.value };
                        setNova({ ...nova, linhas });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover linha"
                      onClick={() => setNova({ ...nova, linhas: nova.linhas.filter((_, i) => i !== idx) })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setNova({ ...nova, linhas: [...nova.linhas, { itemId: null, quantidade: "" }] })}>
                  <Plus className="mr-1.5 size-4" /> Adicionar item
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="n-obs">Observações</Label>
                <Textarea id="n-obs" rows={2} value={nova.obs} onChange={(e) => setNova({ ...nova, obs: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNova(null)}>Cancelar</Button>
            <Button disabled={criar.isPending} onClick={() => nova && criar.mutate(nova)}>Salvar solicitação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!atender} onOpenChange={(v) => !v && setAtender(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atender solicitação #{atender?.solicitacao.id}</DialogTitle>
            <DialogDescription>
              A baixa consome os lotes com validade mais próxima; lotes vencidos não são usados.
            </DialogDescription>
          </DialogHeader>
          {atender && (
            <div className="grid gap-3">
              {itensDe(atender.solicitacao.id).map((i) => {
                const pendente = Number(i.quantidade_solicitada) - Number(i.quantidade_atendida);
                return (
                  <div key={i.id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm">
                      {nomeItem(i.item_id)}
                      <span className="block text-xs text-muted-foreground">pendente: {pendente}</span>
                    </span>
                    <Input
                      className="w-24"
                      inputMode="decimal"
                      value={atender.quantidades[i.id] ?? ""}
                      onChange={(e) =>
                        setAtender({ ...atender, quantidades: { ...atender.quantidades, [i.id]: e.target.value } })
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAtender(null)}>Cancelar</Button>
            <Button disabled={atenderMut.isPending} onClick={() => atender && atenderMut.mutate(atender)}>Confirmar baixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
