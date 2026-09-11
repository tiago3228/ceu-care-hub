import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Users,
  Stethoscope,
  DoorOpen,
  CalendarOff,
  Package,
  Boxes,
  ClipboardList,
  HeartPulse,
  Waves,
  BarChart3,
  Settings,
  LogOut,
  LayoutDashboard,
  StickyNote,
  ArrowLeft,
  Phone,
  KeyRound,
  Network,
  CalendarHeart,
  BellRing,
  MonitorCog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/hooks/use-sessao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ModuloChave } from "@/lib/modulos";

interface ItemMenu {
  rotulo: string;
  para: string;
  icone: typeof Users;
  modulo?: ModuloChave;
  disponivel?: boolean;
}

const MENU: { grupo: string; itens: ItemMenu[] }[] = [
  {
    grupo: "Visão geral",
    itens: [
      { rotulo: "Painel", para: "/dashboard" as const, icone: LayoutDashboard, disponivel: true },
      { rotulo: "Ramais", para: "/ramais" as const, icone: Phone, disponivel: true },
    ],
  },

  {
    grupo: "Operação",
    itens: [
      {
        rotulo: "Escala semanal",
        para: "/escala" as const,
        icone: CalendarDays,
        modulo: "escalas",
      },
      { rotulo: "Salas de exame", para: "/salas" as const, icone: DoorOpen, modulo: "salas" },
      { rotulo: "Ausências", para: "/dashboard" as const, icone: CalendarOff, modulo: "ausencias" },
    ],
  },
  {
    grupo: "Pessoas",
    itens: [
      {
        rotulo: "Colaboradoras",
        para: "/colaboradoras" as const,
        icone: Users,
        modulo: "colaboradoras",
      },
      { rotulo: "Médicos", para: "/medicos" as const, icone: Stethoscope, modulo: "medicos" },
    ],
  },
  {
    grupo: "Suprimentos",
    itens: [
      { rotulo: "Itens e materiais", para: "/itens" as const, icone: Boxes, modulo: "itens" },
      { rotulo: "Estoque", para: "/estoque" as const, icone: Package, modulo: "estoque" },
      {
        rotulo: "Solicitações",
        para: "/solicitacoes" as const,
        icone: ClipboardList,
        modulo: "solicitacoes",
      },
    ],
  },
  {
    grupo: "Enfermagem",
    itens: [
      {
        rotulo: "Atendimentos",
        para: "/enfermagem" as const,
        icone: HeartPulse,
        modulo: "enfermagem",
      },
      { rotulo: "Pacientes", para: "/pacientes" as const, icone: Users, modulo: "enfermagem" },
      { rotulo: "Sondas", para: "/sondas" as const, icone: Waves, modulo: "sondas" },
    ],
  },
  {
    grupo: "Apoio",
    itens: [
      { rotulo: "Notas", para: "/notas" as const, icone: StickyNote, modulo: "notas" },
      { rotulo: "Lembretes", para: "/lembretes" as const, icone: BellRing, modulo: "lembretes" },
      {
        rotulo: "Aparelhos de US / Equipamentos",
        para: "/equipamentos-us" as const,
        icone: MonitorCog,
        modulo: "equipamentos_us",
      },
      {
        rotulo: "Minha Agenda",
        para: "/agenda-marcacao" as const,
        icone: CalendarHeart,
        modulo: "agenda_marcacao",
      },
      {
        rotulo: "Relatórios",
        para: "/relatorios" as const,
        icone: BarChart3,
        modulo: "relatorios",
      },
      { rotulo: "Senhas", para: "/senhas" as const, icone: KeyRound, modulo: "senhas" },
    ],
  },
  {
    grupo: "Rede",
    itens: [
      {
        rotulo: "Controle de IP",
        para: "/controle-ip" as const,
        icone: Network,
        modulo: "controle_ip",
      },
    ],
  },
];

