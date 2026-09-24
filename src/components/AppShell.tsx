import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, BellRing, GripVertical, LogOut, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/hooks/use-sessao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  agruparMenu,
  MENU_ICONS,
  MENU_PADRAO,
  normalizarIconeMenu,
  type MenuItemDefinition,
} from "@/lib/menu";

interface PendenciaValidade {
  id: number;
  lote_id: number;
  item_id: number;
  item_nome: string;
  lote: string | null;
  validade: string;
  quantidade: number;
  status: string;
}

interface MenuConfigRow {
  chave: unknown;
  grupo: unknown;
  grupo_ordem: unknown;
  rotulo: unknown;
  destino: unknown;
  icone: unknown;
  modulo: unknown;
  ordem: unknown;
  somente_admin: unknown;
}

type MenuOrderKind = "grupo" | "item";

interface MenuOrderRow {
  tipo: MenuOrderKind;
  chave: string;
  ordem: number;
}

type GrupoMenu = ReturnType<typeof agruparMenu>[number];

function extrairOrdemMenu(grupos: GrupoMenu[]): MenuOrderRow[] {
  return grupos.flatMap((grupo, grupoIndex) => [
    { tipo: "grupo", chave: grupo.grupo, ordem: grupoIndex },
    ...grupo.itens.map((item, itemIndex) => ({
      tipo: "item" as const,
      chave: item.chave,
      ordem: itemIndex,
    })),
  ]);
}

function aplicarOrdemMenu(grupos: GrupoMenu[], ordens: MenuOrderRow[]) {
  const ordemGrupos = new Map(
    ordens.filter((item) => item.tipo === "grupo").map((item) => [item.chave, item.ordem]),
  );
  const ordemItens = new Map(
    ordens.filter((item) => item.tipo === "item").map((item) => [item.chave, item.ordem]),
  );
  return [...grupos]
    .map((grupo, grupoIndex) => ({
      ...grupo,
      itens: [...grupo.itens].sort(
        (a, b) =>
          (ordemItens.get(a.chave) ?? grupo.itens.indexOf(a)) -
          (ordemItens.get(b.chave) ?? grupo.itens.indexOf(b)),
      ),
      ordemPersonalizada: ordemGrupos.get(grupo.grupo) ?? grupoIndex,
    }))
    .sort((a, b) => a.ordemPersonalizada - b.ordemPersonalizada)
    .map(({ ordemPersonalizada: _ordemPersonalizada, ...grupo }) => grupo);
}

