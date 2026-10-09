import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BellRing,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { supabase } from "@/integrations/supabase/client";
import { hojeIso, isoParaBr, somarDiasIso } from "@/lib/datas";
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

export const Route = createFileRoute("/_authenticated/agenda-marcacao")({
  head: () => ({
    meta: [{ title: "Minha Agenda | Clínica CEU" }, { name: "robots", content: "noindex" }],
  }),
  component: PaginaAgenda,
});

type Status =
  | "nao_agendado"
  | "aguardando_retorno"
  | "agendado"
  | "retorno_futuro"
  | "aguardando_autorizacao"
  | "cancelado"
  | "concluido";

type Registro = {
  id: number;
  user_id: string;
  nome_paciente: string;
  telefone: string;
  exame: string;
  convenio: string | null;
  medico: string | null;
  unidade: string | null;
  data_prevista: string | null;
  data_contato: string | null;
  retorno_em: string | null;
  status: Status;
  observacao: string | null;
  observacoes_internas: string | null;
  lembrete: string | null;
  lembrete_em: string | null;
  created_at: string;
  updated_at: string;
};

type Formulario = Omit<Registro, "id" | "user_id" | "created_at" | "updated_at"> & {
  id: number | null;
};

type MenuContextual = {
  x: number;
  y: number;
  dia: string;
  registro: Registro | null;
};

const STATUS: { id: Status; label: string; cor: string; bg: string }[] = [
  { id: "nao_agendado", label: "Não Agendado", cor: "text-red-600", bg: "bg-red-500" },
  {
    id: "aguardando_retorno",
    label: "Aguardando Retorno",
    cor: "text-amber-600",
    bg: "bg-amber-500",
  },
  { id: "agendado", label: "Agendado", cor: "text-emerald-600", bg: "bg-emerald-500" },
  { id: "retorno_futuro", label: "Retorno Futuro", cor: "text-blue-600", bg: "bg-blue-500" },
  {
    id: "aguardando_autorizacao",
    label: "Aguardando Autorização",
    cor: "text-violet-600",
    bg: "bg-violet-500",
  },
  { id: "cancelado", label: "Cancelado", cor: "text-slate-700", bg: "bg-slate-700" },
  { id: "concluido", label: "Concluído", cor: "text-slate-500", bg: "bg-slate-300" },
];
const STATUS_MAP = Object.fromEntries(STATUS.map((s) => [s.id, s])) as Record<
  Status,
  (typeof STATUS)[number]
>;
const VAZIO: Formulario = {
  id: null,
  nome_paciente: "",
  telefone: "",
  exame: "",
  convenio: "",
  medico: "",
  unidade: "",
  data_prevista: hojeIso(),
  data_contato: null,
  retorno_em: null,
  status: "nao_agendado",
  observacao: "",
  observacoes_internas: "",
  lembrete: "",
  lembrete_em: null,
};
const SEM_VALOR = "__nenhum__";

function inicioDaSemana(iso: string) {
  const data = new Date(`${iso}T00:00:00Z`);
  const dia = data.getUTCDay();
  data.setUTCDate(data.getUTCDate() + (dia === 0 ? -6 : 1 - dia));
  return data.toISOString().slice(0, 10);
}
function rotuloDia(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" })
    .format(new Date(`${iso}T00:00:00Z`))
    .replace(".", "");
}
function limparTelefone(telefone: string) {
  const numeros = telefone.replace(/\D/g, "");
  return numeros.startsWith("55") ? numeros : `55${numeros}`;
}

function emitirSomLembrete() {
  try {
    const contexto = new AudioContext();
    const oscilador = contexto.createOscillator();
    const ganho = contexto.createGain();
    oscilador.type = "sine";
    oscilador.frequency.setValueAtTime(740, contexto.currentTime);
    oscilador.frequency.exponentialRampToValueAtTime(560, contexto.currentTime + 0.12);
    ganho.gain.setValueAtTime(0.0001, contexto.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.07, contexto.currentTime + 0.01);
    ganho.gain.exponentialRampToValueAtTime(0.0001, contexto.currentTime + 0.18);
    oscilador.connect(ganho);
    ganho.connect(contexto.destination);
    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.18);
    oscilador.addEventListener("ended", () => void contexto.close());
  } catch {
    // O navegador pode bloquear áudio automático; o alerta visual continua ativo.
  }
}

