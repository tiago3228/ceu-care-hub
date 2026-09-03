import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CalendarPlus, Wand2, Trash2, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { isoParaBr } from "@/lib/datas";
import {
  excluirEscala,
  gerarPelaEscalaBase,
  obterApoioEscala,
  obterSemana,
  salvarEscala,
  sugerirColaboradoras,
} from "@/lib/escala.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/escala")({
  head: () => ({
    meta: [
      { title: "Escala semanal | Clínica CEU" },
      {
        name: "description",
        content:
          "Montagem da escala semanal por sala e médico, com sugestão de colaboradoras, alerta de conflitos e compatibilidade.",
      },
      { property: "og:title", content: "Escala semanal | Clínica CEU" },
      {
        property: "og:description",
        content: "Grade semanal de salas, médicos e colaboradoras da Clínica CEU.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaEscala,
});

const NOMES_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const SEM_VALOR = "__nenhum__";

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

interface SalaRef { id: number; nome: string }
interface MedicoRef { id: number; nome: string; apelido: string | null; necessita_experiente: boolean }
interface ColabRef { id: number; nome: string }
interface SugestaoRef {
  id: number;
  nome: string;
  pontos: number;
  motivos: string[];
  alertasCompatibilidade: string[];
  indisponivel: boolean;
}
interface EscalaRef {
  id: number;
  data: string;
  sala_id: number | null;
  medico_id: number | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  observacoes: string | null;
  status_compatibilidade: string;
  motivo_alerta: string | null;
  escala_colaboradoras: { colaboradora_id: number }[] | null;
}

interface FormEscala {
  id: number | null;
  data: string;
  salaId: string;
  medicoId: string;
  horarioInicio: string;
  horarioFim: string;
  observacoes: string;
  colaboradoraIds: number[];
}

const CORES_STATUS: Record<string, string> = {
  verde: "bg-emerald-500",
  amarelo: "bg-amber-500",
  vermelho: "bg-destructive",
};

function PaginaEscala() {
  const { temModulo, somenteLeitura, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [inicio, setInicio] = useState(() => segundaDaSemana(new Date()).toISOString().slice(0, 10));
  const fim = somarDias(inicio, 6);

  const [form, setForm] = useState<FormEscala | null>(null);
  const [alertas, setAlertas] = useState<string[]>([]);

  const apoio = useQuery({ queryKey: ["escala-apoio"], queryFn: () => obterApoioEscala() });
  const semana = useQuery({
    queryKey: ["escala-semana", inicio],
    queryFn: () => obterSemana({ data: { inicio, fim } }),
  });

  const sugestoes = useQuery({
    queryKey: ["escala-sugestoes", form?.data, form?.medicoId, form?.salaId],
    enabled: !!form,
    queryFn: () =>
      sugerirColaboradoras({
        data: {
          data: form!.data,
          medicoId: form!.medicoId ? Number(form!.medicoId) : null,
          salaId: form!.salaId ? Number(form!.salaId) : null,
        },
      }),
  });

  const salas = (apoio.data?.salas ?? []) as SalaRef[];
  const medicos = (apoio.data?.medicos ?? []) as MedicoRef[];
  const colaboradoras = (apoio.data?.colaboradoras ?? []) as ColabRef[];
  const listaSugestoes = (sugestoes.data ?? []) as SugestaoRef[];
  const escalasSemana = (semana.data?.escalas ?? []) as EscalaRef[];

  const nomeSala = (id: number | null) => salas.find((s) => s.id === id)?.nome ?? "Sem sala";
  const nomeMedico = (id: number | null) =>
    medicos.find((m) => m.id === id)?.apelido || medicos.find((m) => m.id === id)?.nome || "Sem médico";
  const nomeColab = (id: number) => colaboradoras.find((c) => c.id === id)?.nome ?? `#${id}`;

  const dias = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const iso = somarDias(inicio, i);
        return {
          iso,
          rotulo: NOMES_DIA[new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? "",
          escalas: escalasSemana.filter((e) => e.data === iso),
        };
      }),
    [inicio, escalasSemana],
  );



  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["escala-semana"] });

  const salvar = useMutation({
    mutationFn: async (confirmar: boolean) => {
      const f = form!;
      return salvarEscala({
        data: {
          id: f.id,
          data: f.data,
          salaId: f.salaId ? Number(f.salaId) : null,
          medicoId: f.medicoId ? Number(f.medicoId) : null,
          horarioInicio: f.horarioInicio || null,
          horarioFim: f.horarioFim || null,
          observacoes: f.observacoes || null,
          colaboradoraIds: f.colaboradoraIds,
          confirmarAlertas: confirmar,
        },
      });
    },
    onSuccess: (r) => {
      if (!r.salvo) {
        setAlertas(r.alertas);
        return;
      }
      toast.success(r.alertas.length ? "Escala salva com alertas confirmados." : "Escala salva.");
      setAlertas([]);
      setForm(null);
      invalidar();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const excluir = useMutation({
    mutationFn: (id: number) => excluirEscala({ data: { id } }),
    onSuccess: () => {
      toast.success("Escala excluída.");
      invalidar();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const gerarBase = useMutation({
    mutationFn: () => gerarPelaEscalaBase({ data: { inicio } }),
    onSuccess: (r) => {
      toast.success(`${r.criadas} escala(s) criadas pela grade base. ${r.ignoradas} já existiam.`);
      invalidar();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function novaEscala(dataIso: string) {
    setForm({
      id: null,
      data: dataIso,
      salaId: "",
      medicoId: "",
      horarioInicio: "07:00",
      horarioFim: "17:00",
      observacoes: "",
      colaboradoraIds: [],
    });
  }

  if (!carregandoSessao && !temModulo("escalas")) {
    return (
      <AppShell titulo="Escala semanal">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso ao módulo de escalas. Fale com a coordenação.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Escala semanal"
      descricao={`Semana de ${isoParaBr(inicio)} a ${isoParaBr(fim)}`}
      acoes={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setInicio(somarDias(inicio, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInicio(segundaDaSemana(new Date()).toISOString().slice(0, 10))}
          >
            Hoje
          </Button>
          <Button variant="outline" size="icon" aria-label="Próxima semana" onClick={() => setInicio(somarDias(inicio, 7))}>
            <ChevronRight className="size-4" />
          </Button>
          {!somenteLeitura && (
            <>
              <Button variant="outline" size="sm" onClick={() => gerarBase.mutate()} disabled={gerarBase.isPending}>
                <Wand2 className="mr-1.5 size-4" /> Gerar pela base
              </Button>
              <Button size="sm" onClick={() => novaEscala(inicio)}>
                <CalendarPlus className="mr-1.5 size-4" /> Nova escala
              </Button>
            </>
          )}
        </div>
      }
    >
      {semana.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-4">
          {dias.map((dia) => (
            <section key={dia.iso} className="card-superficie flex min-h-40 flex-col p-4">
              <header className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{dia.rotulo}</p>
                  <p className="text-xs text-muted-foreground">{isoParaBr(dia.iso)}</p>
                </div>
                {!somenteLeitura && (
                  <Button variant="ghost" size="sm" onClick={() => novaEscala(dia.iso)}>
                    + Escala
                  </Button>
                )}
              </header>
              <ul className="mt-3 space-y-2">
                {dia.escalas.length === 0 && (
                  <li className="text-xs text-muted-foreground">Nenhuma escala neste dia.</li>
                )}
                {dia.escalas.map((e) => (
                  <li key={e.id} className="rounded-md border border-border bg-secondary/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <span
                            className={`size-2 shrink-0 rounded-full ${CORES_STATUS[e.status_compatibilidade] ?? "bg-muted-foreground"}`}
                            aria-label={`Compatibilidade ${e.status_compatibilidade}`}
                          />
                          <span className="truncate">{nomeSala(e.sala_id)}</span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {nomeMedico(e.medico_id)}
                          {e.horario_inicio ? ` • ${e.horario_inicio}${e.horario_fim ? `–${e.horario_fim}` : ""}` : ""}
                        </p>
                      </div>
                      {!somenteLeitura && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar escala"
                            onClick={() =>
                              setForm({
                                id: e.id,
                                data: e.data,
                                salaId: e.sala_id ? String(e.sala_id) : "",
                                medicoId: e.medico_id ? String(e.medico_id) : "",
                                horarioInicio: e.horario_inicio ?? "",
                                horarioFim: e.horario_fim ?? "",
                                observacoes: e.observacoes ?? "",
                                colaboradoraIds: (e.escala_colaboradoras ?? []).map(
                                  (c) => c.colaboradora_id,
                                ),
                              })
                            }
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Excluir escala"
                            onClick={() => excluir.mutate(e.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(e.escala_colaboradoras ?? []).map((c) => (
                        <Badge key={c.colaboradora_id} variant="outline" className="text-[10px]">
                          {nomeColab(c.colaboradora_id)}
                        </Badge>
                      ))}
                    </div>
                    {e.motivo_alerta && (
                      <p className="mt-2 text-[11px] leading-snug text-amber-600">{e.motivo_alerta}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar escala" : "Nova escala"}</DialogTitle>
            <DialogDescription>
              As sugestões são pontuadas pelo histórico e cadastro — nunca bloqueiam a escolha.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="e-data">Data</Label>
                  <Input
                    id="e-data"
                    type="date"
                    value={form.data}
                    onChange={(ev) => setForm({ ...form, data: ev.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sala</Label>
                  <Select
                    value={form.salaId || SEM_VALOR}
                    onValueChange={(v) => setForm({ ...form, salaId: v === SEM_VALOR ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_VALOR}>Sem sala</SelectItem>
                      {salas.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Médico</Label>
                  <Select
                    value={form.medicoId || SEM_VALOR}
                    onValueChange={(v) => setForm({ ...form, medicoId: v === SEM_VALOR ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={SEM_VALOR}>Sem médico</SelectItem>
                      {medicos.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.nome}
                          {m.necessita_experiente ? " (exige experiente)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="e-ini">Início</Label>
                    <Input
                      id="e-ini"
                      type="time"
                      value={form.horarioInicio}
                      onChange={(ev) => setForm({ ...form, horarioInicio: ev.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="e-fim">Fim</Label>
                    <Input
                      id="e-fim"
                      type="time"
                      value={form.horarioFim}
                      onChange={(ev) => setForm({ ...form, horarioFim: ev.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Colaboradoras sugeridas</Label>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {sugestoes.isLoading && <Skeleton className="h-24 w-full" />}
                  {listaSugestoes.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60"
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={form.colaboradoraIds.includes(s.id)}
                        onCheckedChange={(v) =>
                          setForm({
                            ...form,
                            colaboradoraIds: v
                              ? [...form.colaboradoraIds, s.id]
                              : form.colaboradoraIds.filter((x) => x !== s.id),
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{s.nome}</span>
                          {s.pontos > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {s.pontos} pts
                            </Badge>
                          )}
                          {s.indisponivel && (
                            <Badge variant="destructive" className="text-[10px]">
                              ausente
                            </Badge>
                          )}
                        </span>
                        {!!s.motivos.length && (
                          <span className="block text-[11px] text-muted-foreground">
                            {s.motivos.join(" • ")}
                          </span>
                        )}
                        {!!s.alertasCompatibilidade.length && (
                          <span className="block text-[11px] text-amber-600">
                            {s.alertasCompatibilidade.join(" • ")}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e-obs">Observações</Label>
                <Textarea
                  id="e-obs"
                  maxLength={500}
                  value={form.observacoes}
                  onChange={(ev) => setForm({ ...form, observacoes: ev.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={() => salvar.mutate(false)} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar escala"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={alertas.length > 0} onOpenChange={(v) => !v && setAlertas([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alertas encontrados</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-left text-sm">
                {alertas.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar</AlertDialogCancel>
            <AlertDialogAction onClick={() => salvar.mutate(true)}>
              Salvar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