const MENU_ADMINISTRATIVO: MenuItemDefinition[] = [
  {
    chave: "configuracao-menu",
    grupo: "Sistema",
    grupoOrdem: 70,
    rotulo: "Configuração do menu",
    destino: "/configuracao-menu",
    icone: "Settings",
    modulo: null,
    ordem: 5,
    somenteAdmin: true,
  },
  {
    chave: "perfis-setor",
    grupo: "Sistema",
    grupoOrdem: 70,
    rotulo: "Perfis por Setor",
    destino: "/perfis-setor",
    icone: "Settings",
    modulo: null,
    ordem: 20,
    somenteAdmin: true,
  },
  {
    chave: "usuarios",
    grupo: "Sistema",
    grupoOrdem: 70,
    rotulo: "Usuários e permissões",
    destino: "/usuarios",
    icone: "Users",
    modulo: null,
    ordem: 30,
    somenteAdmin: true,
  },
  {
    chave: "sobre",
    grupo: "Sistema",
    grupoOrdem: 70,
    rotulo: "Sobre o sistema",
    destino: "/sobre",
    icone: "Settings",
    modulo: null,
    ordem: 40,
    somenteAdmin: true,
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
  const [pendenciaAlertaFechada, setPendenciaAlertaFechada] = useState(false);
  const alertaSomEmitido = useRef(false);
  const [arraste, setArraste] = useState<{ tipo: MenuOrderKind; chave: string } | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const menuConfigurado = useQuery({
    queryKey: ["menu-itens"],
    enabled: !!sessao,
    queryFn: async () => {
      // A tabela é criada pela migration e ainda não aparece nos tipos gerados do Supabase.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("menu_itens")
        .select("id,chave,grupo,grupo_ordem,rotulo,destino,icone,modulo,ordem,ativo,somente_admin")
        .eq("ativo", true)
        .order("grupo_ordem")
        .order("ordem")
        .order("rotulo");
      if (error) {
        // Mantém o menu padrão enquanto a migration ainda não foi aplicada no ambiente.
        console.warn("Não foi possível carregar a configuração do menu", error);
        return null;
      }
      return (data ?? []).map((item: MenuConfigRow) => ({
        chave: String(item.chave),
        grupo: String(item.grupo),
        grupoOrdem: Number(item.grupo_ordem ?? 100),
        rotulo: String(item.rotulo),
        destino: String(item.destino),
        icone: normalizarIconeMenu(String(item.icone)),
        modulo: item.modulo ? String(item.modulo) : null,
        ordem: Number(item.ordem ?? 100),
        somenteAdmin: Boolean(item.somente_admin),
      })) as MenuItemDefinition[];
    },
  });
  const ordemMenu = useQuery({
    queryKey: ["menu-ordem-usuario", sessao?.userId],
    enabled: !!sessao,
    queryFn: async () => {
      // A tabela é criada pela migration e ainda não aparece nos tipos gerados do Supabase.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("menu_ordens_usuario")
        .select("tipo,chave,ordem")
        .eq("usuario_id", sessao?.userId)
        .order("ordem");
      if (error) {
        console.warn("Não foi possível carregar a ordem personalizada do menu", error);
        return [] as MenuOrderRow[];
      }
      return (data ?? []).filter(
        (item: { tipo: string; chave: string; ordem: number }) =>
          (item.tipo === "grupo" || item.tipo === "item") && Number.isFinite(Number(item.ordem)),
      ) as MenuOrderRow[];
    },
  });
  const itensMenu = useMemo(() => menuConfigurado.data ?? MENU_PADRAO, [menuConfigurado.data]);
  const gruposMenuBase = agruparMenu(
    [...itensMenu, ...(isAdmin ? MENU_ADMINISTRATIVO : [])].filter(
      (item) => (!item.somenteAdmin || isAdmin) && (!item.modulo || temModulo(item.modulo)),
    ),
  );
  const gruposMenu = useMemo(
    () => aplicarOrdemMenu(gruposMenuBase, ordemMenu.data ?? []),
    [gruposMenuBase, ordemMenu.data],
  );
  const salvarOrdemMenu = useMutation({
    mutationFn: async (ordens: MenuOrderRow[]) => {
      if (!sessao?.userId) return;
      // A tabela é criada pela migration e ainda não aparece nos tipos gerados do Supabase.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: apagarErro } = await (supabase as any)
        .from("menu_ordens_usuario")
        .delete()
        .eq("usuario_id", sessao.userId);
      if (apagarErro) throw apagarErro;
      if (!ordens.length) return;
      // A tabela é criada pela migration e ainda não aparece nos tipos gerados do Supabase.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("menu_ordens_usuario")
        .insert(ordens.map((item) => ({ ...item, usuario_id: sessao.userId })));
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["menu-ordem-usuario", sessao?.userId] });
    },
    onError: (error) =>
      toast.error(`Não foi possível salvar a ordem do menu: ${(error as Error).message}`),
  });

  function moverGrupo(grupoOrigem: string, grupoDestino: string) {
    if (grupoOrigem === grupoDestino) return;
    const origem = gruposMenu.findIndex((grupo) => grupo.grupo === grupoOrigem);
    const destino = gruposMenu.findIndex((grupo) => grupo.grupo === grupoDestino);
    if (origem < 0 || destino < 0) return;
    const proximo = [...gruposMenu];
    const [movido] = proximo.splice(origem, 1);
    if (!movido) return;
    proximo.splice(destino, 0, movido);
    salvarOrdemMenu.mutate(extrairOrdemMenu(proximo));
  }

  function moverItem(grupoNome: string, itemOrigem: string, itemDestino: string) {
    if (itemOrigem === itemDestino) return;
    const grupo = gruposMenu.find((atual) => atual.grupo === grupoNome);
    if (!grupo) return;
    const origem = grupo.itens.findIndex((item) => item.chave === itemOrigem);
    const destino = grupo.itens.findIndex((item) => item.chave === itemDestino);
    if (origem < 0 || destino < 0) return;
    const proximo = gruposMenu.map((atual) => {
      if (atual.grupo !== grupoNome) return atual;
      const itens = [...atual.itens];
      const [movido] = itens.splice(origem, 1);
      if (movido) itens.splice(destino, 0, movido);
      return { ...atual, itens };
    });
    salvarOrdemMenu.mutate(extrairOrdemMenu(proximo));
  }
  const pendencias = useQuery({
    queryKey: ["pendencias-validade"],
    enabled: !!sessao && temModulo("pendencias_validade_visualizar"),
    refetchInterval: 60_000,
    queryFn: async () => {
      // As funções são criadas pela migration e ainda não aparecem nos tipos gerados.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const sincronizacao = await db.rpc("sincronizar_pendencias_validade");
      if (sincronizacao.error) throw sincronizacao.error;
      const resultado = await db.rpc("listar_pendencias_validade");
      if (resultado.error) throw resultado.error;
      return (resultado.data ?? []) as PendenciaValidade[];
    },
  });
  const pendenciasAbertas = pendencias.data ?? [];
  const resolverPendencia = async (id: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await (supabase as any).rpc("resolver_pendencia_validade", { p_id: id });
    if (resultado.error) throw resultado.error;
    await queryClient.invalidateQueries({ queryKey: ["pendencias-validade"] });
  };
  useEffect(() => {
    if (!pendenciasAbertas.length) setPendenciaAlertaFechada(false);
  }, [pendenciasAbertas.length]);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          <img src="/logo-ceu.png" alt="CEU Diagnósticos" className="h-auto w-32 object-contain" />
          <p className="mt-1 text-xs text-sidebar-foreground/60">Gestão de Sistemas</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {gruposMenu.map((grupo) => {
            if (!grupo.itens.length) return null;
            return (
              <div key={grupo.grupo} className="mb-5">
                <p
                  draggable
                  onDragStart={() => setArraste({ tipo: "grupo", chave: grupo.grupo })}
                  onDragEnd={() => setArraste(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (arraste?.tipo === "grupo") moverGrupo(arraste.chave, grupo.grupo);
                    setArraste(null);
                  }}
                  title="Arraste para reordenar os grupos do menu"
                  className="flex cursor-grab items-center gap-1 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45 active:cursor-grabbing"
                >
                  <GripVertical className="size-3 shrink-0" />
                  {grupo.grupo}
                </p>
                <ul className="space-y-0.5">
                  {grupo.itens.map((item) => {
                    const Icone = MENU_ICONS[item.icone];
                    const ativo = caminho === item.destino;
                    const classe = cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      ativo
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    );
                    return (
                      <li
                        key={item.chave}
                        draggable
                        onDragStart={() => setArraste({ tipo: "item", chave: item.chave })}
                        onDragEnd={() => setArraste(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (arraste?.tipo === "item") {
                            moverItem(grupo.grupo, arraste.chave, item.chave);
                          }
                          setArraste(null);
                        }}
                        title="Arraste para reordenar dentro deste grupo"
                        className="cursor-grab active:cursor-grabbing"
                      >
                        {/^https?:\/\//i.test(item.destino) ? (
                          <a
                            href={item.destino}
                            className={classe}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <GripVertical className="size-3 shrink-0 opacity-40" />
                            <Icone className="size-4 shrink-0" />
                            {item.rotulo}
                          </a>
                        ) : (
                          <Link to={item.destino as never} className={classe}>
                            <GripVertical className="size-3 shrink-0 opacity-40" />
                            <Icone className="size-4 shrink-0" />
                            {item.rotulo}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
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
            {sessao && temModulo("pendencias_validade_visualizar") && (
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-1.5 border-2",
                  pendenciasAbertas.length
                    ? "animate-pulse border-red-500 bg-red-50 text-red-700 hover:bg-red-100"
                    : "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                )}
                onClick={() => setPendenciaAlertaFechada((fechada) => !fechada)}
              >
                <TriangleAlert className="size-4" />
                Pendências{pendenciasAbertas.length ? ` (${pendenciasAbertas.length})` : ""}
              </Button>
            )}
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
        {sessao &&
          temModulo("pendencias_validade_visualizar") &&
          !pendenciaAlertaFechada &&
          pendenciasAbertas.length > 0 && (
            <section className="border-b border-red-200 bg-red-50 px-5 py-3 text-red-950">
              <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <TriangleAlert className="size-4 shrink-0 text-red-600" />
                    Pendências de validade ({pendenciasAbertas.length})
                  </p>
                  <div className="mt-2 space-y-2">
                    {pendenciasAbertas.map((pendencia) => (
                      <div
                        key={pendencia.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-white px-3 py-2 text-xs"
                      >
                        <span>
                          <strong>{pendencia.item_nome}</strong> · lote {pendencia.lote || "—"} ·
                          vencido em {pendencia.validade}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                          onClick={() =>
                            resolverPendencia(pendencia.id).catch((error) =>
                              console.error("Não foi possível resolver a pendência", error),
                            )
                          }
                        >
                          Pendência resolvida
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-red-700"
                  onClick={() => setPendenciaAlertaFechada(true)}
                >
                  Fechar
                </Button>
              </div>
            </section>
          )}
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
