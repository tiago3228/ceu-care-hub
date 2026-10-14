/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarHeart,
  CalendarClock,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  HelpCircle,
  Search,
  Sparkles,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  criarTarefaAutomacao,
  cancelarTarefaAutomacao,
  aprovarTarefaAutomacao,
} from "@/lib/agendamento-automacao.functions";
import {
  listarSugestoesAgendamento,
  responderAjuda as buscarParticularidades,
  temParticularidades as temParticularidadesCadastradas,
} from "@/lib/agendamento-busca";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import regras from "@/data/medicos-regras-agendamento.json";

export const Route = createFileRoute("/_authenticated/agendamento-marcacao")({
  head: () => ({ meta: [{ title: "Agendamento | Clínica CEU" }] }),
  component: PaginaAgendamentoMarcacao,
});

type Medico = {
  id: string;
  name: string;
  aliases?: string[];
  crm: string;
  rqe?: string;
  specialty?: string | null;
  schedules?: string[];
  generalRules?: string[];
  notPerformed?: string[];
  insuranceRestrictions?: string[];
  ultrasoundRules?: string[];
  densitometry?: string[];
  conflicts?: string[];
  interventions?: string[];
  elastography?: string[];
  exams: { name: string; slots: unknown; conditions?: string[] }[];
};
const MEDICOS_DA_BASE = regras.doctors as unknown as Medico[];
type ParticularidadesEditadas = Partial<
  Pick<
    Medico,
    "schedules" | "generalRules" | "notPerformed" | "insuranceRestrictions" | "conflicts"
  >
>;
type TarefaAutomacao = {
  id: string;
  status: string;
  medico_nome: string;
  exame: string | null;
  convenio: string | null;
  idade: number | null;
  turno: string | null;
  opcoes_horarios: Array<Record<string, unknown>> | null;
  horario_escolhido: Record<string, unknown> | null;
  protocolo: string | null;
  erro: string | null;
  criado_em: string;
};
const TURNOS = ["Todos", "Manhã", "Tarde", "Noite"];

