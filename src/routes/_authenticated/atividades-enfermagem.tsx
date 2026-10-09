/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { temPerfilEnfermagem } from "@/lib/perfil-colaboradora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const db = supabase as any;
const DIAS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"];
const SEM_COLABORADORA = "__nenhuma__";
type Atividade = {
  id: number;
  dia_semana: number;
  titulo: string;
  horario: string | null;
  descricao: string | null;
  colaboradora_id: number | null;
  colaboradoras?: { nome: string } | null;
};
type FormAtividade = {
  id: number | null;
  dia_semana: number;
  titulo: string;
  horario: string;
  descricao: string;
  colaboradora_id: string;
};
const novoForm = (dia = 1): FormAtividade => ({
  id: null,
  dia_semana: dia,
  titulo: "",
  horario: "",
  descricao: "",
  colaboradora_id: SEM_COLABORADORA,
});

export const Route = createFileRoute("/_authenticated/atividades-enfermagem")({
  head: () => ({
    meta: [
      { title: "Atividades | Enfermagem — Clínica CEU" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaAtividades,
});

function PaginaAtividades() {
  const { temModulo, somenteLeitura, isAdmin, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormAtividade | null>(null);
  const podeEditar = !somenteLeitura && (isAdmin || temModulo("enfermagem"));
  const apoio = useQuery({
    queryKey: ["atividades-enfermagem-apoio"],
    queryFn: async () => {
      const { data, error } = await db
        .from("colaboradoras")
        .select("id, nome, apelido, cargo, tipo_colaboradora")
        .eq("setor", "enfermagem")
        .eq("desativada", false)
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as any[]).filter(temPerfilEnfermagem) as {
        id: number;
        nome: string;
        apelido: string | null;
      }[];
    },
  });
  const atividades = useQuery({
    queryKey: ["atividades-enfermagem"],
    queryFn: async () => {
      const { data, error } = await db
        .from("atividades_enfermagem")
        .select("id, dia_semana, titulo, horario, descricao, colaboradora_id, colaboradoras(nome)")
        .order("dia_semana")
        .order("horario")
        .order("titulo");
      if (error) throw error;
      return (data ?? []) as Atividade[];
    },
  });
  const salvar = useMutation({
    mutationFn: async (f: FormAtividade) => {
      const payload = {
        dia_semana: f.dia_semana,
        titulo: f.titulo.trim(),
        horario: f.horario || null,
        descricao: f.descricao.trim() || null,
        colaboradora_id: f.colaboradora_id === SEM_COLABORADORA ? null : Number(f.colaboradora_id),
      };
      const query = f.id
        ? db.from("atividades_enfermagem").update(payload).eq("id", f.id)
        : db.from("atividades_enfermagem").insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atividade salva.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["atividades-enfermagem"] });
    },
    onError: (e: Error) => toast.error(`Não foi possível salvar: ${e.message}`),
  });
  const excluir = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await db.from("atividades_enfermagem").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atividade excluída.");
      queryClient.invalidateQueries({ queryKey: ["atividades-enfermagem"] });
    },
    onError: (e: Error) => toast.error(`Não foi possível excluir: ${e.message}`),
  });
  if (!carregandoSessao && !isAdmin && !temModulo("enfermagem"))
    return (
      <AppShell titulo="Atividades">
        <p className="p-6 text-sm text-muted-foreground">
          Você não tem acesso às atividades da Enfermagem.
        </p>
      </AppShell>
    );
  const lista = atividades.data ?? [];
  return (
    <AppShell titulo="Atividades">
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Cronograma semanal de atividades</h1>
            <p className="text-sm text-muted-foreground">
              Rotina recorrente de segunda a sexta-feira
            </p>
          </div>
          {podeEditar && (
            <Button onClick={() => setForm(novoForm())}>
              <Plus className="mr-2 size-4" />
              Nova atividade
            </Button>
          )}
        </header>
        {atividades.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : atividades.isError ? (
          <p className="text-sm text-destructive">
            Erro ao carregar atividades. {(atividades.error as Error).message}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {DIAS.map((dia, indice) => {
              const itens = lista.filter((a) => a.dia_semana === indice + 1);
              return (
                <section key={dia} className="min-h-48 rounded-xl border bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold">{dia}</h2>
                    {podeEditar && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Adicionar atividade ${dia}`}
                        onClick={() => setForm(novoForm(indice + 1))}
                      >
                        <Plus className="size-4" />
                      </Button>
                    )}
                  </div>
                  {!itens.length ? (
                    <p className="py-5 text-sm text-muted-foreground">
                      Nenhuma atividade cadastrada.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {itens.map((item) => (
                        <li key={item.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium">{item.titulo}</p>
                              {item.horario && (
                                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                  <CalendarDays className="size-3" />
                                  {item.horario.slice(0, 5)}
                                </p>
                              )}
                            </div>
                            {podeEditar && (
                              <div className="flex shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Editar atividade"
                                  onClick={() =>
                                    setForm({
                                      id: item.id,
                                      dia_semana: item.dia_semana,
                                      titulo: item.titulo,
                                      horario: item.horario?.slice(0, 5) ?? "",
                                      descricao: item.descricao ?? "",
                                      colaboradora_id:
                                        item.colaboradora_id == null
                                          ? SEM_COLABORADORA
                                          : String(item.colaboradora_id),
                                    })
                                  }
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Excluir atividade"
                                  onClick={() => {
                                    if (window.confirm(`Excluir a atividade “${item.titulo}”?`))
                                      excluir.mutate(item.id);
                                  }}
                                >
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </div>
                          {item.descricao && (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                              {item.descricao}
                            </p>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground">
                            Responsável: {item.colaboradoras?.nome ?? "Não atribuída"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
      <Dialog
        open={!!form}
        onOpenChange={(open) => {
          if (!open && !salvar.isPending) setForm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar atividade" : "Nova atividade"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (form.titulo.trim()) salvar.mutate(form);
              }}
            >
              <div className="space-y-2">
                <Label>Dia da semana</Label>
                <Select
                  value={String(form.dia_semana)}
                  onValueChange={(v) => setForm({ ...form, dia_semana: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS.map((dia, i) => (
                      <SelectItem key={dia} value={String(i + 1)}>
                        {dia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="atividade-titulo">Atividade</Label>
                <Input
                  id="atividade-titulo"
                  required
                  maxLength={180}
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex.: Preparar sala de procedimentos"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="atividade-horario">Horário (opcional)</Label>
                <Input
                  id="atividade-horario"
                  type="time"
                  value={form.horario}
                  onChange={(e) => setForm({ ...form, horario: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Colaboradora responsável</Label>
                <Select
                  value={form.colaboradora_id}
                  onValueChange={(v) => setForm({ ...form, colaboradora_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma colaboradora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_COLABORADORA}>Não atribuída</SelectItem>
                    {(apoio.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.apelido || c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {apoio.data?.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma colaboradora ativa de Enfermagem cadastrada.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="atividade-descricao">Descrição / observações (opcional)</Label>
                <Textarea
                  id="atividade-descricao"
                  maxLength={2000}
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvar.isPending || !form.titulo.trim()}>
                  {salvar.isPending ? "Salvando…" : "Salvar atividade"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