function PaginaAgenda() {
  const { temModulo, somenteLeitura, sessao, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [semanaInicio, setSemanaInicio] = useState(() => inicioDaSemana(hojeIso()));
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [unidadeFiltro, setUnidadeFiltro] = useState("todos");
  const [form, setForm] = useState<Formulario | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const chavesSomEmitido = useRef(new Set<string>());
  const [lembretesDispensados, setLembretesDispensados] = useState<Set<string>>(() => new Set());
  const [menuContextual, setMenuContextual] = useState<MenuContextual | null>(null);

  const podeVer = temModulo("agenda_marcacao");
  const podeAdicionar = !somenteLeitura && temModulo("agenda_marcacao_adicionar");
  const podeEditar = !somenteLeitura && temModulo("agenda_marcacao_editar");
  const podeExcluir = !somenteLeitura && temModulo("agenda_marcacao_excluir");

  const registros = useQuery({
    queryKey: ["agenda-marcacao", sessao?.userId],
    enabled: podeVer && !!sessao?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_marcacao")
        .select("*")
        .eq("user_id" as never, (sessao?.userId ?? "") as never)
        .order("data_prevista")
        .order("id");
      if (error) throw error;
      return (data ?? []) as Registro[];
    },
  });

  const todos = useMemo(() => registros.data ?? [], [registros.data]);
  useEffect(() => {
    const intervalo = window.setInterval(() => setAgora(Date.now()), 15_000);
    return () => window.clearInterval(intervalo);
  }, []);
  useEffect(() => {
    if (!sessao?.userId || !todos.length) return;
    const lidos = new Set<string>();
    for (const registro of todos) {
      if (!registro.lembrete_em) continue;
      try {
        if (
          window.localStorage.getItem(
            `ceu:agenda:lembrete-lido:${sessao.userId}:${registro.id}:${registro.lembrete_em}`,
          ) === "1"
        ) {
          lidos.add(`${registro.id}:${registro.lembrete_em}`);
        }
      } catch {
        // O alerta continua funcionando sem armazenamento persistente.
      }
    }
    if (lidos.size) setLembretesDispensados(lidos);
  }, [sessao?.userId, todos]);
  const lembretesAtivos = useMemo(
    () =>
      todos.filter(
        (r) =>
          !!r.lembrete &&
          !!r.lembrete_em &&
          new Date(r.lembrete_em).getTime() <= agora &&
          !lembretesDispensados.has(`${r.id}:${r.lembrete_em}`),
      ),
    [agora, lembretesDispensados, todos],
  );
  useEffect(() => {
    if (!sessao?.userId || !lembretesAtivos.length) return;
    const chaveBase = `ceu:agenda:lembrete-som:${sessao.userId}`;
    let emitiuSom = false;
    for (const registro of lembretesAtivos) {
      if (!registro.lembrete_em) continue;
      const chave = `${chaveBase}:${registro.id}:${registro.lembrete_em}`;
      if (chavesSomEmitido.current.has(chave)) continue;
      try {
        if (window.localStorage.getItem(chave) === "1") continue;
        window.localStorage.setItem(chave, "1");
      } catch {
        // Sem armazenamento persistente, o refetch ainda não repete o efeito nesta renderização.
      }
      chavesSomEmitido.current.add(chave);
      emitiuSom = true;
    }
    if (emitiuSom) emitirSomLembrete();
  }, [lembretesAtivos, sessao?.userId]);

  useEffect(() => {
    const fechar = () => setMenuContextual(null);
    window.addEventListener("click", fechar);
    return () => window.removeEventListener("click", fechar);
  }, []);

  function dispensarLembrete(registro: Registro) {
    if (!registro.lembrete_em) return;
    const chave = `${registro.id}:${registro.lembrete_em}`;
    setLembretesDispensados((atual) => {
      const proximo = new Set(atual);
      proximo.add(chave);
      try {
        window.localStorage.setItem(`ceu:agenda:lembrete-lido:${sessao?.userId}:${chave}`, "1");
      } catch {
        // O estado da sessão continua funcionando sem armazenamento persistente.
      }
      return proximo;
    });
  }
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return todos.filter(
      (r) =>
        (statusFiltro === "todos" || r.status === statusFiltro) &&
        (unidadeFiltro === "todos" || r.unidade === unidadeFiltro) &&
        (!termo ||
          [r.nome_paciente, r.telefone, r.exame, r.observacao, r.convenio, r.medico]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(termo)),
    );
  }, [todos, busca, statusFiltro, unidadeFiltro]);
  const porDia = useMemo(() => {
    const mapa = new Map<string, Registro[]>();
    filtrados.forEach((r) => {
      if (!r.data_prevista) return;
      mapa.set(r.data_prevista, [...(mapa.get(r.data_prevista) ?? []), r]);
    });
    return mapa;
  }, [filtrados]);
  const resumo = STATUS.map((s) => ({
    ...s,
    total: filtrados.filter((r) => r.status === s.id).length,
  }));
  const unidades = [...new Set(todos.map((r) => r.unidade).filter(Boolean))] as string[];
  const irParaStatus = (status: Status) => {
    setStatusFiltro(status);
    setBusca("");
    setUnidadeFiltro("todos");
    const primeiro = todos.find((registro) => registro.status === status);
    const dataDestino = primeiro?.retorno_em || primeiro?.data_prevista;
    if (dataDestino) {
      setSemanaInicio(inicioDaSemana(dataDestino));
    }
  };

  const registrar = async (operacao: string, registroId: number, dadosNovos: unknown) => {
    await supabase.from("audit_logs").insert({
      user_id: sessao?.userId,
      usuario_nome: sessao?.nome,
      tabela: "agenda_marcacao",
      operacao,
      registro_id: String(registroId),
      dados_novos: dadosNovos as never,
    });
  };
  const salvar = useMutation({
    mutationFn: async (f: Formulario) => {
      const payload = {
        ...f,
        id: undefined,
        user_id: undefined,
        created_at: undefined,
        updated_at: undefined,
        nome_paciente: f.nome_paciente.trim() || null,
        telefone: f.telefone.trim() || null,
        exame: f.exame.trim() || null,
        data_prevista: f.data_prevista || null,
        updated_by: sessao?.userId,
      };
      delete (payload as Record<string, unknown>).id;
      delete (payload as Record<string, unknown>).user_id;
      delete (payload as Record<string, unknown>).created_at;
      delete (payload as Record<string, unknown>).updated_at;
      if (f.id) {
        const { error } = await supabase
          .from("agenda_marcacao")
          .update(payload as never)
          .eq("id", f.id)
          .eq("user_id" as never, (sessao?.userId ?? "") as never);
        if (error) throw error;
        await registrar("UPDATE", f.id, payload);
      } else {
        const { data, error } = await supabase
          .from("agenda_marcacao")
          .insert({ ...payload, user_id: sessao?.userId, created_by: sessao?.userId } as never)
          .select("id")
          .single();
        if (error) throw error;
        await registrar("INSERT", data.id, payload);
      }
    },
    onSuccess: () => {
      toast.success("Registro salvo.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["agenda-marcacao"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const excluir = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("agenda_marcacao")
        .delete()
        .eq("id", id)
        .eq("user_id" as never, (sessao?.userId ?? "") as never);
      if (error) throw error;
      await registrar("DELETE", id, null);
    },
    onSuccess: () => {
      toast.success("Registro excluído.");
      queryClient.invalidateQueries({ queryKey: ["agenda-marcacao"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function abrirWhatsApp(r: Registro) {
    const mensagem = window.prompt(
      "Edite a mensagem antes de abrir o WhatsApp:",
      "Olá.\n\nEstamos entrando em contato referente ao seu exame.\n\nPor favor responda esta mensagem ou entre em contato com a Clínica CEU.",
    );
    if (mensagem === null) return;
    window.open(
      `https://wa.me/${limparTelefone(r.telefone)}?text=${encodeURIComponent(mensagem)}`,
      "_blank",
      "noopener,noreferrer",
    );
    void registrar("WHATSAPP", r.id, { telefone: "oculto" });
  }
  function editar(r: Registro) {
    setForm({ ...r, id: r.id });
  }

  if (!carregandoSessao && !podeVer)
    return (
      <AppShell titulo="Minha Agenda">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso à Minha Agenda.
        </div>
      </AppShell>
    );
  return (
    <AppShell
      titulo="Minha Agenda"
      descricao={`Agenda pessoal • semana de ${isoParaBr(semanaInicio)}`}
      acoes={
        podeAdicionar && (
          <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
            <Plus className="mr-1.5 size-4" /> Novo registro
          </Button>
        )
      }
    >
      {lembretesAtivos.length > 0 && (
        <div className="mb-4 space-y-2">
          {lembretesAtivos.map((registro) => (
            <div
              key={registro.id}
              className="flex w-full animate-pulse items-center gap-3 rounded-xl border border-amber-400 bg-amber-50 p-4 text-left text-amber-950 shadow-sm dark:bg-amber-950/30 dark:text-amber-100"
            >
              <BellRing className="size-5 shrink-0" />
              <button
                type="button"
                onClick={() => editar(registro)}
                className="min-w-0 flex-1 text-left transition-colors hover:text-amber-700 dark:hover:text-amber-200"
                title="Clique para abrir o lembrete"
              >
                <span className="block text-xs font-semibold uppercase tracking-wide">
                  Lembrete da Minha Agenda
                </span>
                <span className="mt-0.5 block truncate text-sm font-medium">
                  {registro.lembrete}
                </span>
                <span className="mt-0.5 block text-xs opacity-75">
                  Clique para abrir o registro de {registro.nome_paciente || "este atendimento"}.
                </span>
              </button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-500/50 bg-transparent text-xs text-amber-900 hover:bg-amber-100 dark:text-amber-100"
                onClick={() => dispensarLembrete(registro)}
              >
                Marcar como lido
              </Button>
            </div>
          ))}
        </div>
      )}
      {menuContextual && (
        <div
          role="menu"
          className="fixed z-50 min-w-48 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
          style={{ left: menuContextual.x, top: menuContextual.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="px-2.5 py-1.5 text-xs text-muted-foreground">
            {isoParaBr(menuContextual.dia)}
          </p>
          <button
            type="button"
            className="w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-secondary"
            onClick={() => {
              if (podeAdicionar) setForm({ ...VAZIO, data_prevista: menuContextual.dia });
              setMenuContextual(null);
            }}
          >
            <Plus className="mr-2 inline size-4" /> Criar novo registro
          </button>
          <button
            type="button"
            disabled={!menuContextual.registro || !podeEditar}
            className="w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              if (menuContextual.registro) editar(menuContextual.registro);
              setMenuContextual(null);
            }}
          >
            <Pencil className="mr-2 inline size-4" /> Editar registro
          </button>
          <button
            type="button"
            disabled={!menuContextual.registro || !podeExcluir}
            className="w-full rounded-md px-2.5 py-2 text-left text-sm text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              if (menuContextual.registro && confirm("Limpar este registro da agenda?")) {
                excluir.mutate(menuContextual.registro.id);
              }
              setMenuContextual(null);
            }}
          >
            <Trash2 className="mr-2 inline size-4" /> Limpar registro
          </button>
        </div>
      )}
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {resumo.map((s) => (
            <button
              key={s.id}
              type="button"
              className="card-superficie flex items-center gap-2 p-3 text-left transition-colors hover:bg-secondary/40"
              onClick={() => irParaStatus(s.id)}
              title={`Mostrar registros: ${s.label}`}
            >
              <span className={`size-3 rounded-full ${s.bg}`} />
              <div>
                <p className={`text-xs font-medium ${s.cor}`}>{s.label}</p>
                <p className="text-xl font-semibold">{s.total}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Paciente, telefone, exame, convênio..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={unidadeFiltro} onValueChange={setUnidadeFiltro}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as unidades</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="card-superficie overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
            <div>
              <h2 className="text-base font-semibold">Minha agenda semanal</h2>
              <p className="text-xs text-muted-foreground">
                {isoParaBr(semanaInicio)} a {isoParaBr(somarDiasIso(semanaInicio, 6))}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSemanaInicio(somarDiasIso(semanaInicio, -7))}
                aria-label="Semana anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSemanaInicio(inicioDaSemana(hojeIso()))}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSemanaInicio(somarDiasIso(semanaInicio, 7))}
                aria-label="Próxima semana"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[72px_repeat(7,minmax(118px,1fr))] border-b border-border bg-secondary/20 text-center">
                <div className="border-r border-border p-3 text-[10px] font-medium uppercase text-muted-foreground">
                  Horário
                </div>
                {Array.from({ length: 7 }, (_, i) => {
                  const dia = somarDiasIso(semanaInicio, i);
                  return (
                    <button
                      key={dia}
                      type="button"
                      className={`border-r border-border p-2 text-xs ${dia === hojeIso() ? "bg-primary/10 text-primary" : ""}`}
                      onClick={() => podeAdicionar && setForm({ ...VAZIO, data_prevista: dia })}
                    >
                      <span className="block font-semibold uppercase">{rotuloDia(dia)}</span>
                      <span className="mt-1 block text-lg font-bold">{Number(dia.slice(-2))}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-[72px_repeat(7,minmax(118px,1fr))]">
                <div className="bg-secondary/10 text-[10px] text-muted-foreground">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className="h-20 border-b border-r border-border p-2 text-right">
                      {String(i + 8).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                {Array.from({ length: 7 }, (_, i) => {
                  const dia = somarDiasIso(semanaInicio, i);
                  const registrosDoDia = porDia.get(dia) ?? [];
                  return (
                    <div
                      key={dia}
                      className={`relative border-r border-border ${dia === hojeIso() ? "bg-primary/[0.03]" : ""}`}
                      onClick={(event) => {
                        if (event.target === event.currentTarget && podeAdicionar)
                          setForm({ ...VAZIO, data_prevista: dia });
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setMenuContextual({
                          x: event.clientX,
                          y: event.clientY,
                          dia,
                          registro: null,
                        });
                      }}
                    >
                      {Array.from({ length: 10 }, (_, row) => (
                        <div key={row} className="h-20 border-b border-border/70" />
                      ))}
                      <div className="absolute inset-x-1 top-1 space-y-1">
                        {registrosDoDia.map((r) => (
                          <div
                            key={r.id}
                            className={`group rounded-lg border-l-4 ${STATUS_MAP[r.status].bg} bg-card p-2 text-left text-[11px] shadow-sm`}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setMenuContextual({
                                x: event.clientX,
                                y: event.clientY,
                                dia,
                                registro: r,
                              });
                            }}
                          >
                            <button
                              type="button"
                              className="w-full text-left"
                              onClick={() => podeEditar && editar(r)}
                            >
                              <p className="truncate font-semibold">
                                {r.nome_paciente || "Paciente sem nome"}
                              </p>
                              <p className="mt-0.5 truncate text-muted-foreground">
                                {r.exame || "Exame não informado"}
                              </p>
                              <p className={`mt-1 font-medium ${STATUS_MAP[r.status].cor}`}>
                                {STATUS_MAP[r.status].label}
                              </p>
                            </button>
                            <div className="mt-1 hidden gap-2 group-hover:flex">
                              <button
                                type="button"
                                className="text-emerald-600"
                                title="WhatsApp"
                                onClick={() => abrirWhatsApp(r)}
                              >
                                <MessageCircle className="size-3" />
                              </button>
                              {podeExcluir && (
                                <button
                                  type="button"
                                  className="text-destructive"
                                  title="Excluir"
                                  onClick={() =>
                                    confirm("Excluir este registro?") && excluir.mutate(r.id)
                                  }
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        {registros.isLoading && <Skeleton className="h-20 w-full" />}
      </div>
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar registro" : "Novo registro"}</DialogTitle>
            <DialogDescription>
              Os registros são pessoais e ficam visíveis somente para o proprietário, inclusive para
              administradores.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome do Paciente</Label>
                <Input
                  value={form.nome_paciente}
                  onChange={(e) => setForm({ ...form, nome_paciente: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Exame</Label>
                <Input
                  value={form.exame}
                  onChange={(e) => setForm({ ...form, exame: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data Prevista</Label>
                <Input
                  type="date"
                  value={form.data_prevista ?? ""}
                  onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as Status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Input
                  value={form.unidade ?? ""}
                  onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Convênio</Label>
                <Input
                  value={form.convenio ?? ""}
                  onChange={(e) => setForm({ ...form, convenio: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Médico</Label>
                <Input
                  value={form.medico ?? ""}
                  onChange={(e) => setForm({ ...form, medico: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data de contato</Label>
                <Input
                  type="date"
                  value={form.data_contato ?? ""}
                  onChange={(e) => setForm({ ...form, data_contato: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Retorno em</Label>
                <Input
                  type="date"
                  value={form.retorno_em ?? ""}
                  onChange={(e) => setForm({ ...form, retorno_em: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observação</Label>
                <Textarea
                  value={form.observacao ?? ""}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações internas</Label>
                <Textarea
                  value={form.observacoes_internas ?? ""}
                  onChange={(e) => setForm({ ...form, observacoes_internas: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Lembrete</Label>
                <Input
                  placeholder="Ex.: Ligar para confirmar exame"
                  value={form.lembrete ?? ""}
                  onChange={(e) => setForm({ ...form, lembrete: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data/hora do lembrete</Label>
                <Input
                  type="datetime-local"
                  value={form.lembrete_em ? form.lembrete_em.slice(0, 16) : ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lembrete_em: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                salvar.isPending || (!!form?.id && !podeEditar) || (!form?.id && !podeAdicionar)
              }
              onClick={() => form && salvar.mutate(form)}
            >
              {salvar.isPending ? "Salvando..." : "Salvar registro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