function normalizar(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function listaDeTexto(medico: Medico) {
  return [
    ...(medico.generalRules ?? []),
    ...(medico.notPerformed ?? []),
    ...(medico.ultrasoundRules ?? []),
    ...(medico.densitometry ?? []),
    ...(medico.insuranceRestrictions ?? []),
    ...(medico.schedules ?? []),
    ...(medico.interventions ?? []),
    ...(medico.elastography ?? []),
    ...medico.exams.flatMap((e) => [e.name, ...(e.conditions ?? [])]),
  ].join(" ");
}
function medicoPassaNosFiltros(
  medico: Medico,
  filtros: { exame: string; pagamento: string; idade: string; turno: string; solicitante: string },
) {
  const texto = normalizar(listaDeTexto(medico));
  const exame = normalizar(filtros.exame.trim());
  const pagamento = normalizar(filtros.pagamento.trim());
  const solicitante = normalizar(filtros.solicitante.trim());
  const idade = Number(filtros.idade);
  const exames = medico.exams ?? [];
  if (
    exame &&
    !exames.some((item) =>
      normalizar(`${item.name} ${(item.conditions ?? []).join(" ")}`).includes(exame),
    )
  )
    return false;
  if (pagamento && pagamento !== "todos") {
    const somenteParticular = /somente particular|apenas particular|exclusivamente particular/.test(
      texto,
    );
    const bloqueiaConvenio = /nao atende.*(convenio|plano)|nao realiza.*(convenio|plano)/.test(
      texto,
    );
    if (
      (pagamento.includes("unimed") ||
        pagamento.includes("convenio") ||
        pagamento.includes("plano")) &&
      (somenteParticular || bloqueiaConvenio)
    )
      return false;
    const posicao = texto.indexOf(pagamento);
    if (
      posicao >= 0 &&
      /nao atende|nao realiza|suspensa/.test(
        texto.slice(Math.max(0, posicao - 80), posicao + pagamento.length + 120),
      )
    )
      return false;
  }
  if (idade > 0) {
    const minimos = [...texto.matchAll(/a partir de (\d+) anos/g)].map((match) => Number(match[1]));
    if (minimos.some((minimo) => idade < minimo)) return false;
    const faixas = [...texto.matchAll(/(\d+) a (\d+) anos/g)].map((match) => [
      Number(match[1]),
      Number(match[2]),
    ]);
    if (faixas.some(([minimo, maximo]) => idade < minimo || idade > maximo)) return false;
  }
  if (filtros.turno !== "Todos") {
    const turno = normalizar(filtros.turno);
    if (
      turno === "manha" &&
      /somente a tarde|somente tarde/.test(texto) &&
      !/manha.*tarde/.test(texto)
    )
      return false;
    if (
      turno === "tarde" &&
      /somente pela manha|somente de manha|somente manha/.test(texto) &&
      !/manha.*tarde/.test(texto)
    )
      return false;
  }
  if (solicitante && texto.includes(solicitante) && /nao atende|nao agendar/.test(texto))
    return false;
  return true;
}
function primeiroResumo(medico: Medico) {
  const itens = [
    ...(medico.schedules ?? []).slice(0, 1),
    ...(medico.generalRules ?? [])
      .filter((r) =>
        /idade|pedido|particular|convênio|convenio|sábado|sabado|manhã|manha|tarde|limite/i.test(r),
      )
      .slice(0, 4),
    ...(medico.notPerformed ?? []).slice(0, 2).map((r) => `Não realiza: ${r}`),
  ];
  return Array.from(new Set(itens)).slice(0, 7);
}
function PaginaAgendamentoMarcacao() {
  const { temModulo, isAdmin, sessao, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const podeVer =
    isAdmin ||
    temModulo("agendamento_marcacao") ||
    temModulo("agendamento_marcacao_particularidades_editar");
  const podeEditarParticularidades =
    isAdmin || temModulo("agendamento_marcacao_particularidades_editar");
  const [buscaMedico, setBuscaMedico] = useState("");
  const [exame, setExame] = useState("");
  const [pagamento, setPagamento] = useState("");
  const [turno, setTurno] = useState("Todos");
  const [idade, setIdade] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [abaMedicos, setAbaMedicos] = useState<"com" | "sem">("com");
  const [medicoSelecionado, setMedicoSelecionado] = useState<Medico | null>(null);
  const [medicoDetalhesCompletos, setMedicoDetalhesCompletos] = useState<Medico | null>(null);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [medicoEscopoAjudaId, setMedicoEscopoAjudaId] = useState<string | null>(null);
  const [comoFuncionaAberto, setComoFuncionaAberto] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<
    (ReturnType<typeof buscarParticularidades> & { pergunta: string }) | null
  >(null);
  const perguntaInputRef = useRef<HTMLInputElement>(null);
  const [editorAberto, setEditorAberto] = useState(false);
  const [automacaoAberta, setAutomacaoAberta] = useState(false);
  const [tarefaCriada, setTarefaCriada] = useState<{ id: string; status: string } | null>(null);
  const [formParticularidades, setFormParticularidades] = useState<ParticularidadesEditadas>({});
  const [menuContexto, setMenuContexto] = useState<{
    medico: Medico;
    x: number;
    y: number;
  } | null>(null);
  const podeAutomatizar = isAdmin || temModulo("agendamento_marcacao_automacao");

  const particularidades = useQuery({
    queryKey: ["agendamento-particularidades-medicos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agendamento_medicos_particularidades")
        .select("chave, dados");
      if (error) throw error;
      return (data ?? []) as { chave: string; dados: ParticularidadesEditadas }[];
    },
    enabled: podeVer,
  });

  const tarefas = useQuery({
    queryKey: ["agendamento-automacao-tarefas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agendamento_automacao_tarefas")
        .select(
          "id,status,medico_nome,exame,convenio,idade,turno,opcoes_horarios,horario_escolhido,protocolo,erro,criado_em",
        )
        .order("criado_em", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as TarefaAutomacao[];
    },
    enabled: podeAutomatizar,
    refetchInterval: 10000,
  });

  const medicosBase = useMemo(
    () =>
      MEDICOS_DA_BASE.map((medico) => ({
        ...medico,
        ...(particularidades.data?.find((item) => item.chave === String(medico.id))?.dados ?? {}),
      })),
    [particularidades.data],
  );
  const sugestoesAgendamento = useMemo(
    () => listarSugestoesAgendamento(medicosBase),
    [medicosBase],
  );

  const salvarParticularidades = useMutation({
    mutationFn: async (medico: Medico) => {
      const { error } = await (supabase as any).from("agendamento_medicos_particularidades").upsert(
        {
          chave: String(medico.id),
          nome_medico: medico.name,
          dados: formParticularidades,
          atualizado_por: sessao?.userId,
        },
        { onConflict: "chave" },
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agendamento-particularidades-medicos"] });
      setEditorAberto(false);
      toast.success("Particularidades atualizadas com sucesso.");
    },
    onError: (error: Error) => toast.error(`Não foi possível salvar: ${error.message}`),
  });

  const criarAutomacao = useMutation({
    mutationFn: async () => {
      if (!medicoSelecionado) throw new Error("Selecione um médico antes de criar a tarefa.");
      if (alertasRapidos.some((item) => item.tipo === "bloqueio")) {
        throw new Error("Resolva os bloqueios encontrados antes de enviar a tarefa.");
      }
      const resultado = await criarTarefaAutomacao({
        data: {
          medicoId: medicoSelecionado.id,
          medicoNome: medicoSelecionado.name,
          exame: exame || null,
          convenio: pagamento || null,
          idade: idade ? Number(idade) : null,
          turno: turno || null,
          solicitante: solicitante || null,
          dadosValidacao: {
            alertas: alertasRapidos,
            examesEncontrados: examesEncontrados.map((item) => item.name),
            particularidadesConsultadas: true,
            disponibilidadeClinux: "a_consultar_pelo_robo",
          },
        },
      });
      return resultado.tarefa as { id: string; status: string };
    },
    onSuccess: (tarefa) => {
      setTarefaCriada(tarefa);
      toast.success("Tarefa criada na fila de automação.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const cancelarAutomacao = useMutation({
    mutationFn: (tarefaId: string) => cancelarTarefaAutomacao({ data: { tarefaId } }),
    onSuccess: () => {
      setTarefaCriada(null);
      toast.success("Tarefa cancelada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const aprovarAutomacao = useMutation({
    mutationFn: (dados: { tarefaId: string; horario: Record<string, unknown> }) =>
      aprovarTarefaAutomacao({ data: dados }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agendamento-automacao-tarefas"] });
      toast.success("Horário aprovado e enviado para confirmação no Clinux.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const abrirEditorParticularidades = (medico: Medico) => {
    setMedicoSelecionado(medico);
    setFormParticularidades({
      schedules: [...(medico.schedules ?? [])],
      generalRules: [...(medico.generalRules ?? [])],
      notPerformed: [...(medico.notPerformed ?? [])],
      insuranceRestrictions: [...(medico.insuranceRestrictions ?? [])],
      conflicts: [...(medico.conflicts ?? [])],
    });
    setMenuContexto(null);
    setEditorAberto(true);
  };

  const medicos = useMemo(() => {
    const termo = normalizar(buscaMedico.trim());
    return medicosBase.filter(
      (medico) =>
        (abaMedicos === "com"
          ? temParticularidadesCadastradas(medico)
          : !temParticularidadesCadastradas(medico)) &&
        (!termo ||
          normalizar(
            [
              medico.name,
              medico.crm,
              ...(medico.aliases ?? []),
              ...medico.exams.map((item) => item.name),
            ].join(" "),
          ).includes(termo)) &&
        medicoPassaNosFiltros(medico, { exame, pagamento, idade, turno, solicitante }),
    );
  }, [abaMedicos, buscaMedico, exame, idade, medicosBase, pagamento, solicitante, turno]);
  useEffect(() => {
    if (medicoSelecionado && !medicos.some((medico) => medico.id === medicoSelecionado.id)) {
      setMedicoSelecionado(null);
    }
  }, [medicoSelecionado, medicos]);
  useEffect(() => {
    if (!menuContexto) return;
    const fechar = () => setMenuContexto(null);
    window.addEventListener("click", fechar);
    return () => window.removeEventListener("click", fechar);
  }, [menuContexto]);
  const examesEncontrados = useMemo(() => {
    if (!medicoSelecionado || !exame.trim()) return medicoSelecionado?.exams ?? [];
    const termo = normalizar(exame.trim());
    return medicoSelecionado.exams.filter((item) =>
      normalizar(`${item.name} ${(item.conditions ?? []).join(" ")}`).includes(termo),
    );
  }, [exame, medicoSelecionado]);
  const alertasRapidos = useMemo(() => {
    if (!medicoSelecionado) return [];
    const texto = listaDeTexto(medicoSelecionado);
    const alertas: { tipo: "alerta" | "bloqueio"; texto: string }[] = [];
    if (pagamento && pagamento !== "Todos" && normalizar(texto).includes(normalizar(pagamento)))
      alertas.push({
        tipo: "alerta",
        texto: `Há regras específicas para ${pagamento.toLowerCase()}. Confira o resumo antes de confirmar.`,
      });
    if (turno !== "Todos" && normalizar(texto).includes(normalizar(turno)))
      alertas.push({
        tipo: "alerta",
        texto: `Existem regras de horário para o turno da ${turno.toLowerCase()}.`,
      });
    if (idade && Number(idade) > 0 && /a partir de (1[245]|6[9]|70) anos/i.test(texto))
      alertas.push({
        tipo: "alerta",
        texto:
          "Este médico possui restrições de idade. Verifique a regra aplicável ao exame selecionado.",
      });
    if (solicitante.trim() && normalizar(texto).includes(normalizar(solicitante.trim())))
      alertas.push({
        tipo: "bloqueio",
        texto:
          "O nome informado aparece nas particularidades deste médico. Confirme se é um médico solicitante não atendido.",
      });
    return alertas;
  }, [idade, medicoSelecionado, pagamento, solicitante, turno]);
  const secoesParticularidadesCompletas = medicoDetalhesCompletos
    ? [
        { titulo: "Agenda e salas", itens: medicoDetalhesCompletos.schedules ?? [] },
        { titulo: "Regras gerais", itens: medicoDetalhesCompletos.generalRules ?? [] },
        { titulo: "Exames não realizados", itens: medicoDetalhesCompletos.notPerformed ?? [] },
        {
          titulo: "Restrições de convênios",
          itens: medicoDetalhesCompletos.insuranceRestrictions ?? [],
        },
        { titulo: "Regras de ultrassom", itens: medicoDetalhesCompletos.ultrasoundRules ?? [] },
        { titulo: "Densitometria", itens: medicoDetalhesCompletos.densitometry ?? [] },
        { titulo: "Intervenções", itens: medicoDetalhesCompletos.interventions ?? [] },
        { titulo: "Elastografia", itens: medicoDetalhesCompletos.elastography ?? [] },
        { titulo: "Conflitos e confirmações", itens: medicoDetalhesCompletos.conflicts ?? [] },
      ]
    : [];

  if (!carregandoSessao && !podeVer) {
    return (
      <AppShell titulo="Agendamento">
        <div className="card-superficie max-w-lg p-6 text-sm">
          Você não tem permissão para acessar o assistente de Agendamento da Marcação.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Agendamento"
      descricao="Consulte rapidamente as particularidades dos médicos antes de lançar o agendamento no Clinux."
      acoes={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setComoFuncionaAberto(true)}>
            <HelpCircle className="mr-1.5 size-4" /> Como funciona
          </Button>
          <Button
            onClick={() => {
              setMedicoEscopoAjudaId(null);
              setPergunta("");
              setResposta(null);
              setAjudaAberta(true);
            }}
          >
            <Sparkles className="mr-1.5 size-4" /> Pedir ajuda à IA
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="card-superficie border-primary/20 bg-primary/[0.03] p-4 md:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarHeart className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">Pesquisa rápida</h2>
              <p className="text-sm text-muted-foreground">
                Preencha somente o que souber. A consulta serve como apoio para o agendamento no
                Clinux.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5 lg:col-span-2">
              <Label>Exame solicitado</Label>
              <Input
                list="agendamento-sugestoes-exames"
                value={exame}
                onChange={(e) => setExame(e.target.value)}
                placeholder="Busque o exame…"
              />
              <datalist id="agendamento-sugestoes-exames">
                {sugestoesAgendamento.exames.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Convênio / pagamento</Label>
              <Input
                list="agendamento-sugestoes-convenios"
                value={pagamento}
                onChange={(e) => setPagamento(e.target.value)}
                placeholder="Todos — digite para filtrar"
              />
              <datalist id="agendamento-sugestoes-convenios">
                {sugestoesAgendamento.convenios.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Idade</Label>
              <Input
                type="number"
                min="0"
                value={idade}
                onChange={(e) => setIdade(e.target.value)}
                placeholder="Ex.: 69"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Turno / horário</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
              >
                {TURNOS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label>Médico solicitante</Label>
              <Input
                list="agendamento-sugestoes-solicitantes"
                value={solicitante}
                onChange={(e) => setSolicitante(e.target.value)}
                placeholder="Médico que solicitou o exame"
              />
              <datalist id="agendamento-sugestoes-solicitantes">
                {sugestoesAgendamento.solicitantes.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
          </div>
        </section>

        {podeAutomatizar && (
          <section className="card-superficie border-primary/20 bg-primary/[0.02] p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <Bot className="size-5 text-primary" /> Fila de automação
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Opções devolvidas pelo robô ficam aguardando aprovação humana. O protocolo só
                  aparece após confirmação no Clinux.
                </p>
              </div>
              <Badge variant="outline">Atualização automática</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {(tarefas.data ?? []).slice(0, 5).map((tarefa) => {
                const opcoes = Array.isArray(tarefa.opcoes_horarios) ? tarefa.opcoes_horarios : [];
                const aguardandoAprovacao =
                  ["opcoes_disponiveis", "aguardando_aprovacao"].includes(tarefa.status) &&
                  opcoes.length > 0;
                return (
                  <div key={tarefa.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{tarefa.medico_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            tarefa.exame,
                            tarefa.convenio,
                            tarefa.idade ? `${tarefa.idade} anos` : null,
                            tarefa.turno,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Dados não informados"}
                        </p>
                      </div>
                      <Badge
                        variant={
                          tarefa.status === "concluida"
                            ? "secondary"
                            : tarefa.status === "falhou"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {tarefa.status === "opcoes_disponiveis" ||
                        tarefa.status === "aguardando_aprovacao"
                          ? "Aguardando aprovação"
                          : tarefa.status === "confirmacao_solicitada"
                            ? "Confirmando no Clinux"
                            : tarefa.status === "concluida"
                              ? `Concluída${tarefa.protocolo ? ` · ${tarefa.protocolo}` : ""}`
                              : tarefa.status === "falhou"
                                ? "Falhou"
                                : "Aguardando robô"}
                      </Badge>
                    </div>
                    {tarefa.erro && <p className="mt-2 text-xs text-destructive">{tarefa.erro}</p>}
                    {aguardandoAprovacao && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {opcoes.map((opcao, indice) => (
                          <Button
                            key={`${tarefa.id}-${indice}`}
                            variant="outline"
                            className="h-auto justify-start whitespace-normal text-left"
                            disabled={aprovarAutomacao.isPending}
                            onClick={() =>
                              aprovarAutomacao.mutate({ tarefaId: tarefa.id, horario: opcao })
                            }
                          >
                            <CheckCircle2 className="mr-2 size-4 shrink-0 text-primary" />
                            <span>
                              {String(opcao.data ?? opcao.data_hora ?? "Data não informada")} ·{" "}
                              {String(opcao.hora ?? opcao.horario ?? "Horário não informado")}
                            </span>
                          </Button>
                        ))}
                      </div>
                    )}
                    {tarefa.status === "confirmacao_solicitada" && tarefa.horario_escolhido && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Opção escolhida:{" "}
                        {String(
                          tarefa.horario_escolhido.data ??
                            tarefa.horario_escolhido.data_hora ??
                            "data não informada",
                        )}{" "}
                        ·{" "}
                        {String(
                          tarefa.horario_escolhido.hora ??
                            tarefa.horario_escolhido.horario ??
                            "horário não informado",
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
              {!tarefas.isLoading && !tarefas.data?.length && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma tarefa de automação recente.
                </p>
              )}
            </div>
          </section>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.4fr)]">
          <section className="card-superficie overflow-hidden">
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Médicos e particularidades</h2>
                  <p className="text-xs text-muted-foreground">
                    {medicos.length} médicos compatíveis com os filtros atuais · botão direito para
                    mais opções
                  </p>
                </div>
                <Stethoscope className="size-5 text-primary" />
              </div>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={buscaMedico}
                  onChange={(e) => setBuscaMedico(e.target.value)}
                  aria-label="Buscar médico ou exame"
                  placeholder="Buscar médico ou exame…"
                />
              </div>
              <div className="mt-3 grid grid-cols-2 rounded-lg bg-secondary/60 p-1">
                <button
                  type="button"
                  onClick={() => setAbaMedicos("com")}
                  className={`rounded-md px-2 py-2 text-xs font-medium transition-colors ${abaMedicos === "com" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Com particularidades
                </button>
                <button
                  type="button"
                  onClick={() => setAbaMedicos("sem")}
                  className={`rounded-md px-2 py-2 text-xs font-medium transition-colors ${abaMedicos === "sem" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Sem particularidades
                </button>
              </div>
            </div>
            <div className="max-h-[620px] space-y-1 overflow-y-auto p-2">
              {medicos.map((medico) => (
                <button
                  key={medico.id}
                  type="button"
                  onClick={() => setMedicoSelecionado(medico)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenuContexto({ medico, x: event.clientX, y: event.clientY });
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${medicoSelecionado?.id === medico.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <Stethoscope className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{medico.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      CRM {medico.crm} · {medico.exams.length} exames
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
              {!medicos.length && (
                <p className="p-4 text-sm text-muted-foreground">Nenhum médico encontrado.</p>
              )}
            </div>
          </section>

          <section className="card-superficie min-h-[500px] p-5">
            {medicoSelecionado ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <Badge variant="secondary">Resumo rápido</Badge>
                    <h2 className="mt-2 text-xl font-semibold">{medicoSelecionado.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      CRM {medicoSelecionado.crm}
                      {medicoSelecionado.specialty ? ` · ${medicoSelecionado.specialty}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {podeAutomatizar && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setTarefaCriada(null);
                          setAutomacaoAberta(true);
                        }}
                      >
                        <CalendarClock className="mr-1.5 size-4" /> Consultar horários
                      </Button>
                    )}
                    {podeEditarParticularidades && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirEditorParticularidades(medicoSelecionado)}
                      >
                        Editar particularidades
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setMedicoSelecionado(null)}>
                      <XCircle className="mr-1.5 size-4" /> Fechar resumo
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Agenda</p>
                    {(medicoSelecionado.schedules ?? []).map((item) => (
                      <p key={item} className="mt-1 text-sm">
                        {item}
                      </p>
                    ))}
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Exames cadastrados
                    </p>
                    <p className="mt-1 text-sm">
                      {medicoSelecionado.exams.length} tipos de exame · horários conforme regra de
                      cada exame.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {alertasRapidos.map((item) => (
                    <div
                      key={item.texto}
                      className={`flex gap-2 rounded-lg border p-3 text-sm ${item.tipo === "bloqueio" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-amber-300/50 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"}`}
                    >
                      {item.tipo === "bloqueio" ? (
                        <XCircle className="mt-0.5 size-4 shrink-0" />
                      ) : (
                        <CircleAlert className="mt-0.5 size-4 shrink-0" />
                      )}
                      <span>{item.texto}</span>
                    </div>
                  ))}
                  <h3 className="pt-2 text-sm font-semibold">Particularidades mais importantes</h3>
                  {primeiroResumo(medicoSelecionado).map((item) => (
                    <div
                      key={item}
                      className="flex gap-2 rounded-lg border border-border p-3 text-sm"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <h3 className="mb-2 text-sm font-semibold">Exames e condições</h3>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {examesEncontrados.map((item) => (
                      <div key={item.name} className="rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{item.name}</p>
                          <Badge variant="outline">
                            {typeof item.slots === "object"
                              ? "Conforme duração"
                              : `${item.slots ?? "Consultar"} horário(s)`}
                          </Badge>
                        </div>
                        {(item.conditions ?? []).length > 0 && (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {(item.conditions ?? []).map((condition) => (
                              <li key={condition}>{condition}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                    {!examesEncontrados.length && (
                      <p className="text-sm text-muted-foreground">
                        Nenhum exame corresponde à busca.
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  Esta tela é um resumo de apoio. A disponibilidade real e a confirmação final
                  continuam sendo verificadas no Clinux.
                </p>
              </>
            ) : (
              <div className="flex min-h-[500px] flex-col items-center justify-center text-center">
                <Stethoscope className="size-10 text-primary/50" />
                <h2 className="mt-4 text-lg font-semibold">Selecione um médico</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Clique no botão de um médico ao lado para abrir o resumo das particularidades.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
      {menuContexto && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuContexto(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuContexto(null);
          }}
        >
          <div
            className="absolute min-w-64 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
            style={{ left: menuContexto.x, top: menuContexto.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border px-3 py-2">
              <p className="text-xs font-semibold">{menuContexto.medico.name}</p>
              <p className="text-[11px] text-muted-foreground">CRM {menuContexto.medico.crm}</p>
            </div>
            <button
              type="button"
              className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
              onClick={() => {
                setMedicoSelecionado(menuContexto.medico);
                setAbaMedicos("com");
                setMenuContexto(null);
              }}
            >
              Ver particularidades resumidas
            </button>
            <button
              type="button"
              className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
              onClick={() => {
                setMedicoDetalhesCompletos(menuContexto.medico);
                setMenuContexto(null);
              }}
            >
              Ver particularidades completas
            </button>
            {podeEditarParticularidades && (
              <button
                type="button"
                className="flex w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-primary hover:bg-primary/10"
                onClick={() => abrirEditorParticularidades(menuContexto.medico)}
              >
                Editar particularidades
              </button>
            )}
            <button
              type="button"
              className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
              onClick={() => {
                setMedicoEscopoAjudaId(menuContexto.medico.id);
                setPergunta(`Sobre ${menuContexto.medico.name}: `);
                setResposta(null);
                setAjudaAberta(true);
                setMenuContexto(null);
              }}
            >
              Pedir ajuda à IA sobre este médico
            </button>
            <button
              type="button"
              className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
              onClick={() => {
                setMedicoSelecionado(menuContexto.medico);
                setExame("");
                setAbaMedicos("com");
                setMenuContexto(null);
              }}
            >
              Ver todos os exames deste médico
            </button>
            <button
              type="button"
              className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(
                  `${menuContexto.medico.name} — CRM ${menuContexto.medico.crm}`,
                );
                setMenuContexto(null);
              }}
            >
              Copiar nome e CRM
            </button>
          </div>
        </div>
      )}
      <Dialog
        open={Boolean(medicoDetalhesCompletos)}
        onOpenChange={(aberto) => {
          if (!aberto) setMedicoDetalhesCompletos(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Particularidades completas</DialogTitle>
            <DialogDescription>
              {medicoDetalhesCompletos?.name} · CRM {medicoDetalhesCompletos?.crm}
              {medicoDetalhesCompletos?.rqe ? ` · RQE ${medicoDetalhesCompletos.rqe}` : ""}
              {medicoDetalhesCompletos?.specialty ? ` · ${medicoDetalhesCompletos.specialty}` : ""}
            </DialogDescription>
          </DialogHeader>
          {medicoDetalhesCompletos && (
            <div className="space-y-5">
              {medicoDetalhesCompletos.aliases?.length ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Nomes alternativos</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {medicoDetalhesCompletos.aliases.map((alias) => (
                      <li key={alias}>{alias}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {secoesParticularidadesCompletas.map((secao) => (
                <section key={secao.titulo}>
                  <h3 className="mb-2 text-sm font-semibold">{secao.titulo}</h3>
                  {secao.itens.length ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {secao.itens.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Não informado.</p>
                  )}
                </section>
              ))}
              <section>
                <h3 className="mb-2 text-sm font-semibold">Exames e condições</h3>
                {medicoDetalhesCompletos.exams.length ? (
                  <div className="space-y-2">
                    {medicoDetalhesCompletos.exams.map((item) => {
                      const duracao =
                        typeof item.slots === "number"
                          ? `${item.slots} horário(s)`
                          : item.slots == null
                            ? "Duração não informada"
                            : typeof item.slots === "object"
                              ? Object.entries(item.slots as Record<string, unknown>)
                                  .map(([sala, quantidade]) => `${sala}: ${quantidade}`)
                                  .join(" · ")
                              : String(item.slots);
                      return (
                        <div key={item.name} className="rounded-lg border border-border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm font-medium">{item.name}</p>
                            <Badge variant="outline">{duracao}</Badge>
                          </div>
                          {item.conditions?.length ? (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                              {item.conditions.map((condition) => (
                                <li key={condition}>{condition}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum exame detalhado cadastrado.
                  </p>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={editorAberto} onOpenChange={setEditorAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar particularidades</DialogTitle>
            <DialogDescription>
              {medicoSelecionado?.name}. Uma linha representa uma regra. Esta edição fica disponível
              para todos os usuários autorizados a consultar o Agendamento.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["schedules", "Agenda e horários"],
                ["generalRules", "Regras gerais"],
                ["insuranceRestrictions", "Convênios e pagamentos"],
                ["notPerformed", "Exames ou situações não realizados"],
                ["conflicts", "Conflitos e pontos para confirmar"],
              ] as const
            ).map(([campo, rotulo]) => (
              <div key={campo} className="space-y-1.5 sm:col-span-2">
                <Label>{rotulo}</Label>
                <Textarea
                  rows={campo === "generalRules" ? 6 : 3}
                  value={(formParticularidades[campo] ?? []).join("\n")}
                  onChange={(event) =>
                    setFormParticularidades((atual) => ({
                      ...atual,
                      [campo]: event.target.value
                        .split("\n")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="Digite uma regra por linha"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorAberto(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!medicoSelecionado || salvarParticularidades.isPending}
              onClick={() => medicoSelecionado && salvarParticularidades.mutate(medicoSelecionado)}
            >
              {salvarParticularidades.isPending ? "Salvando…" : "Salvar particularidades"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={automacaoAberta} onOpenChange={setAutomacaoAberta}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="size-5 text-primary" /> Consulta assistida de horários
            </DialogTitle>
            <DialogDescription>
              A validação usa as regras do médico e cria uma tarefa para o robô consultar o Clinux.
              Nesta fase, nenhum agendamento real é feito automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-sm">
              <p className="font-semibold">{medicoSelecionado?.name}</p>
              <p className="mt-1 text-muted-foreground">
                {[
                  exame || "Exame não informado",
                  pagamento || "Convênio não informado",
                  idade ? `${idade} anos` : "Idade não informada",
                  turno !== "Todos" ? turno : "Qualquer turno",
                ].join(" · ")}
              </p>
            </div>
            <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
              <p className="font-medium">Validações executadas</p>
              <p className="text-muted-foreground">Regras do médico: consultadas</p>
              <p className="text-muted-foreground">
                Conflitos de exame, convênio, idade e turno: verificados
              </p>
              <p className="text-muted-foreground">
                Disponibilidade real: será consultada pelo robô no Clinux
              </p>
              {alertasRapidos.map((item) => (
                <p
                  key={item.texto}
                  className={
                    item.tipo === "bloqueio"
                      ? "text-destructive"
                      : "text-amber-700 dark:text-amber-300"
                  }
                >
                  {item.tipo === "bloqueio" ? "Bloqueio: " : "Atenção: "}
                  {item.texto}
                </p>
              ))}
            </div>
            {tarefaCriada && (
              <div className="rounded-xl border border-emerald-300/50 bg-emerald-50 p-4 text-sm text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-100">
                <p className="font-semibold">Tarefa criada</p>
                <p className="mt-1">ID: {tarefaCriada.id}</p>
                <p className="mt-1">Status: aguardando consulta do robô.</p>
                <p className="mt-2 text-xs opacity-80">
                  Quando o webhook do Activepieces/n8n estiver configurado, o robô poderá devolver
                  opções de horários para aprovação humana.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            {tarefaCriada ? (
              <Button
                variant="outline"
                disabled={cancelarAutomacao.isPending}
                onClick={() => cancelarAutomacao.mutate(tarefaCriada.id)}
              >
                Cancelar tarefa
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAutomacaoAberta(false)}>
                  Voltar
                </Button>
                <Button
                  disabled={
                    criarAutomacao.isPending ||
                    alertasRapidos.some((item) => item.tipo === "bloqueio")
                  }
                  onClick={() => criarAutomacao.mutate()}
                >
                  {criarAutomacao.isPending ? "Criando tarefa…" : "Enviar para a fila"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={ajudaAberta}
        onOpenChange={(aberta) => {
          setAjudaAberta(aberta);
          if (!aberta) {
            setMedicoEscopoAjudaId(null);
            setPergunta("");
            setResposta(null);
          }
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="size-5 text-primary" />
              {medicoEscopoAjudaId
                ? `Pedir ajuda sobre ${medicosBase.find((item) => item.id === medicoEscopoAjudaId)?.name ?? "este médico"}`
                : "Pedir ajuda sobre todos os médicos"}
            </DialogTitle>
            <DialogDescription>
              {medicoEscopoAjudaId
                ? "Busca limitada à ficha deste médico. Digite uma palavra-chave ou uma pergunta completa; outros médicos não serão incluídos."
                : "Busca em todas as fichas. Digite uma palavra-chave ou uma pergunta completa; os resultados são ordenados pela relevância."}{" "}
              A resposta usa somente as regras cadastradas. Após consultar, o campo fica pronto para
              outra pergunta sem fechar esta janela.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const perguntaAtual = pergunta.trim();
              if (perguntaAtual) {
                const novoResultado = buscarParticularidades(
                  perguntaAtual,
                  medicoEscopoAjudaId
                    ? medicosBase.filter((medico) => medico.id === medicoEscopoAjudaId)
                    : medicosBase,
                );
                setResposta({
                  ...novoResultado,
                  pergunta: perguntaAtual,
                });
                setPergunta("");
                window.requestAnimationFrame(() => perguntaInputRef.current?.focus());
              }
            }}
          >
            <Input
              ref={perguntaInputRef}
              autoFocus
              value={pergunta}
              onChange={(event) => setPergunta(event.target.value)}
              placeholder={
                medicoEscopoAjudaId
                  ? "Ex.: Unimed, limite por dia, idade ou nome de exame"
                  : "Ex.: O Dr. Nilton atende Unimed? Quantas por dia?"
              }
            />
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1.5 hover:bg-secondary"
                onClick={() => {
                  setPergunta("O Dr. Nilton atende Unimed? Quantas por dia?");
                }}
              >
                Exemplo: Unimed
              </button>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1.5 hover:bg-secondary"
                onClick={() => {
                  setPergunta("Quais médicos atendem pacientes acima de 100 kg?");
                }}
              >
                Exemplo: peso
              </button>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!pergunta.trim()}>
                <Search className="mr-1.5 size-4" /> Consultar regras
              </Button>
            </DialogFooter>
          </form>
          {resposta && (
            <div aria-live="polite" className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Busca: “{resposta.pergunta}”
                  </p>
                  {resposta.texto}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPergunta("");
                    setResposta(null);
                    window.requestAnimationFrame(() => perguntaInputRef.current?.focus());
                  }}
                >
                  Nova busca
                </Button>
              </div>
              {resposta.resultados.map(({ medico, linhas, respostaDireta }) => (
                <div key={medico.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{medico.name}</p>
                      <p className="text-xs text-muted-foreground">CRM {medico.crm}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMedicoSelecionado(medico);
                        setAbaMedicos("com");
                        setAjudaAberta(false);
                      }}
                    >
                      Ver particularidades
                    </Button>
                  </div>
                  {respostaDireta && (
                    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-sm font-medium">
                      {respostaDireta}
                    </div>
                  )}
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {linhas.map((linha) => (
                      <li key={linha}>{linha}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            A IA não substitui a confirmação em sala nem a disponibilidade real no Clinux. Em caso
            de conflito ou ausência de regra, não autorize automaticamente.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={comoFuncionaAberto} onOpenChange={setComoFuncionaAberto}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="size-5 text-primary" /> Como funciona o Agendamento
            </DialogTitle>
            <DialogDescription>
              Guia rápido para consultar as regras dos médicos antes de fazer o lançamento no
              Clinux.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <section className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
              <h3 className="font-semibold">Objetivo desta tela</h3>
              <p className="mt-1 text-muted-foreground">
                O Agendamento reúne as particularidades cadastradas dos médicos para diminuir a
                busca manual. Ele ajuda a decidir se é necessário confirmar com a sala, mas não
                substitui a disponibilidade real do Clinux.
              </p>
            </section>
            <section>
              <h3 className="font-semibold">Passo a passo da pesquisa</h3>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>
                  Digite o <strong className="text-foreground">exame solicitado</strong>. A lista
                  mostra os médicos que possuem esse exame ou uma condição relacionada.
                </li>
                <li>
                  Digite o <strong className="text-foreground">convênio ou pagamento</strong>, por
                  exemplo: Unimed, particular ou SUS. Os médicos com restrições incompatíveis são
                  retirados da lista.
                </li>
                <li>
                  Informe a <strong className="text-foreground">idade</strong>. As regras de idade
                  cadastradas são cruzadas automaticamente.
                </li>
                <li>
                  Escolha o <strong className="text-foreground">turno</strong> para considerar
                  restrições de manhã, tarde ou noite.
                </li>
                <li>
                  Se necessário, informe o{" "}
                  <strong className="text-foreground">médico solicitante</strong>. Isso ajuda a
                  identificar regras de médicos que não devem ser agendados.
                </li>
                <li>
                  A lista é atualizada a cada informação digitada. Clique no nome do médico para
                  abrir o resumo.
                </li>
              </ol>
            </section>
            <section>
              <h3 className="font-semibold">Abas de médicos</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="font-medium">Com particularidades</p>
                  <p className="mt-1 text-muted-foreground">
                    Mostra médicos com regras de convênio, idade, horário, exames, limites ou
                    restrições.
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="font-medium">Sem particularidades</p>
                  <p className="mt-1 text-muted-foreground">
                    Mostra médicos sem regras especiais cadastradas. Mesmo assim, confirme a
                    disponibilidade no Clinux.
                  </p>
                </div>
              </div>
            </section>
            <section>
              <h3 className="font-semibold">Resumo do médico</h3>
              <p className="mt-1 text-muted-foreground">
                Ao clicar em um médico, confira agenda, quantidade de exames, regras principais,
                exames não realizados e condições específicas por exame. O campo de exame também
                filtra a lista de condições.
              </p>
            </section>
            <section className="rounded-xl border border-border p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <Bot className="size-4 text-primary" /> Duas formas de pedir ajuda à IA
              </h3>
              <h4 className="mt-3 font-medium">Busca focada em um médico</h4>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>Na lista, localize o médico e clique nele com o botão direito.</li>
                <li>
                  Escolha{" "}
                  <strong className="text-foreground">Pedir ajuda à IA sobre este médico</strong>. A
                  janela mostrará o nome do profissional e pesquisará somente a ficha dele.
                </li>
                <li>
                  Digite uma palavra ou uma pergunta completa, por exemplo: “Atende Unimed? Quantas
                  por dia?”. As respostas não incluirão outros médicos.
                </li>
                <li>
                  Após cada resposta, o campo fica vazio e focado para consultar outra regra do
                  mesmo médico sem fechar a janela. O botão{" "}
                  <strong className="text-foreground">Nova busca</strong>
                  também limpa o resultado atual.
                </li>
              </ol>
              <h4 className="mt-4 font-medium">Busca geral em todos os médicos</h4>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>
                  Clique no botão do topo{" "}
                  <strong className="text-foreground">Pedir ajuda à IA</strong>. Essa opção pesquisa
                  todo o cadastro.
                </li>
                <li>
                  Escreva uma palavra ou uma pergunta completa, por exemplo: “Quais médicos atendem
                  pacientes acima de 100 kg?”. Os resultados são ordenados pela relevância.
                </li>
                <li>
                  Abra <strong className="text-foreground">Ver particularidades</strong> para
                  consultar a ficha completa. Após cada resposta, o campo fica vazio e focado para
                  você fazer outra pergunta sem fechar o diálogo;{" "}
                  <strong className="text-foreground">Nova busca</strong>
                  limpa o resultado atual.
                </li>
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                A ajuda pesquisa apenas as informações cadastradas. Quando não existe uma regra
                explícita ou há conflito, confirme com a sala e não autorize automaticamente.
              </p>
            </section>
            <section className="rounded-xl border border-amber-300/50 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
              <h3 className="font-semibold">Regra final</h3>
              <p className="mt-1">
                A tela é uma ferramenta de apoio. Depois de consultar as particularidades, confirme
                a agenda, o horário e a autorização no Clinux antes de concluir o agendamento.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
