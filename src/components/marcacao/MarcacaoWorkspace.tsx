/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock3, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/hooks/use-sessao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MarcacaoWorkspaceAba = "escala" | "medicos" | "colaboradores";

type Medico = {
  id: number;
  nome: string;
  apelido: string | null;
  crm: string | null;
  especialidade_principal: string | null;
  especialidades: string | null;
  procedimentos: string | null;
  observacoes: string | null;
  ativo: boolean;
};
type Colaborador = {
  id: number;
  nome: string;
  cargo: string | null;
  entrada: string | null;
  saida: string | null;
  observacoes: string | null;
  ativo: boolean;
};
type Escala = {
  id: number;
  data: string;
  medico_id: number;
  horario_inicio: string | null;
  horario_fim: string | null;
  observacoes: string | null;
  medico?: Pick<Medico, "id" | "nome" | "especialidade_principal"> | null;
  marcacao_escala_colaboradores?:
    | {
        colaboradora?: Pick<Colaborador, "id" | "nome"> | null;
      }[]
    | null;
};

type FormEscala = {
  id: number | null;
  data: string;
  medico_id: string;
  horario_inicio: string;
  horario_fim: string;
  observacoes: string;
  colaboradora_ids: number[];
};

type FormMedico = {
  id: number | null;
  nome: string;
  apelido: string;
  crm: string;
  especialidade_principal: string;
  especialidades: string;
  procedimentos: string;
  observacoes: string;
  ativo: boolean;
};
type FormColaborador = {
  id: number | null;
  nome: string;
  cargo: string;
  entrada: string;
  saida: string;
  observacoes: string;
  ativo: boolean;
};

