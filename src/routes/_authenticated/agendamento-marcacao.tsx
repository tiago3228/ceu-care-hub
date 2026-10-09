/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarHeart,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Search,
  Sparkles,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Medico = (typeof regras.doctors)[number];
const TURNOS = ["Todos", "Manhã", "Tarde", "Noite"];

function normalizar(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function listaDeTexto(medico: Medico) {
  return [
    ...(medico.generalRules ?? []),
    ...(medico.notPerformed ?? []),
    ...(medico.ultrasoundRules ?? []),
    ...(medico.densitometry ?? []),
    ...(medico.insuranceRestrictions ?? []),
    ...(medico.schedules ?? []),
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
    ...(medico.conflicts ?? []).map((item) => `Conflito: ${item}`),
    ...(medico.exams ?? []).flatMap((item) => [
      `${item.name}: ${(item.conditions ?? []).join(" ")}`,
    ]),
  ];
}
function responderAjuda(pergunta: string) {
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
  const medicosEncontrados = regras.doctors.filter((medico) => {
    const nome = normalizar(`${medico.name} ${medico.id}`);
    return nome.split(/\s+/).some((parte) => parte.length > 3 && consulta.includes(parte));
  });
  const candidatos = medicosEncontrados.length ? medicosEncontrados : regras.doctors;
  const resultados = candidatos
    .map((medico) => {
      const linhas = linhasDaRegra(medico);
      const relevantes = linhas.filter((linha) => {
        const linhaNormalizada = normalizar(linha);
        return palavras.some((palavra) => linhaNormalizada.includes(palavra));
      });
      return { medico, linhas: Array.from(new Set(relevantes)).slice(0, 5) };
    })
    .filter((item) => item.linhas.length > 0)
    .slice(0, 8);
  if (!resultados.length) {
    return {
      texto:
        "Não encontrei uma regra explícita para essa pergunta. Como a ausência de regra não significa autorização, confirme no resumo do médico ou em sala antes de agendar.",
      resultados: [],
    };
  }
  const perguntaSobreLista = /quais|qual medico|qual profissional/.test(consulta);
  const texto = perguntaSobreLista
    ? `Encontrei ${resultados.length} médico(s) com informações relacionadas. Veja os trechos abaixo e abra o resumo do profissional para conferir todas as regras.`
    : `Encontrei informações relacionadas na base cadastrada. A resposta abaixo é um apoio operacional; confira também o resumo completo antes de confirmar no Clinux.`;
  return { texto, resultados };
}

function PaginaAgendamentoMarcacao() {
  const { temModulo, isAdmin, isLoading: carregandoSessao } = useSessao();
  const podeVer = isAdmin || temModulo("agendamento_marcacao");
  const [buscaMedico, setBuscaMedico] = useState("");
  const [exame, setExame] = useState("");
  const [pagamento, setPagamento] = useState("Todos");
  const [turno, setTurno] = useState("Todos");
  const [idade, setIdade] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [abaMedicos, setAbaMedicos] = useState<"com" | "sem">("com");
  const [medicoSelecionado, setMedicoSelecionado] = useState<Medico | null>(null);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<ReturnType<typeof responderAjuda> | null>(null);

  const medicos = useMemo(() => {
    const termo = normalizar(buscaMedico.trim());
    return regras.doctors.filter(
      (medico) =>
        (abaMedicos === "com" ? temParticularidades(medico) : !temParticularidades(medico)) &&
        (!termo || normalizar(`${medico.name} ${medico.crm}`).includes(termo)) &&
        medicoPassaNosFiltros(medico, { exame, pagamento, idade, turno, solicitante }),
    );
  }, [abaMedicos, buscaMedico, exame, idade, pagamento, solicitante, turno]);
  useEffect(() => {
    if (medicoSelecionado && !medicos.some((medico) => medico.id === medicoSelecionado.id)) {
      setMedicoSelecionado(null);
    }
  }, [medicoSelecionado, medicos]);
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
        <Button onClick={() => setAjudaAberta(true)}>
          <Sparkles className="mr-1.5 size-4" /> Pedir ajuda à IA
        </Button>
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
                    {medicos.length} médicos compatíveis com os filtros atuais
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
                  <Button variant="outline" size="sm" onClick={() => setMedicoSelecionado(null)}>
                    <XCircle className="mr-1.5 size-4" /> Fechar resumo
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Agenda</p>
                    {medicoSelecionado.schedules.map((item) => (
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
              if (pergunta.trim()) setResposta(responderAjuda(pergunta));
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
              {resposta.resultados.map(({ medico, linhas }) => (
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
    </AppShell>
  );
}
