import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { diaSemanaIso, isoParaBr, segundaDaSemanaAtual, somarDiasIso } from "@/lib/datas";

const db = supabase as any;
const NOMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
type Registro = {
  id: number;
  data: string;
  periodo: string | null;
  responsaveis: string | null;
  observacoes: string | null;
};
type Form = {
  id: number | null;
  data: string;
  periodo: string;
  responsaveis: string;
  observacoes: string;
};

export const Route = createFileRoute("/_authenticated/escala-marcacao")({
  head: () => ({ meta: [{ title: "Escala semanal da Marcação | Clínica CEU" }] }),
  component: PaginaEscalaMarcacao,
});

function PaginaEscalaMarcacao() {
  const { temModulo, somenteLeitura, isAdmin, isLoading: carregandoSessao } = useSessao();
  const podeVer =
    isAdmin || temModulo("escala_marcacao_visualizar") || temModulo("escala_marcacao_editar");
  const podeEditar = isAdmin || (!somenteLeitura && temModulo("escala_marcacao_editar"));
  const [inicio, setInicio] = useState(segundaDaSemanaAtual);
  const fim = somarDiasIso(inicio, 4);
  const [form, setForm] = useState<Form | null>(null);
  const queryClient = useQueryClient();
  const semana = useQuery({
    queryKey: ["escala-marcacao-semana", inicio],
    enabled: podeVer,
    queryFn: async () => {
      const result = await db
        .from("escalas_marcacao")
        .select("id,data,periodo,responsaveis,observacoes")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data")
        .order("periodo");
      if (result.error) throw result.error;
      return (result.data ?? []) as Registro[];
    },
  });
  const dias = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const data = somarDiasIso(inicio, i);
        return {
          data,
          nome: NOMES[diaSemanaIso(data)],
          registros: (semana.data ?? []).filter((item) => item.data === data),
        };
      }),
    [inicio, semana.data],
  );
  const salvar = useMutation({
    mutationFn: async (entrada: Form) => {
      const payload = {
        data: entrada.data,
        periodo: entrada.periodo.trim() || null,
        responsaveis: entrada.responsaveis.trim() || null,
        observacoes: entrada.observacoes.trim() || null,
      };
      const result = entrada.id
        ? await db.from("escalas_marcacao").update(payload).eq("id", entrada.id)
        : await db.from("escalas_marcacao").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("Escala da Marcação salva.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["escala-marcacao-semana"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a escala."),
  });
  const excluir = useMutation({
    mutationFn: async (id: number) => {
      const result = await db.from("escalas_marcacao").delete().eq("id", id);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("Registro removido.");
      queryClient.invalidateQueries({ queryKey: ["escala-marcacao-semana"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível remover o registro."),
  });
  function novo(data: string) {
    setForm({ id: null, data, periodo: "", responsaveis: "", observacoes: "" });
  }
  function editar(item: Registro) {
    setForm({
      id: item.id,
      data: item.data,
      periodo: item.periodo ?? "",
      responsaveis: item.responsaveis ?? "",
      observacoes: item.observacoes ?? "",
    });
  }
  if (!carregandoSessao && !podeVer)
    return (
      <AppShell titulo="Escala da Marcação">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem permissão para visualizar a Escala da Marcação.
        </div>
      </AppShell>
    );
  return (
    <AppShell
      titulo="Escala semanal da Marcação"
      descricao={`Semana de ${isoParaBr(inicio)} a ${isoParaBr(fim)}`}
      acoes={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setInicio(somarDiasIso(inicio, -7))}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setInicio(segundaDaSemanaAtual)}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setInicio(somarDiasIso(inicio, 7))}
            aria-label="Próxima semana"
          >
            <ChevronRight className="size-4" />
          </Button>
          {podeEditar && (
            <Button size="sm" onClick={() => novo(inicio)}>
              <CalendarPlus className="mr-1.5 size-4" /> Nova escala
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {dias.map((dia) => (
          <section key={dia.data} className="card-superficie min-h-48 p-4">
            <header className="flex items-start justify-between border-b border-border pb-2">
              <div>
                <p className="text-sm font-semibold">{dia.nome}</p>
                <p className="text-xs text-muted-foreground">{isoParaBr(dia.data)}</p>
              </div>
              {podeEditar && (
                <Button variant="ghost" size="sm" onClick={() => novo(dia.data)}>
                  + Escala
                </Button>
              )}
            </header>
            <div className="mt-3 space-y-2">
              {dia.registros.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum registro.</p>
              )}
              {dia.registros.map((item) => (
                <article
                  key={item.id}
                  className="rounded-md border border-border bg-secondary/40 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{item.periodo || "Período não informado"}</p>
                      {item.responsaveis && (
                        <p className="mt-1 whitespace-pre-wrap text-xs">{item.responsaveis}</p>
                      )}
                      {item.observacoes && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                          {item.observacoes}
                        </p>
                      )}
                    </div>
                    {podeEditar && (
                      <div className="flex shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => editar(item)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => excluir.mutate(item.id)}
                          aria-label="Excluir"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Dialog open={!!form} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form?.id ? "Editar escala da Marcação" : "Nova escala da Marcação"}
            </DialogTitle>
            <DialogDescription>
              Registre a equipe, o período e as observações do dia.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Período / turno</Label>
                <Input
                  placeholder="Ex.: Manhã, tarde ou 07:00–17:00"
                  value={form.periodo}
                  onChange={(e) => setForm({ ...form, periodo: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Responsáveis</Label>
                <Textarea
                  placeholder="Digite os nomes da equipe"
                  value={form.responsaveis}
                  onChange={(e) => setForm({ ...form, responsaveis: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
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
    </AppShell>
  );
}
