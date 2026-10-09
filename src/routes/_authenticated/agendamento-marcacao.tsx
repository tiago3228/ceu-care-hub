/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarHeart,
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
function temParticularidades(medico: Medico) {
  return Boolean(
    (medico.generalRules?.length ?? 0) > 0 ||
    (medico.notPerformed?.length ?? 0) > 0 ||
    (medico.conflicts?.length ?? 0) > 0 ||
    (medico.insuranceRestrictions?.length ?? 0) > 0 ||
    (medico.exams?.some((item) => (item.conditions?.length ?? 0) > 0) ?? false),
  );
}
function linhasDaRegra(medico: Medico) {
  return [
    ...(medico.generalRules ?? []),
    ...(medico.notPerformed ?? []).map((item) => `Não realiza: ${item}`),
    ...(medico.insuranceRestrictions ?? []),
    ...(medico.ultrasoundRules ?? []),
    ...(medico.densitometry ?? []),
    ...(medico.interventions ?? []),
    ...(medico.elastography ?? []),
    ...(medico.conflicts ?? []).map((item) => `Conflito: ${item}`),
    ...(medico.exams ?? []).flatMap((item) => [
      `${item.name}: ${(item.conditions ?? []).join(" ")}`,
    ]),
  ];
}
function responderAjuda(pergunta: string, base: readonly Medico[] = MEDICOS_DA_BASE) {
  const consulta = normalizar(pergunta.trim());
  const palavras = consulta
    .split(/\s+/)
    .filter(
      (palavra) =>
        palavra.length > 3 &&
        ![
          "qual",
          "quais",
          "atende",
          "atendem",
          "tem",
          "mais",
          "sobre",
          "para",
          "medico",
          "medicos",
          "pacientes",
          "acima",
          "abaixo",
        ].includes(palavra),
    );
  if (/unimed|convenio|convênio|plano/.test(consulta))
    palavras.push("unimed", "convenio", "convênio", "cota", "particular");
  if (/quantas|limite|por dia|por turno/.test(consulta))
    palavras.push("limite", "cota", "máximo", "maximo", "dia", "turno");
  if (/kg|quilo|peso/.test(consulta)) palavras.push("kg", "quilo", "peso", "140");
  const medicosEncontrados = base.filter((medico) => {
    const nome = normalizar([medico.name, medico.id, ...(medico.aliases ?? [])].join(" "));
    return nome.split(/\s+/).some((parte) => parte.length > 3 && consulta.includes(parte));
  });
  const candidatos = medicosEncontrados.length ? medicosEncontrados : base;
  const resultados = candidatos
    .map((medico) => {
      const linhas = linhasDaRegra(medico);
      const examesCorrespondentes = (medico.exams ?? []).filter((item) => {
        const nomeExame = normalizar(item.name);
        const tokensRelevantes = nomeExame
          .split(" ")
          .filter((token) => token.length > 2 && !["com", "sem", "para"].includes(token));
        return (
          consulta.includes(nomeExame) ||
          (tokensRelevantes.length > 0 &&
            tokensRelevantes.every((token) => consulta.includes(token)))
        );
      });
      const examesNaoRealizados = (medico.notPerformed ?? []).filter((item) => {
        const nomeExame = normalizar(item);
        const tokens = nomeExame
          .split(" ")
          .filter((token) => token.length > 2 && !["com", "sem", "para"].includes(token));
        return (
          consulta.includes(nomeExame) ||
          (tokens.length > 0 && tokens.every((token) => consulta.includes(token)))
        );
      });
      const relevantes = linhas.filter((linha) => {
        const linhaNormalizada = normalizar(linha);
        return palavras.some((palavra) => linhaNormalizada.includes(palavra));
      });
      let respostaDireta: string | undefined;
      const perguntaSobreAtraso = /atras|atraso|pontual|pontualidade|demora|horario|horário/.test(
        consulta,
      );
      if (examesNaoRealizados.length > 0) {
        respostaDireta = `Não. A base informa que não realiza: ${examesNaoRealizados.join("; ")}.`;
      } else if (examesCorrespondentes.length > 0) {
        respostaDireta = `Sim. O exame aparece na base: ${examesCorrespondentes
          .map(
            (item) =>
              `${item.name}${item.slots != null ? ` (${typeof item.slots === "object" ? "conforme duração" : `${item.slots} horário(s)`})` : ""}`,
          )
          .join("; ")}.`;
      } else if (perguntaSobreAtraso && medicosEncontrados.length > 0) {
        const regraAtraso = linhas.find((linha) =>
          /atras|demora|pontual|horario|horário/i.test(linha),
        );
        respostaDireta = regraAtraso
          ? `Sim. A ficha informa: ${regraAtraso}`
          : `Não encontrei na ficha uma observação explícita sobre atraso, pontualidade ou demora para ${medico.name}. A ficha contém ${medico.schedules?.length ?? 0} regra(s) de agenda e ${medico.generalRules?.length ?? 0} regra(s) geral(is); confira o resumo completo abaixo.`;
      }
      const linhasDaFicha = linhasDaRegra(medico);
      const linhasExibidas =
        relevantes.length > 0 ? relevantes : medicosEncontrados.length > 0 ? linhasDaFicha : [];
      return {
        medico,
        linhas: Array.from(new Set(linhasExibidas)).slice(0, perguntaSobreAtraso ? 8 : 5),
        respostaDireta,
      };
    })
    .filter((item) => item.linhas.length > 0 || item.respostaDireta)
    .slice(0, 8);
  if (!resultados.length) {
    return {
      texto:
        "Não encontrei uma regra explícita para essa pergunta. Como a ausência de regra não significa autorização, confirme no resumo do médico ou em sala antes de agendar.",
      resultados: [],
    };
  }
  const respostasDiretas = resultados.filter((item) => item.respostaDireta).length;
  const perguntaSobreLista = /quais|qual medico|qual profissional/.test(consulta);
  const texto =
    respostasDiretas > 0 && !perguntaSobreLista
      ? `Encontrei ${respostasDiretas} resposta(s) direta(s) na lista de exames e regras do médico. Confira os detalhes abaixo.`
      : perguntaSobreLista
        ? `Encontrei ${resultados.length} médico(s) com informações relacionadas. Veja os trechos abaixo e abra o resumo do profissional para conferir todas as regras.`
        : `Encontrei informações relacionadas na base cadastrada. A resposta abaixo é um apoio operacional; confira também o resumo completo antes de confirmar no Clinux.`;
  return { texto, resultados };
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
  const [pagamento, setPagamento] = useState("Todos");
  const [turno, setTurno] = useState("Todos");
  const [idade, setIdade] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [abaMedicos, setAbaMedicos] = useState<"com" | "sem">("com");
  const [medicoSelecionado, setMedicoSelecionado] = useState<Medico | null>(null);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [comoFuncionaAberto, setComoFuncionaAberto] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<ReturnType<typeof responderAjuda> | null>(null);
  const [editorAberto, setEditorAberto] = useState(false);
  const [formParticularidades, setFormParticularidades] = useState<ParticularidadesEditadas>({});
  const [menuContexto, setMenuContexto] = useState<{
    medico: Medico;
    x: number;
    y: number;
  } | null>(null);

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

  const medicosBase = useMemo(
    () =>
      MEDICOS_DA_BASE.map((medico) => ({
        ...medico,
        ...(particularidades.data?.find((item) => item.chave === String(medico.id))?.dados ?? {}),
      })),
    [particularidades.data],
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
        (abaMedicos === "com" ? temParticularidades(medico) : !temParticularidades(medico)) &&
        (!termo || normalizar(`${medico.name} ${medico.crm}`).includes(termo)) &&
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
    if (pagamento !== "Todos" && normalizar(texto).includes(normalizar(pagamento)))
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
          <Button onClick={() => setAjudaAberta(true)}>
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
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5 lg:col-span-2">
              <Label>Exame solicitado</Label>
              <Input
                value={exame}
                onChange={(e) => setExame(e.target.value)}
                placeholder="Busque o exame…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Convênio / pagamento</Label>
              <Input
                value={pagamento}
                onChange={(e) => setPagamento(e.target.value)}
                placeholder="Unimed, particular, SUS…"
              />
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
                value={solicitante}
                onChange={(e) => setSolicitante(e.target.value)}
                placeholder="Médico que solicitou o exame"
              />
            </div>
          </div>
        </section>

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
                  placeholder="Buscar médico…"
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
      <Dialog open={ajudaAberta} onOpenChange={setAjudaAberta}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="size-5 text-primary" /> Pedir ajuda sobre os médicos
            </DialogTitle>
            <DialogDescription>
              Faça uma pergunta em linguagem natural. A resposta usa somente as regras cadastradas e
              mostra o médico para você abrir o resumo completo.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (pergunta.trim()) setResposta(responderAjuda(pergunta, medicosBase));
            }}
          >
            <Input
              autoFocus
              value={pergunta}
              onChange={(event) => setPergunta(event.target.value)}
              placeholder="Ex.: O Dr. Nilton atende Unimed? Quantas por dia?"
            />
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1.5 hover:bg-secondary"
                onClick={() => setPergunta("O Dr. Nilton atende Unimed? Quantas por dia?")}
              >
                Exemplo: Unimed
              </button>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1.5 hover:bg-secondary"
                onClick={() => setPergunta("Quais médicos atendem pacientes acima de 100 kg?")}
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
            <div className="space-y-3 border-t border-border pt-4">
              <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-sm">
                {resposta.texto}
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
                <Bot className="size-4 text-primary" /> Pedir ajuda à IA
              </h3>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>
                  Clique em <strong className="text-foreground">Pedir ajuda à IA</strong>.
                </li>
                <li>
                  Escreva a pergunta do jeito que falaria normalmente, por exemplo: “O Dr. Nilton
                  atende Unimed? Quantas por dia?”
                </li>
                <li>Confira os trechos encontrados na base cadastrada.</li>
                <li>
                  Clique em <strong className="text-foreground">Ver particularidades</strong> para
                  abrir o resumo completo daquele médico.
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
