import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { temPerfilEnfermagem } from "@/lib/perfil-colaboradora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// A tabela nova será incluída nos tipos gerados após aplicar a migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
function segundaDaSemana(base: Date) {
  const d = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()));
  const dia = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dia === 0 ? 6 : dia - 1));
  return d;
}
function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function br(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}
type Form = {
  id: number | null;
  data: string;
  colaboradora_ids: number[];
  procedimento_ids: number[];
  sala_ids: number[];
  medico_ids: number[];
  periodo: string;
  observacoes: string;
};
const VAZIO: Form = {
  id: null,
  data: "",
  colaboradora_ids: [],
  procedimento_ids: [],
  sala_ids: [],
  medico_ids: [],
  periodo: "",
  observacoes: "",
};

export const Route = createFileRoute("/_authenticated/escala-enfermagem")({
  head: () => ({ meta: [{ title: "Escala semanal de enfermagem | Clínica CEU" }] }),
  component: PaginaEscalaEnfermagem,
});
function PaginaEscalaEnfermagem() {
  const { temModulo, somenteLeitura, isAdmin, sessao, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [inicio, setInicio] = useState(() =>
    segundaDaSemana(new Date()).toISOString().slice(0, 10),
  );
  const [form, setForm] = useState<Form | null>(null);
  const [procedimentoForm, setProcedimentoForm] = useState<{
    id: number | null;
    nome: string;
  } | null>(null);
  const fim = somarDias(inicio, 6);
  const ehSetorEnfermagem = isAdmin || sessao?.papeis.includes("enfermagem");
  const podeVer = !!ehSetorEnfermagem && temModulo("escala_enfermagem_visualizar");
  const podeEditar =
    !!ehSetorEnfermagem && !somenteLeitura && temModulo("escala_enfermagem_editar");
  const apoio = useQuery({
    queryKey: ["escala-enfermagem-apoio"],
    queryFn: async () => {
      const [colabs, procedimentos, salas, medicos] = await Promise.all([
        supabase
          .from("colaboradoras")
          .select("id, nome, apelido, cargo, tipo_colaboradora")
          .eq("desativada", false)
          .order("nome"),
        db.from("procedimentos_enfermagem").select("id, nome").eq("ativo", true).order("nome"),
        db.from("salas").select("id, nome").eq("ativa", true).order("nome"),
        db.from("medicos").select("id, nome, apelido").eq("ativo", true).order("nome"),
      ]);
      if (colabs.error) throw colabs.error;
      if (procedimentos.error) throw procedimentos.error;
      if (salas.error) throw salas.error;
      if (medicos.error) throw medicos.error;
      return {
        colaboradoras: (colabs.data ?? []).filter(temPerfilEnfermagem),
        procedimentos: procedimentos.data ?? [],
        salas: salas.data ?? [],
        medicos: medicos.data ?? [],
      };
    },
  });
  const semana = useQuery({
    queryKey: ["escala-enfermagem-semana", inicio],
    queryFn: async () => {
      const result = await db
        .from("escalas_enfermagem")
        .select(
          "*, escala_enfermagem_colaboradoras(colaboradora_id), escala_enfermagem_procedimentos(procedimento_id), escala_enfermagem_salas(sala_id), escala_enfermagem_medicos(medico_id)",
        )
        .gte("data", inicio)
        .lte("data", fim)
        .order("data")
        .order("periodo");
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });
  const salvarProcedimento = useMutation({
    mutationFn: async (entrada: { id: number | null; nome: string }) => {
      const nome = entrada.nome.trim();
      if (!nome) throw new Error("Informe o nome do procedimento.");
      const result = entrada.id
        ? await db.from("procedimentos_enfermagem").update({ nome }).eq("id", entrada.id)
        : await db.from("procedimentos_enfermagem").insert({ nome, ativo: true });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("Procedimento salvo.");
      setProcedimentoForm(null);
      queryClient.invalidateQueries({ queryKey: ["escala-enfermagem-apoio"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar o procedimento.",
      ),
  });
  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      if (!f.data || !f.colaboradora_ids.length)
        throw new Error("Informe o dia e as colaboradoras.");
      const payload = {
        data: f.data,
        colaboradora_id: f.colaboradora_ids[0],
        periodo: f.periodo.trim() || null,
        observacoes: f.observacoes.trim() || null,
      };
      const result = f.id
        ? await db.from("escalas_enfermagem").update(payload).eq("id", f.id)
        : await db.from("escalas_enfermagem").insert(payload);
      if (result.error) throw result.error;
      let escalaId = f.id;
      if (!escalaId) {
        const criada = await db
          .from("escalas_enfermagem")
          .select("id")
          .eq("data", f.data)
          .eq("colaboradora_id", f.colaboradora_ids[0])
          .single();
        if (criada.error) throw criada.error;
        escalaId = criada.data.id;
      }
      for (const tabela of [
        "escala_enfermagem_colaboradoras",
        "escala_enfermagem_procedimentos",
        "escala_enfermagem_salas",
        "escala_enfermagem_medicos",
      ]) {
        const removidos = await db.from(tabela).delete().eq("escala_id", escalaId);
        if (removidos.error) throw removidos.error;
      }
      const relacoes = [
        ["escala_enfermagem_colaboradoras", "colaboradora_id", f.colaboradora_ids],
        ["escala_enfermagem_procedimentos", "procedimento_id", f.procedimento_ids],
        ["escala_enfermagem_salas", "sala_id", f.sala_ids],
        ["escala_enfermagem_medicos", "medico_id", f.medico_ids],
      ] as const;
      for (const [tabela, campo, ids] of relacoes) {
        if (!ids.length) continue;
        const inseridos = await db
          .from(tabela)
          .insert(ids.map((id) => ({ escala_id: escalaId, [campo]: id })));
        if (inseridos.error) throw inseridos.error;
      }
      let duplicada = false;
      if (!f.id) {
        const proximaData = somarDias(f.data, 7);
        const existente = await db
          .from("escalas_enfermagem")
          .select("id")
          .eq("data", proximaData)
          .eq("colaboradora_id", f.colaboradora_ids[0])
          .maybeSingle();
        if (existente.error) throw existente.error;
        if (!existente.data) {
          const proxima = await db
            .from("escalas_enfermagem")
            .insert({
              ...payload,
              data: proximaData,
            })
            .select("id")
            .single();
          if (proxima.error) throw proxima.error;
          duplicada = true;
          for (const [tabela, campo, ids] of relacoes) {
            if (!ids.length) continue;
            const inseridos = await db
              .from(tabela)
              .insert(ids.map((id) => ({ escala_id: proxima.data.id, [campo]: id })));
            if (inseridos.error) throw inseridos.error;
          }
        }
      }
      return { duplicada };
    },
    onSuccess: (resultado) => {
      toast.success(
        resultado.duplicada
          ? "Escala salva e duplicada para a semana seguinte."
          : "Escala de enfermagem salva.",
      );
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["escala-enfermagem-semana"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a escala."),
  });
  const excluir = useMutation({
    mutationFn: async (id: number) => {
      const result = await db.from("escalas_enfermagem").delete().eq("id", id);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("Escala removida.");
      queryClient.invalidateQueries({ queryKey: ["escala-enfermagem-semana"] });
    },
  });
  const porDia = useMemo(
    () =>
      DIAS.map((nome, i) => ({
        nome,
        data: somarDias(inicio, i),
        itens: (semana.data ?? []).filter(
          (item: { data: string }) => item.data === somarDias(inicio, i),
        ),
      })),
    [inicio, semana.data],
  );
  const nome = (id: number) =>
    apoio.data?.colaboradoras?.find((item: { id: number }) => item.id === id)?.apelido ||
    apoio.data?.colaboradoras?.find((item: { id: number }) => item.id === id)?.nome ||
    "Colaboradora";
  const nomes = (ids: number[], lista: { id: number; nome: string; apelido?: string | null }[]) =>
    ids
      .map((id) => lista.find((item) => item.id === id))
      .filter(Boolean)
      .map((item) => item!.apelido?.trim() || item!.nome)
      .join(", ");
  if (!carregandoSessao && !podeVer)
    return (
      <AppShell titulo="Escala de enfermagem">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso ao módulo de enfermagem.
        </div>
      </AppShell>
    );
  return (
    <AppShell
      titulo="Escala de enfermagem"
      descricao="Escala independente da escala de salas e médicos."
      acoes={
        podeEditar && (
          <Button size="sm" onClick={() => setForm({ ...VAZIO, data: inicio })}>
            <CalendarPlus className="mr-1.5 size-4" /> Nova escala
          </Button>
        )
      }
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Setor: <strong className="text-foreground">Enfermagem</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            A escala de salas continua disponível em “Escala semanal”.
          </p>
        </div>
        <Badge variant="secondary">{(semana.data ?? []).length} escala(s) na semana</Badge>
      </div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={() => setInicio(somarDias(inicio, -7))}>
          ← Semana anterior
        </Button>
        <strong className="text-sm">
          {br(inicio)} a {br(fim)}
        </strong>
        <Button variant="outline" size="sm" onClick={() => setInicio(somarDias(inicio, 7))}>
          Próxima semana →
        </Button>
      </div>
      <div className="grid gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {porDia.map((dia) => (
          <section key={dia.data} className="card-superficie min-h-40 p-3">
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <div>
                <h2 className="text-sm font-semibold">{dia.nome}</h2>
                <p className="text-[11px] text-muted-foreground">{br(dia.data)}</p>
              </div>
              {podeEditar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setForm({ ...VAZIO, data: dia.data })}
                  aria-label={`Adicionar escala de ${dia.nome}`}
                >
                  <Plus className="size-4" />
                </Button>
              )}
            </div>
            {dia.itens.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem escala</p>
            ) : (
              <div className="space-y-2">
                {dia.itens.map(
                  (item: {
                    id: number;
                    colaboradora_id: number;
                    escala_enfermagem_colaboradoras: { colaboradora_id: number }[] | null;
                    periodo: string | null;
                    observacoes: string | null;
                    escala_enfermagem_procedimentos: { procedimento_id: number }[] | null;
                    escala_enfermagem_salas: { sala_id: number }[] | null;
                    escala_enfermagem_medicos: { medico_id: number }[] | null;
                  }) => (
                    <article key={item.id} className="rounded-lg bg-secondary/50 p-2">
                      <p className="truncate text-xs font-semibold">
                        {nomes(
                          (item.escala_enfermagem_colaboradoras ?? []).map(
                            (entry) => entry.colaboradora_id,
                          ),
                          apoio.data?.colaboradoras ?? [],
                        ) || nome(item.colaboradora_id)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {nomes(
                          (item.escala_enfermagem_procedimentos ?? []).map(
                            (entry) => entry.procedimento_id,
                          ),
                          apoio.data?.procedimentos ?? [],
                        ) || "Sem procedimento"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Salas:{" "}
                        {nomes(
                          (item.escala_enfermagem_salas ?? []).map((entry) => entry.sala_id),
                          apoio.data?.salas ?? [],
                        ) || "Nenhuma"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Médicos:{" "}
                        {nomes(
                          (item.escala_enfermagem_medicos ?? []).map((entry) => entry.medico_id),
                          apoio.data?.medicos ?? [],
                        ) || "Nenhum"}
                      </p>
                      {item.periodo && (
                        <p className="text-[11px] text-muted-foreground">{item.periodo}</p>
                      )}
                      {podeEditar && (
                        <div className="mt-1 flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() =>
                              setForm({
                                id: item.id,
                                data: dia.data,
                                colaboradora_ids: (item.escala_enfermagem_colaboradoras ?? [])
                                  .length
                                  ? item.escala_enfermagem_colaboradoras.map(
                                      (entry) => entry.colaboradora_id,
                                    )
                                  : [item.colaboradora_id],
                                procedimento_ids: (item.escala_enfermagem_procedimentos ?? []).map(
                                  (entry) => entry.procedimento_id,
                                ),
                                sala_ids: (item.escala_enfermagem_salas ?? []).map(
                                  (entry) => entry.sala_id,
                                ),
                                medico_ids: (item.escala_enfermagem_medicos ?? []).map(
                                  (entry) => entry.medico_id,
                                ),
                                periodo: item.periodo ?? "",
                                observacoes: item.observacoes ?? "",
                              })
                            }
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-destructive"
                            onClick={() => excluir.mutate(item.id)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      )}
                    </article>
                  ),
                )}
              </div>
            )}
          </section>
        ))}
      </div>
      <Dialog modal={false} open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {form?.id ? "Editar escala de enfermagem" : "Nova escala de enfermagem"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Dia</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </div>
              <details className="group space-y-1.5 sm:col-span-2">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  <span>Colaboradoras ({form.colaboradora_ids.length} selecionada(s))</span>
                  <span className="text-muted-foreground transition-transform group-open:rotate-180">
                    ⌄
                  </span>
                </summary>
                <div className="mt-2 grid max-h-36 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
                  {(apoio.data?.colaboradoras ?? []).map(
                    (item: { id: number; nome: string; apelido: string | null }) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary/60"
                      >
                        <Checkbox
                          checked={form.colaboradora_ids.includes(item.id)}
                          onCheckedChange={(checked) =>
                            setForm({
                              ...form,
                              colaboradora_ids: checked
                                ? [...form.colaboradora_ids, item.id]
                                : form.colaboradora_ids.filter((id) => id !== item.id),
                            })
                          }
                        />
                        {item.apelido || item.nome}
                      </label>
                    ),
                  )}
                </div>
              </details>
              {(
                [
                  ["Procedimento", "procedimento_ids", apoio.data?.procedimentos ?? []],
                  ["Salas", "sala_ids", apoio.data?.salas ?? []],
                  ["Médicos", "medico_ids", apoio.data?.medicos ?? []],
                ] as const
              ).map(([titulo, campo, opcoes]) => (
                <details key={campo} className="group space-y-1.5 sm:col-span-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    <span>
                      {titulo} ({(form[campo] as number[]).length} selecionada(s))
                    </span>
                    <span className="text-muted-foreground transition-transform group-open:rotate-180">
                      ⌄
                    </span>
                  </summary>
                  <div className="mt-2 space-y-2">
                    {campo === "procedimento_ids" && podeEditar && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setProcedimentoForm({ id: null, nome: "" })}
                      >
                        <Plus className="mr-1 size-3.5" /> Novo procedimento
                      </Button>
                    )}
                    <div className="grid max-h-36 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
                      {opcoes.map((item: { id: number; nome: string; apelido?: string | null }) => {
                        const selecionados = form[campo] as number[];
                        return (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary/60"
                          >
                            <Checkbox
                              checked={selecionados.includes(item.id)}
                              onCheckedChange={(checked) =>
                                setForm({
                                  ...form,
                                  [campo]: checked
                                    ? [...selecionados, item.id]
                                    : selecionados.filter((id) => id !== item.id),
                                })
                              }
                            />
                            <span className="min-w-0 flex-1">
                              {item.apelido?.trim() || item.nome}
                            </span>
                            {campo === "procedimento_ids" && podeEditar && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 shrink-0"
                                aria-label={`Editar procedimento ${item.nome}`}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setProcedimentoForm({ id: item.id, nome: item.nome });
                                }}
                              >
                                <Pencil className="size-3" />
                              </Button>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </details>
              ))}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Período/turno</Label>
                <Input
                  placeholder="Ex.: Manhã, tarde ou plantão"
                  value={form.periodo}
                  onChange={(e) => setForm({ ...form, periodo: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={() => form && salvar.mutate(form)} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar escala"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!procedimentoForm} onOpenChange={(open) => !open && setProcedimentoForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {procedimentoForm?.id ? "Editar procedimento" : "Novo procedimento"}
            </DialogTitle>
          </DialogHeader>
          {procedimentoForm && (
            <div className="space-y-1.5">
              <Label htmlFor="procedimento-nome">Nome do procedimento</Label>
              <Input
                id="procedimento-nome"
                autoFocus
                maxLength={150}
                value={procedimentoForm.nome}
                onChange={(event) =>
                  setProcedimentoForm({ ...procedimentoForm, nome: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") salvarProcedimento.mutate(procedimentoForm);
                }}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcedimentoForm(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => procedimentoForm && salvarProcedimento.mutate(procedimentoForm)}
              disabled={salvarProcedimento.isPending}
            >
              {salvarProcedimento.isPending ? "Salvando..." : "Salvar procedimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
