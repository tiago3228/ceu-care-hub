import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { brParaIso, hojeIso, isoParaBr, mascaraDataBr } from "@/lib/datas";
import { darSaidaFefo, horaAgora, type Item } from "@/lib/estoque";
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

export const Route = createFileRoute("/_authenticated/enfermagem")({
  head: () => ({
    meta: [
      { title: "Enfermagem | Clínica CEU" },
      {
        name: "description",
        content:
          "Registro de atendimentos de enfermagem da Clínica CEU com procedimento, responsável, sala e baixa automática de materiais por FEFO.",
      },
      { property: "og:title", content: "Enfermagem | Clínica CEU" },
      {
        property: "og:description",
        content: "Atendimentos de enfermagem rastreáveis com consumo de materiais integrado ao estoque.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaEnfermagem,
});

interface Atendimento {
  id: number;
  data: string;
  hora: string | null;
  procedimento: string;
  procedimento_id: number | null;
  paciente_id: number | null;
  paciente_nome_livre: string | null;
  colaboradora_id: number | null;
  medico_id: number | null;
  sala_id: number | null;
  observacoes: string | null;
}

interface LinhaMaterial {
  itemId: string;
  quantidade: string;
}

interface FormAtendimento {
  data: string;
  hora: string;
  pacienteId: string;
  pacienteLivre: string;
  procedimentoId: string;
  colaboradoraId: string;
  medicoId: string;
  salaId: string;
  observacoes: string;
  materiais: LinhaMaterial[];
}

const NENHUM = "__nenhum__";

function novoForm(): FormAtendimento {
  return {
    data: isoParaBr(hojeIso()),
    hora: horaAgora(),
    pacienteId: NENHUM,
    pacienteLivre: "",
    procedimentoId: "",
    colaboradoraId: NENHUM,
    medicoId: NENHUM,
    salaId: NENHUM,
    observacoes: "",
    materiais: [],
  };
}

function PaginaEnfermagem() {
  const { sessao, temModulo, somenteLeitura, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [inicio, setInicio] = useState(isoParaBr(hojeIso()));
  const [fim, setFim] = useState(isoParaBr(hojeIso()));
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<FormAtendimento | null>(null);

  const apoio = useQuery({
    queryKey: ["enfermagem-apoio"],
    queryFn: async () => {
      const [pacientes, procedimentos, colaboradoras, medicos, salas, itens, kits] = await Promise.all([
        supabase.from("pacientes").select("id, nome, prontuario").eq("arquivado", false).order("nome").limit(2000),
        supabase.from("procedimentos_enfermagem").select("id, nome, ativo").eq("ativo", true).order("nome"),
        supabase.from("colaboradoras").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("medicos").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("salas").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("itens").select("*").eq("ativo", true).order("nome"),
        supabase.from("procedimento_materiais").select("procedimento_id, item_id, quantidade"),
      ]);
      return {
        pacientes: pacientes.data ?? [],
        procedimentos: procedimentos.data ?? [],
        colaboradoras: colaboradoras.data ?? [],
        medicos: medicos.data ?? [],
        salas: salas.data ?? [],
        itens: (itens.data ?? []) as Item[],
        kits: kits.data ?? [],
      };
    },
  });

  const isoInicio = brParaIso(inicio) ?? hojeIso();
  const isoFim = brParaIso(fim) ?? hojeIso();

  const atendimentos = useQuery({
    queryKey: ["atendimentos", isoInicio, isoFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos_enfermagem")
        .select("*")
        .gte("data", isoInicio)
        .lte("data", isoFim)
        .order("data", { ascending: false })
        .order("hora", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Atendimento[];
    },
  });

  const materiaisPorAtendimento = useQuery({
    queryKey: ["atendimento-materiais", (atendimentos.data ?? []).map((a) => a.id).join(",")],
    enabled: !!atendimentos.data?.length,
    queryFn: async () => {
      const ids = (atendimentos.data ?? []).map((a) => a.id);
      const { data, error } = await supabase
        .from("atendimento_materiais")
        .select("atendimento_id, item_id, quantidade")
        .in("atendimento_id", ids);
      if (error) throw error;
      const mapa = new Map<number, { item_id: number; quantidade: number }[]>();
      for (const m of data ?? []) {
        const arr = mapa.get(m.atendimento_id) ?? [];
        arr.push({ item_id: m.item_id, quantidade: Number(m.quantidade) });
        mapa.set(m.atendimento_id, arr);
      }
      return mapa;
    },
  });

  const nome = (lista: { id: number; nome: string }[] | undefined, id: number | null) =>
    id ? (lista ?? []).find((x) => x.id === id)?.nome ?? null : null;

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (atendimentos.data ?? []).filter((a) => {
      if (!termo) return true;
      const paciente = a.paciente_nome_livre ?? nome(apoio.data?.pacientes, a.paciente_id) ?? "";
      return (
        paciente.toLowerCase().includes(termo) ||
        a.procedimento.toLowerCase().includes(termo) ||
        (a.observacoes ?? "").toLowerCase().includes(termo)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atendimentos.data, busca, apoio.data]);

  // Ao escolher o procedimento, sugere o kit de materiais (sugestão, nunca bloqueio).
  useEffect(() => {
    if (!form?.procedimentoId || !apoio.data) return;
    const pid = Number(form.procedimentoId);
    const kit = apoio.data.kits.filter((k) => k.procedimento_id === pid);
    if (!kit.length) return;
    setForm((f) =>
      f && f.procedimentoId === String(pid) && f.materiais.length === 0
        ? { ...f, materiais: kit.map((k) => ({ itemId: String(k.item_id), quantidade: String(k.quantidade) })) }
        : f,
    );
  }, [form?.procedimentoId, apoio.data]);

  const salvar = useMutation({
    mutationFn: async (f: FormAtendimento) => {
      const data = brParaIso(f.data);
      if (!data) throw new Error("Data inválida (DD-MM-AAAA).");
      if (!f.procedimentoId) throw new Error("Selecione o procedimento.");
      const paciente = f.pacienteId !== NENHUM ? Number(f.pacienteId) : null;
      if (!paciente && !f.pacienteLivre.trim()) throw new Error("Informe o paciente (cadastrado ou nome livre).");

      const procedimento = apoio.data?.procedimentos.find((p) => p.id === Number(f.procedimentoId));

      const linhas = f.materiais
        .filter((m) => m.itemId && Number(m.quantidade) > 0)
        .map((m) => ({ itemId: Number(m.itemId), quantidade: Number(m.quantidade) }));

      const { data: criado, error } = await supabase
        .from("atendimentos_enfermagem")
        .insert({
          data,
          hora: f.hora || null,
          procedimento: procedimento?.nome ?? "",
          procedimento_id: Number(f.procedimentoId),
          paciente_id: paciente,
          paciente_nome_livre: paciente ? null : f.pacienteLivre.trim().toUpperCase(),
          colaboradora_id: f.colaboradoraId !== NENHUM ? Number(f.colaboradoraId) : null,
          medico_id: f.medicoId !== NENHUM ? Number(f.medicoId) : null,
          sala_id: f.salaId !== NENHUM ? Number(f.salaId) : null,
          observacoes: f.observacoes.trim() || null,
          created_by: sessao?.userId ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const ctx = {
        userId: sessao?.userId ?? null,
        usuarioNome: sessao?.nome ?? null,
        observacoes: `Enfermagem: ${procedimento?.nome ?? ""} (atendimento #${criado.id})`,
      };

      for (const linha of linhas) {
        const alocacoes = await darSaidaFefo({ itemId: linha.itemId, quantidade: linha.quantidade, ctx });
        const registros = alocacoes.map((a) => ({
          atendimento_id: criado.id,
          item_id: linha.itemId,
          lote_id: a.loteId,
          quantidade: a.quantidade,
        }));
        if (registros.length) {
          const { error: erroMat } = await supabase.from("atendimento_materiais").insert(registros);
          if (erroMat) throw erroMat;
        }
      }
      return criado.id;
    },
    onSuccess: () => {
      toast.success("Atendimento registrado e materiais baixados por FEFO.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["atendimentos"] });
      queryClient.invalidateQueries({ queryKey: ["atendimento-materiais"] });
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const excluir = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("atendimentos_enfermagem").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atendimento excluído. O consumo já lançado permanece no histórico do estoque.");
      queryClient.invalidateQueries({ queryKey: ["atendimentos"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!carregandoSessao && !temModulo("enfermagem")) {
    return (
      <AppShell titulo="Enfermagem">
        <div className="card-superficie max-w-md p-6 text-sm">Você não tem acesso ao módulo de enfermagem.</div>
      </AppShell>
    );
  }

  const itemNome = (id: number) => apoio.data?.itens.find((i) => i.id === id)?.nome ?? `Item ${id}`;

  return (
    <AppShell
      titulo="Enfermagem"
      descricao={`${lista.length} atendimento(s) no período`}
      acoes={
        !somenteLeitura && (
          <Button size="sm" onClick={() => setForm(novoForm())}>
            <Plus className="mr-1.5 size-4" /> Novo atendimento
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="f-inicio">De</Label>
          <Input id="f-inicio" className="w-36" value={inicio} onChange={(e) => setInicio(mascaraDataBr(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-fim">Até</Label>
          <Input id="f-fim" className="w-36" value={fim} onChange={(e) => setFim(mascaraDataBr(e.target.value))} />
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar paciente, procedimento ou observação" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      {atendimentos.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <div className="space-y-3">
          {lista.map((a) => {
            const materiais = materiaisPorAtendimento.data?.get(a.id) ?? [];
            return (
              <article key={a.id} className="card-superficie p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">
                      {a.paciente_nome_livre ?? nome(apoio.data?.pacientes, a.paciente_id) ?? "Paciente não informado"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {isoParaBr(a.data)} {a.hora ? `• ${a.hora.slice(0, 5)}` : ""} • {a.procedimento}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        nome(apoio.data?.colaboradoras, a.colaboradora_id),
                        nome(apoio.data?.medicos, a.medico_id),
                        nome(apoio.data?.salas, a.sala_id),
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                    {a.observacoes && <p className="mt-1 text-xs italic text-muted-foreground">{a.observacoes}</p>}
                    {!!materiais.length && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {materiais.map((m, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {itemNome(m.item_id)} × {m.quantidade}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {!somenteLeitura && (
                    <Button variant="ghost" size="icon" aria-label="Excluir atendimento" onClick={() => excluir.mutate(a.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
          {!lista.length && <p className="text-sm text-muted-foreground">Nenhum atendimento no período selecionado.</p>}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo atendimento de enfermagem</DialogTitle>
            <DialogDescription>
              Os materiais do procedimento são sugeridos automaticamente e podem ser ajustados. A baixa é feita por FEFO.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="a-data">Data</Label>
                  <Input id="a-data" value={form.data} onChange={(e) => setForm({ ...form, data: mascaraDataBr(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="a-hora">Hora</Label>
                  <Input id="a-hora" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Procedimento</Label>
                  <Select value={form.procedimentoId} onValueChange={(v) => setForm({ ...form, procedimentoId: v, materiais: [] })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(apoio.data?.procedimentos ?? []).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Paciente cadastrado</Label>
                  <Select value={form.pacienteId} onValueChange={(v) => setForm({ ...form, pacienteId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Não cadastrado</SelectItem>
                      {(apoio.data?.pacientes ?? []).slice(0, 500).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nome}{p.prontuario ? ` (${p.prontuario})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="a-livre">Ou nome do paciente</Label>
                  <Input
                    id="a-livre"
                    disabled={form.pacienteId !== NENHUM}
                    value={form.pacienteLivre}
                    onChange={(e) => setForm({ ...form, pacienteLivre: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Colaboradora</Label>
                  <Select value={form.colaboradoraId} onValueChange={(v) => setForm({ ...form, colaboradoraId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Não informado</SelectItem>
                      {(apoio.data?.colaboradoras ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Médico</Label>
                  <Select value={form.medicoId} onValueChange={(v) => setForm({ ...form, medicoId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Não informado</SelectItem>
                      {(apoio.data?.medicos ?? []).map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>{m.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sala</Label>
                  <Select value={form.salaId} onValueChange={(v) => setForm({ ...form, salaId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Não informada</SelectItem>
                      {(apoio.data?.salas ?? []).map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="a-obs">Observações</Label>
                <Textarea id="a-obs" rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>

              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Materiais consumidos</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setForm({ ...form, materiais: [...form.materiais, { itemId: "", quantidade: "1" }] })}
                  >
                    <Plus className="mr-1.5 size-4" /> Adicionar
                  </Button>
                </div>
                {form.materiais.map((m, idx) => (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs">Item</Label>
                      <Select
                        value={m.itemId}
                        onValueChange={(v) => {
                          const materiais = [...form.materiais];
                          materiais[idx] = { ...m, itemId: v };
                          setForm({ ...form, materiais });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
                        <SelectContent>
                          {(apoio.data?.itens ?? []).map((i) => (
                            <SelectItem key={i.id} value={String(i.id)}>{i.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-1.5">
                      <Label className="text-xs">Qtd.</Label>
                      <Input
                        type="number"
                        min={0}
                        value={m.quantidade}
                        onChange={(e) => {
                          const materiais = [...form.materiais];
                          materiais[idx] = { ...m, quantidade: e.target.value };
                          setForm({ ...form, materiais });
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover material"
                      onClick={() => setForm({ ...form, materiais: form.materiais.filter((_, i) => i !== idx) })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                {!form.materiais.length && (
                  <p className="text-xs text-muted-foreground">Nenhum material — o atendimento pode ser registrado sem consumo.</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
            <Button disabled={salvar.isPending} onClick={() => form && salvar.mutate(form)}>Registrar atendimento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