function paraISO(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function deISO(valor: string) {
  return new Date(`${valor}T12:00:00`);
}

function inicioDaSemana(data: Date) {
  const resultado = new Date(data);
  resultado.setHours(12, 0, 0, 0);
  resultado.setDate(resultado.getDate() - ((resultado.getDay() + 6) % 7));
  return resultado;
}

function formatarHorario(valor: string | null) {
  return valor ? valor.slice(0, 5) : "A combinar";
}

function formatarDataLonga(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(deISO(valor));
}

function novaFormEscala(data: string): FormEscala {
  return {
    id: null,
    data,
    medico_id: "",
    horario_inicio: "08:00",
    horario_fim: "17:00",
    observacoes: "",
    colaboradora_ids: [],
  };
}

function formatarErro(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export function MarcacaoWorkspace({ aba }: { aba: MarcacaoWorkspaceAba }) {
  if (aba === "escala") return <EscalaSemanal />;
  if (aba === "medicos") return <CatalogoMedicos />;
  return <CatalogoColaboradores />;
}

function EscalaSemanal() {
  const { temModulo, sessao, somenteLeitura, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const temAcesso = temModulo("marcacao_escala_visualizar");
  const podeAdicionar =
    !!sessao?.ativo && !somenteLeitura && sessao.modulos.includes("marcacao_escala_adicionar");
  const podeEditar =
    !!sessao?.ativo && !somenteLeitura && sessao.modulos.includes("marcacao_escala_editar");
  const podeExcluir =
    !!sessao?.ativo && !somenteLeitura && sessao.modulos.includes("marcacao_escala_excluir");
  const [semanaBase, setSemanaBase] = useState(() => inicioDaSemana(new Date()));
  const [diaSelecionado, setDiaSelecionado] = useState(() => paraISO(new Date()));
  const [dialogAberto, setDialogAberto] = useState(false);
  const [form, setForm] = useState<FormEscala>(() => novaFormEscala(paraISO(new Date())));
  const inicio = paraISO(semanaBase);
  const fimSemanaDate = new Date(semanaBase);
  fimSemanaDate.setDate(fimSemanaDate.getDate() + 6);
  const fim = paraISO(fimSemanaDate);
  const dias = useMemo(
    () =>
      Array.from({ length: 7 }, (_, indice) => {
        const data = new Date(semanaBase);
        data.setDate(data.getDate() + indice);
        return paraISO(data);
      }),
    [semanaBase],
  );

  const escalas = useQuery({
    queryKey: ["marcacao", "escalas", inicio],
    enabled: temAcesso,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("marcacao_escalas")
        .select(
          "id,data,medico_id,horario_inicio,horario_fim,observacoes,medico:marcacao_medicos(id,nome,especialidade_principal),marcacao_escala_colaboradores(colaboradora:marcacao_colaboradores(id,nome))",
        )
        .gte("data", inicio)
        .lte("data", fim)
        .order("data")
        .order("horario_inicio");
      if (error) throw error;
      return (data ?? []) as Escala[];
    },
  });

  const medicos = useQuery({
    queryKey: ["marcacao", "medicos", "ativos"],
    enabled: temAcesso && dialogAberto,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("marcacao_medicos")
        .select("id,nome,especialidade_principal")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Pick<Medico, "id" | "nome" | "especialidade_principal">[];
    },
  });

  const colaboradores = useQuery({
    queryKey: ["marcacao", "colaboradores", "ativos"],
    enabled: temAcesso && dialogAberto,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("marcacao_colaboradores")
        .select("id,nome,cargo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Pick<Colaborador, "id" | "nome" | "cargo">[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.data || !form.medico_id) throw new Error("Informe a data e selecione um médico.");
      if (form.horario_inicio && form.horario_fim && form.horario_fim <= form.horario_inicio) {
        throw new Error("O horário final precisa ser posterior ao inicial.");
      }
      const { error } = await (supabase as any).rpc("salvar_marcacao_escala", {
        p_id: form.id,
        p_data: form.data,
        p_medico_id: Number(form.medico_id),
        p_horario_inicio: form.horario_inicio || null,
        p_horario_fim: form.horario_fim || null,
        p_observacoes: form.observacoes || null,
        p_colaboradora_ids: form.colaboradora_ids,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escala salva.");
      setDialogAberto(false);
      void queryClient.invalidateQueries({ queryKey: ["marcacao", "escalas"] });
    },
    onError: (error) => toast.error(formatarErro(error)),
  });

  const excluir = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any).from("marcacao_escalas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escala excluída e enviada à lixeira.");
      void queryClient.invalidateQueries({ queryKey: ["marcacao", "escalas"] });
    },
    onError: (error) => toast.error(formatarErro(error)),
  });

  function abrirNova(data: string) {
    setForm(novaFormEscala(data));
    setDialogAberto(true);
  }

  function abrirEdicao(escala: Escala) {
    setForm({
      id: escala.id,
      data: escala.data,
      medico_id: String(escala.medico_id),
      horario_inicio:
        formatarHorario(escala.horario_inicio) === "A combinar"
          ? ""
          : formatarHorario(escala.horario_inicio),
      horario_fim:
        formatarHorario(escala.horario_fim) === "A combinar"
          ? ""
          : formatarHorario(escala.horario_fim),
      observacoes: escala.observacoes ?? "",
      colaboradora_ids: (escala.marcacao_escala_colaboradores ?? [])
        .map((vinculo) => vinculo.colaboradora?.id)
        .filter((id): id is number => typeof id === "number"),
    });
    setDialogAberto(true);
  }

  function confirmarExclusao(escala: Escala) {
    if (
      window.confirm(
        `Excluir a escala de ${escala.medico?.nome ?? "médico"} em ${formatarDataLonga(escala.data)}? Ela ficará disponível na Lixeira por 7 dias.`,
      )
    ) {
      excluir.mutate(escala.id);
    }
  }

  function trocarSemana(direcao: -1 | 1) {
    const nova = new Date(semanaBase);
    nova.setDate(nova.getDate() + direcao * 7);
    setSemanaBase(nova);
  }

  const itens = escalas.data ?? [];
  const labelRange = `${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(semanaBase)} – ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(fimSemanaDate)}`;

  if (!carregandoSessao && !temAcesso) {
    return (
      <div className="card-superficie p-6 text-sm">
        Você não tem permissão para visualizar a escala de Marcação.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Escala semanal</h2>
          <p className="text-sm text-muted-foreground">
            {labelRange} · equipe e médico de cada turno
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Semana anterior"
            onClick={() => trocarSemana(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const hoje = inicioDaSemana(new Date());
              setSemanaBase(hoje);
              setDiaSelecionado(paraISO(new Date()));
            }}
          >
            Esta semana
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próxima semana"
            onClick={() => trocarSemana(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          {podeAdicionar && (
            <Button onClick={() => abrirNova(diaSelecionado)}>
              <Plus className="mr-1.5 size-4" /> Adicionar turno
            </Button>
          )}
        </div>
      </div>

      {!podeEditar && !podeAdicionar && (
        <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          A escala é somente para visualização no seu perfil. Para ajustes, fale com a coordenação
          da Marcação.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {dias.map((data) => {
          const doDia = itens.filter((item) => item.data === data);
          const selecionado = data === diaSelecionado;
          return (
            <section
              key={data}
              className={`card-superficie overflow-hidden ${selecionado ? "ring-1 ring-primary/40" : ""}`}
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/20 px-4 py-3">
                <button type="button" className="text-left" onClick={() => setDiaSelecionado(data)}>
                  <span className="block font-semibold capitalize">{formatarDataLonga(data)}</span>
                  <span className="text-xs text-muted-foreground">
                    {doDia.length} {doDia.length === 1 ? "turno" : "turnos"}
                  </span>
                </button>
                {podeAdicionar && (
                  <Button size="sm" variant="outline" onClick={() => abrirNova(data)}>
                    <Plus className="mr-1 size-3.5" /> Turno
                  </Button>
                )}
              </header>
              <div className="space-y-3 p-3">
                {escalas.isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : doDia.length ? (
                  doDia.map((escala) => (
                    <article
                      key={escala.id}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {escala.medico?.nome ?? "Médico não definido"}
                          </p>
                          {escala.medico?.especialidade_principal && (
                            <p className="text-xs text-muted-foreground">
                              {escala.medico.especialidade_principal}
                            </p>
                          )}
                          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock3 className="size-3.5" />
                            {formatarHorario(escala.horario_inicio)} –{" "}
                            {formatarHorario(escala.horario_fim)}
                          </p>
                        </div>
                        {(podeEditar || podeExcluir) && (
                          <div className="flex shrink-0 gap-1">
                            {podeEditar && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Editar turno"
                                onClick={() => abrirEdicao(escala)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            )}
                            {podeExcluir && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Excluir turno"
                                onClick={() => confirmarExclusao(escala)}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(escala.marcacao_escala_colaboradores ?? []).map((vinculo) =>
                          vinculo.colaboradora ? (
                            <Badge key={vinculo.colaboradora.id} variant="secondary">
                              <UserRound className="mr-1 size-3" />
                              {vinculo.colaboradora.nome}
                            </Badge>
                          ) : null,
                        )}
                        {!escala.marcacao_escala_colaboradores?.length && (
                          <span className="text-xs text-muted-foreground">Equipe a definir</span>
                        )}
                      </div>
                      {escala.observacoes && (
                        <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                          {escala.observacoes}
                        </p>
                      )}
                    </article>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhum turno cadastrado para este dia.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar turno" : "Adicionar turno à escala"}</DialogTitle>
            <DialogDescription>
              As alterações são salvas na escala independente da Marcação.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              salvar.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="marcacao-data">Data</Label>
                <Input
                  id="marcacao-data"
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Médico</Label>
                <Select
                  value={form.medico_id}
                  onValueChange={(medico_id) => setForm({ ...form, medico_id })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um médico" />
                  </SelectTrigger>
                  <SelectContent>
                    {(medicos.data ?? []).map((medico) => (
                      <SelectItem key={medico.id} value={String(medico.id)}>
                        {medico.nome}
                        {medico.especialidade_principal
                          ? ` · ${medico.especialidade_principal}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!medicos.isLoading && !medicos.data?.length && (
                  <p className="text-xs text-muted-foreground">
                    Cadastre médicos ativos na aba Médicos antes de montar a escala.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="marcacao-inicio">Início</Label>
                <Input
                  id="marcacao-inicio"
                  type="time"
                  value={form.horario_inicio}
                  onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="marcacao-fim">Término</Label>
                <Input
                  id="marcacao-fim"
                  type="time"
                  value={form.horario_fim}
                  onChange={(e) => setForm({ ...form, horario_fim: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Colaboradores do turno</Label>
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                {colaboradores.isLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (colaboradores.data ?? []).length ? (
                  (colaboradores.data ?? []).map((colaborador) => (
                    <label
                      key={colaborador.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={form.colaboradora_ids.includes(colaborador.id)}
                        onCheckedChange={(checked) =>
                          setForm({
                            ...form,
                            colaboradora_ids: checked
                              ? [...new Set([...form.colaboradora_ids, colaborador.id])]
                              : form.colaboradora_ids.filter((id) => id !== colaborador.id),
                          })
                        }
                      />
                      <span>{colaborador.nome}</span>
                      {colaborador.cargo && (
                        <span className="text-xs text-muted-foreground">· {colaborador.cargo}</span>
                      )}
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Cadastre colaboradores ativos na aba Colaboradores.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="marcacao-observacoes">Observações</Label>
              <Input
                id="marcacao-observacoes"
                maxLength={1000}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Orientações para o turno (opcional)"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvar.isPending || !medicos.data?.length}>
                {salvar.isPending ? "Salvando…" : "Salvar escala"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CatalogoMedicos() {
  const { isAdmin } = useSessao();
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [form, setForm] = useState<FormMedico>({
    id: null,
    nome: "",
    apelido: "",
    crm: "",
    especialidade_principal: "",
    especialidades: "",
    procedimentos: "",
    observacoes: "",
    ativo: true,
  });
  const query = useQuery({
    queryKey: ["marcacao", "medicos", isAdmin],
    queryFn: async () => {
      let request = (supabase as any)
        .from("marcacao_medicos")
        .select(
          "id,nome,apelido,crm,especialidade_principal,especialidades,procedimentos,observacoes,ativo",
        )
        .order("nome");
      if (!isAdmin) request = request.eq("ativo", true);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as Medico[];
    },
  });
  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome do médico.");
      const payload = {
        nome: form.nome.trim(),
        apelido: form.apelido.trim() || null,
        crm: form.crm.trim() || null,
        especialidade_principal: form.especialidade_principal.trim() || null,
        especialidades: form.especialidades.trim() || null,
        procedimentos: form.procedimentos.trim() || null,
        observacoes: form.observacoes.trim() || null,
        ativo: form.ativo,
      };
      const result = form.id
        ? await (supabase as any).from("marcacao_medicos").update(payload).eq("id", form.id)
        : await (supabase as any).from("marcacao_medicos").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("Cadastro do médico salvo.");
      setDialogAberto(false);
      void queryClient.invalidateQueries({ queryKey: ["marcacao", "medicos"] });
    },
    onError: (error) => toast.error(formatarErro(error)),
  });
  function abrir(medico?: Medico) {
    setForm(
      medico
        ? {
            id: medico.id,
            nome: medico.nome,
            apelido: medico.apelido ?? "",
            crm: medico.crm ?? "",
            especialidade_principal: medico.especialidade_principal ?? "",
            especialidades: medico.especialidades ?? "",
            procedimentos: medico.procedimentos ?? "",
            observacoes: medico.observacoes ?? "",
            ativo: medico.ativo,
          }
        : {
            id: null,
            nome: "",
            apelido: "",
            crm: "",
            especialidade_principal: "",
            especialidades: "",
            procedimentos: "",
            observacoes: "",
            ativo: true,
          },
    );
    setDialogAberto(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Médicos da Marcação</h2>
          <p className="text-sm text-muted-foreground">
            Cadastro próprio do setor, sem compartilhar alterações com Salas ou Enfermagem.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => abrir()}>
            <Plus className="mr-1.5 size-4" /> Novo médico
          </Button>
        )}
      </div>
      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : query.data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {query.data.map((medico) => (
            <article key={medico.id} className="card-superficie p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{medico.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    {medico.especialidade_principal ?? "Especialidade não informada"}
                  </p>
                </div>
                <Badge variant={medico.ativo ? "secondary" : "outline"}>
                  {medico.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {medico.apelido && <p>Como aparece na escala: {medico.apelido}</p>}
                {medico.crm && <p>CRM: {medico.crm}</p>}
                {medico.procedimentos && (
                  <p className="line-clamp-2">Procedimentos: {medico.procedimentos}</p>
                )}
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => abrir(medico)}>
                  <Pencil className="mr-1.5 size-3.5" /> Editar
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="card-superficie p-8 text-center text-sm text-muted-foreground">
          Nenhum médico cadastrado.
        </div>
      )}
      {!isAdmin && (
        <p className="text-xs text-muted-foreground">
          Visualização somente leitura. Solicite ao administrador a inclusão ou correção de
          cadastros.
        </p>
      )}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar médico" : "Novo médico"}</DialogTitle>
            <DialogDescription>
              Este cadastro pertence exclusivamente ao módulo Marcação.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              salvar.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  maxLength={160}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nome curto na escala</Label>
                <Input
                  value={form.apelido}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, apelido: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CRM</Label>
                <Input
                  value={form.crm}
                  maxLength={40}
                  onChange={(e) => setForm({ ...form, crm: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Especialidade principal</Label>
                <Input
                  value={form.especialidade_principal}
                  maxLength={160}
                  onChange={(e) => setForm({ ...form, especialidade_principal: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Outras especialidades</Label>
                <Input
                  value={form.especialidades}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, especialidades: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Procedimentos atendidos</Label>
                <Input
                  value={form.procedimentos}
                  maxLength={1000}
                  onChange={(e) => setForm({ ...form, procedimentos: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <Input
                  value={form.observacoes}
                  maxLength={1000}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.ativo}
                onCheckedChange={(ativo) => setForm({ ...form, ativo: !!ativo })}
              />{" "}
              Médico ativo para novas escalas
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CatalogoColaboradores() {
  const { isAdmin } = useSessao();
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [form, setForm] = useState<FormColaborador>({
    id: null,
    nome: "",
    cargo: "",
    entrada: "",
    saida: "",
    observacoes: "",
    ativo: true,
  });
  const query = useQuery({
    queryKey: ["marcacao", "colaboradores", isAdmin],
    queryFn: async () => {
      let request = (supabase as any)
        .from("marcacao_colaboradores")
        .select("id,nome,cargo,entrada,saida,observacoes,ativo")
        .order("nome");
      if (!isAdmin) request = request.eq("ativo", true);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as Colaborador[];
    },
  });
  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome do colaborador.");
      const payload = {
        nome: form.nome.trim(),
        cargo: form.cargo.trim() || null,
        entrada: form.entrada || null,
        saida: form.saida || null,
        observacoes: form.observacoes.trim() || null,
        ativo: form.ativo,
      };
      const result = form.id
        ? await (supabase as any).from("marcacao_colaboradores").update(payload).eq("id", form.id)
        : await (supabase as any).from("marcacao_colaboradores").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("Cadastro do colaborador salvo.");
      setDialogAberto(false);
      void queryClient.invalidateQueries({ queryKey: ["marcacao", "colaboradores"] });
      void queryClient.invalidateQueries({ queryKey: ["marcacao", "colaboradores", "ativos"] });
    },
    onError: (error) => toast.error(formatarErro(error)),
  });
  function abrir(colaborador?: Colaborador) {
    setForm(
      colaborador
        ? {
            id: colaborador.id,
            nome: colaborador.nome,
            cargo: colaborador.cargo ?? "",
            entrada: colaborador.entrada?.slice(0, 5) ?? "",
            saida: colaborador.saida?.slice(0, 5) ?? "",
            observacoes: colaborador.observacoes ?? "",
            ativo: colaborador.ativo,
          }
        : { id: null, nome: "", cargo: "", entrada: "", saida: "", observacoes: "", ativo: true },
    );
    setDialogAberto(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Colaboradores da Marcação</h2>
          <p className="text-sm text-muted-foreground">
            Lista própria para compor os turnos da escala deste setor.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => abrir()}>
            <Plus className="mr-1.5 size-4" /> Novo colaborador
          </Button>
        )}
      </div>
      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : query.data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {query.data.map((colaborador) => (
            <article key={colaborador.id} className="card-superficie p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{colaborador.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    {colaborador.cargo ?? "Cargo não informado"}
                  </p>
                </div>
                <Badge variant={colaborador.ativo ? "secondary" : "outline"}>
                  {colaborador.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              {(colaborador.entrada || colaborador.saida) && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  {formatarHorario(colaborador.entrada)} – {formatarHorario(colaborador.saida)}
                </p>
              )}
              {colaborador.observacoes && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {colaborador.observacoes}
                </p>
              )}
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => abrir(colaborador)}
                >
                  <Pencil className="mr-1.5 size-3.5" /> Editar
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="card-superficie p-8 text-center text-sm text-muted-foreground">
          Nenhum colaborador cadastrado.
        </div>
      )}
      {!isAdmin && (
        <p className="text-xs text-muted-foreground">
          Visualização somente leitura. Solicite ao administrador a inclusão ou correção de
          cadastros.
        </p>
      )}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar colaborador" : "Novo colaborador"}</DialogTitle>
            <DialogDescription>Este cadastro é independente dos demais setores.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              salvar.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  maxLength={160}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Cargo ou função</Label>
                <Input
                  value={form.cargo}
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Entrada habitual</Label>
                <Input
                  type="time"
                  value={form.entrada}
                  onChange={(e) => setForm({ ...form, entrada: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Saída habitual</Label>
                <Input
                  type="time"
                  value={form.saida}
                  onChange={(e) => setForm({ ...form, saida: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <Input
                  value={form.observacoes}
                  maxLength={1000}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.ativo}
                onCheckedChange={(ativo) => setForm({ ...form, ativo: !!ativo })}
              />{" "}
              Colaborador ativo para novas escalas
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
