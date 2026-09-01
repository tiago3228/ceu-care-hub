import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
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
    itens: [{ rotulo: "Painel", para: "/dashboard" as const, icone: LayoutDashboard, disponivel: true }],
  },
  {
    grupo: "Operação",
    itens: [
      { rotulo: "Escala semanal", para: "/escala" as const, icone: CalendarDays, modulo: "escalas" },
      { rotulo: "Salas de exame", para: "/salas" as const, icone: DoorOpen, modulo: "salas" },
      { rotulo: "Ausências", para: "/dashboard" as const, icone: CalendarOff, modulo: "ausencias" },
    ],
  },
  {
    grupo: "Pessoas",
    itens: [
      { rotulo: "Colaboradoras", para: "/colaboradoras" as const, icone: Users, modulo: "colaboradoras" },
      { rotulo: "Médicos", para: "/medicos" as const, icone: Stethoscope, modulo: "medicos" },
    ],
  },
  {
    grupo: "Suprimentos",
    itens: [
      { rotulo: "Itens e materiais", para: "/itens" as const, icone: Boxes, modulo: "itens" },
      { rotulo: "Estoque", para: "/estoque" as const, icone: Package, modulo: "estoque" },
      { rotulo: "Solicitações", para: "/solicitacoes" as const, icone: ClipboardList, modulo: "solicitacoes" },
    ],
  },
  {
    grupo: "Enfermagem",
    itens: [
      { rotulo: "Atendimentos", para: "/enfermagem" as const, icone: HeartPulse, modulo: "enfermagem" },
      { rotulo: "Pacientes", para: "/pacientes" as const, icone: Users, modulo: "enfermagem" },
      { rotulo: "Sondas", para: "/sondas" as const, icone: Waves, modulo: "sondas" },
    ],
  },
  {
    grupo: "Apoio",
    itens: [
      { rotulo: "Notas", para: "/dashboard" as const, icone: StickyNote, modulo: "notas" },
      { rotulo: "Relatórios", para: "/dashboard" as const, icone: BarChart3, modulo: "relatorios" },
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const caminho = useRouterState({ select: (s) => s.location.pathname });

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
      </div>
    </div>
  );
}