export function AppShell({
  titulo,
  descricao,
  acoes,
  children,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  const { sessao, isAdmin, temModulo } = useSessao();
  const [lembreteAberto, setLembreteAberto] = useState<number | null>(null);
  const [popupsDispensados, setPopupsDispensados] = useState<number[]>([]);
  const alertaSomEmitido = useRef(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const lembretes = useQuery({
    queryKey: ["lembretes-alertas"],
    enabled: !!sessao && temModulo("lembretes"),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lembretes")
        .select("id,titulo,data_lembrete,hora_lembrete,status,adiado_ate,popup_ativo")
        .in("status", ["pendente", "adiado"])
        .order("data_lembrete")
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const preferencias = useQuery({
    queryKey: ["preferencias-lembretes", sessao?.userId],
    enabled: !!sessao,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("preferencias_lembretes")
        .eq("id", sessao?.userId)
        .maybeSingle();
      return (data?.preferencias_lembretes ?? { som: false, popup: true }) as {
        som?: boolean;
        popup?: boolean;
      };
    },
  });
  const alertasLembretes = (lembretes.data ?? []).filter((lembrete) => {
    if (
      lembrete.status === "adiado" &&
      lembrete.adiado_ate &&
      new Date(lembrete.adiado_ate).getTime() > Date.now()
    )
      return false;
    const hoje = new Date().toISOString().slice(0, 10);
    if (lembrete.data_lembrete < hoje) return true;
    if (lembrete.data_lembrete > hoje) return false;
    return (
      !lembrete.hora_lembrete || lembrete.hora_lembrete <= new Date().toTimeString().slice(0, 8)
    );
  });
  useEffect(() => {
    if (
      alertasLembretes.length &&
      preferencias.data?.popup !== false &&
      lembreteAberto === null &&
      !popupsDispensados.includes(alertasLembretes[0]?.id ?? -1)
    )
      setLembreteAberto(alertasLembretes[0]?.id ?? null);
  }, [alertasLembretes, lembreteAberto, popupsDispensados, preferencias.data?.popup]);
  useEffect(() => {
    if (!alertasLembretes.length || !preferencias.data?.som || alertaSomEmitido.current) return;
    alertaSomEmitido.current = true;
    try {
      const contexto = new AudioContext();
      const oscilador = contexto.createOscillator();
      const ganho = contexto.createGain();
      oscilador.frequency.value = 660;
      ganho.gain.value = 0.04;
      oscilador.connect(ganho);
      ganho.connect(contexto.destination);
      oscilador.start();
      oscilador.stop(contexto.currentTime + 0.25);
    } catch {
      // O navegador pode bloquear áudio automático antes de uma interação.
    }
  }, [alertasLembretes, preferencias.data?.som]);

  function voltar() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate({ to: "/dashboard" });
  }

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const iniciais = (sessao?.nome ?? "U")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <p className="font-display text-base font-semibold leading-tight">Clínica CEU</p>
          <p className="mt-1 text-xs text-sidebar-foreground/60">Gestão de Sistemas</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {MENU.map((grupo) => {
            const itens = grupo.itens.filter(
              (i) => i.disponivel || (i.modulo ? temModulo(i.modulo) : false),
            );
            if (!itens.length) return null;
            return (
              <div key={grupo.grupo} className="mb-5">
                <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                  {grupo.grupo}
                </p>
                <ul className="space-y-0.5">
                  {itens.map((item) => {
                    const ativo = caminho === item.para && item.rotulo === "Painel";
                    return (
                      <li key={grupo.grupo + item.rotulo}>
                        <Link
                          to={item.para}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                            ativo
                              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <item.icone className="size-4 shrink-0" />
                          {item.rotulo}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {isAdmin && (
            <div className="mb-5">
              <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                Sistema
              </p>
              <ul className="space-y-0.5">
                <li>
                  <Link
                    to="/perfis-setor"
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      caminho === "/perfis-setor"
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                    )}
                  >
                    <Settings className="size-4" /> Perfis por Setor
                  </Link>
                </li>
                <li>
                  <Link
                    to="/usuarios"
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      caminho === "/usuarios"
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                    )}
                  >
                    <Users className="size-4" /> Usuários e permissões
                  </Link>
                </li>
                <li>
                  <Link
                    to="/sobre"
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      caminho === "/sobre"
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                    )}
                  >
                    <Settings className="size-4" /> Sobre o sistema
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {alertasLembretes.length > 0 && (
          <button
            className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-5 py-2 text-left text-sm font-semibold text-amber-900"
            onClick={() => setLembreteAberto(alertasLembretes[0]?.id ?? null)}
          >
            <BellRing className="size-4 shrink-0" /> Você possui {alertasLembretes.length}{" "}
            lembrete(s) vencido(s) ou vencendo agora.
          </button>
        )}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            {caminho !== "/dashboard" && (
              <Button
                variant="outline"
                size="sm"
                onClick={voltar}
                aria-label="Voltar"
                className="shrink-0 gap-1.5"
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-foreground">{titulo}</h1>
              {descricao && <p className="truncate text-sm text-muted-foreground">{descricao}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {acoes}
            <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/60 py-1 pl-1 pr-3">
              <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {iniciais}
              </span>
              <span className="hidden text-xs leading-tight sm:block">
                <span className="block font-medium text-foreground">{sessao?.nome}</span>
                <span className="block text-muted-foreground">
                  {sessao?.papeis[0]?.replace("_", " ") ?? "sem perfil"}
                </span>
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={sair} aria-label="Sair do sistema">
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 px-5 py-6">{children}</main>
        <footer className="border-t border-border px-5 py-4 text-center text-xs text-muted-foreground">
          By Tiago Cardoso
        </footer>
        {preferencias.data?.popup !== false &&
          lembreteAberto !== null &&
          !popupsDispensados.includes(lembreteAberto) &&
          alertasLembretes.some((l) => l.id === lembreteAberto) && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
              <div className="w-full max-w-md rounded-lg border border-amber-300 bg-card p-6 shadow-xl">
                <div className="flex items-center gap-2 text-amber-700">
                  <BellRing className="size-5" />
                  <h2 className="font-semibold">Lembrete</h2>
                </div>
                {(() => {
                  const lembrete = alertasLembretes.find((l) => l.id === lembreteAberto);
                  return lembrete ? (
                    <>
                      <p className="mt-4 text-lg font-semibold">{lembrete.titulo}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {lembrete.data_lembrete} {lembrete.hora_lembrete ?? ""}
                      </p>
                    </>
                  ) : null;
                })()}
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPopupsDispensados((atuais) => [...atuais, lembreteAberto]);
                      setLembreteAberto(null);
                    }}
                  >
                    Fechar
                  </Button>
                  <Button
                    onClick={() => {
                      setPopupsDispensados((atuais) => [...atuais, lembreteAberto]);
                      setLembreteAberto(null);
                      navigate({ to: "/lembretes" });
                    }}
                  >
                    Abrir lembretes
                  </Button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
