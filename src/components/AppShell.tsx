import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BellRing,
  Download,
  GripVertical,
  HeartPulse,
  LogOut,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/hooks/use-sessao";
import { cn } from "@/lib/utils";
import { hojeIso, somarDiasIso } from "@/lib/datas";
import {
  emitirSomNotificacao,
  marcarLembretesJaNotificados,
  reservarSomParaLembrete,
} from "@/lib/notification-sound";
import { Button } from "@/components/ui/button";
import {
  agruparMenu,
  MENU_ICONS,
  MENU_PADRAO,
  normalizarIconeMenu,
  type MenuItemDefinition,
} from "@/lib/menu";
import { isEscalaCeuInstalled, openEscalaCeuInstallPrompt } from "@/lib/instalacao-app";

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

interface PendenciaFornecedor {
  id: number;
  documento_nome: string;
  fornecedor_nome: string;
  validade: string;
}

interface PendenciaExibicao {
  chave: string;
  item_nome: string;
  lote: string | null;
  validade: string;
  origem: "estoque" | "fornecedor";
  id: number;
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

interface AtalhoMenuRow {
  id: number;
  chave: string;
  rotulo: string;
  destino: string;
  icone: string;
  ordem: number;
}

type GrupoMenu = ReturnType<typeof agruparMenu>[number];

function normalizarRotuloMenu(chave: string, rotulo: string) {
  if (
    (chave === "colaboradoras" || chave === "colaboradoras-enfermagem") &&
    rotulo.trim().toLocaleLowerCase() === "colaborar"
  ) {
    return "Colaboradoras";
  }
  return rotulo;
}

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
  const [aplicativoInstalado, setAplicativoInstalado] = useState(false);
  // Menu lateral recolhível: mesmo comportamento do Aura Studio — fica no trilho
  // de ícones e expande ao passar o mouse (ou ao focar pelo teclado).
  const [menuExpandido, setMenuExpandido] = useState(false);
  const usuarioAlertasInicializados = useRef<string | null>(null);
  const [arraste, setArraste] = useState<{ tipo: MenuOrderKind; chave: string } | null>(null);
  const [atalhoContextual, setAtalhoContextual] = useState<{
    item: MenuItemDefinition;
    x: number;
    y: number;
  } | null>(null);
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
        rotulo: normalizarRotuloMenu(String(item.chave), String(item.rotulo)),
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
  const atalhos = useQuery({
    queryKey: ["atalhos-dashboard", sessao?.userId],
    enabled: !!sessao,
    queryFn: async () => {
      // A tabela é criada pela migration e ainda não aparece nos tipos gerados do Supabase.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("atalhos_dashboard_usuario")
        .select("id,chave,rotulo,destino,icone,ordem")
        .eq("usuario_id", sessao?.userId)
        .order("ordem")
        .order("rotulo");
      if (error) {
        console.warn("Não foi possível carregar os atalhos do dashboard", error);
        return [] as AtalhoMenuRow[];
      }
      return (data ?? []) as AtalhoMenuRow[];
    },
  });
  const criarAtalho = useMutation({
    mutationFn: async (item: MenuItemDefinition) => {
      if (!sessao?.userId) return;
      // A tabela é criada pela migration e ainda não aparece nos tipos gerados do Supabase.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("atalhos_dashboard_usuario").insert({
        usuario_id: sessao.userId,
        chave: item.chave,
        rotulo: item.rotulo,
        destino: item.destino,
        icone: item.icone,
        ordem: atalhos.data?.length ?? 0,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Este atalho já está no seu dashboard.");
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Atalho criado no dashboard.");
      setAtalhoContextual(null);
      await queryClient.invalidateQueries({ queryKey: ["atalhos-dashboard", sessao?.userId] });
    },
    onError: (error) => toast.error((error as Error).message),
  });
  useEffect(() => {
    const fechar = () => setAtalhoContextual(null);
    window.addEventListener("scroll", fechar, true);
    return () => window.removeEventListener("scroll", fechar, true);
  }, []);
  useEffect(() => {
    const atualizarEstadoInstalacao = () => setAplicativoInstalado(isEscalaCeuInstalled());
    atualizarEstadoInstalacao();
    window.addEventListener("appinstalled", atualizarEstadoInstalacao);
    return () => window.removeEventListener("appinstalled", atualizarEstadoInstalacao);
  }, []);
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
  const pendenciasFornecedores = useQuery({
    queryKey: ["pendencias-fornecedor-documentos"],
    enabled: !!sessao && temModulo("fornecedores"),
    refetchInterval: 60_000,
    queryFn: async () => {
      // Estas tabelas são criadas pela migration de fornecedores e ainda não aparecem nos tipos gerados.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [documentos, fornecedores] = await Promise.all([
        db.from("fornecedor_documentos").select("id,nome,fornecedor_id,validade"),
        db.from("fornecedores").select("id,nome").eq("ativo", true),
      ]);
      if (documentos.error) throw documentos.error;
      if (fornecedores.error) throw fornecedores.error;
      const nomes = new Map(
        (fornecedores.data ?? []).map((fornecedor: { id: number; nome: string }) => [
          fornecedor.id,
          fornecedor.nome,
        ]),
      );
      const hoje = hojeIso();
      const limite = somarDiasIso(hoje, 30);
      return (
        (documentos.data ?? []) as Array<{
          id: number;
          nome: string;
          fornecedor_id: number;
          validade: string | null;
        }>
      )
        .filter(
          (documento) =>
            !!documento.validade &&
            documento.validade.slice(0, 10) <= limite &&
            documento.validade.slice(0, 10) >= "0000-01-01",
        )
        .map(
          (documento) =>
            ({
              id: documento.id,
              documento_nome: documento.nome,
              fornecedor_nome: String(
                nomes.get(documento.fornecedor_id) ?? "Fornecedor não identificado",
              ),
              validade: documento.validade as string,
            }) satisfies PendenciaFornecedor,
        );
    },
  });
  const pendenciasAbertas: PendenciaExibicao[] = [
    ...(pendencias.data ?? []).map((item) => ({
      chave: `estoque-${item.id}`,
      item_nome: item.item_nome,
      lote: item.lote,
      validade: item.validade,
      origem: "estoque" as const,
      id: item.id,
    })),
    ...(pendenciasFornecedores.data ?? []).map((item) => ({
      chave: `fornecedor-${item.id}`,
      item_nome: `${item.documento_nome} · ${item.fornecedor_nome}`,
      lote: null,
      validade: item.validade,
      origem: "fornecedor" as const,
      id: item.id,
    })),
  ];
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
    if (!sessao?.userId || !lembretes.isSuccess || !preferencias.isSuccess) return;
    const eventos = alertasLembretes.map(
      (lembrete) =>
        `global:${lembrete.id}:${lembrete.data_lembrete}:${lembrete.hora_lembrete ?? ""}:${lembrete.adiado_ate ?? ""}`,
    );
    if (usuarioAlertasInicializados.current !== sessao.userId) {
      usuarioAlertasInicializados.current = sessao.userId;
      marcarLembretesJaNotificados(sessao.userId, eventos);
      return;
    }
    if (preferencias.data?.som !== true) return;
    eventos.forEach((evento) => {
      if (reservarSomParaLembrete(sessao.userId, evento)) emitirSomNotificacao();
    });
  }, [
    alertasLembretes,
    lembretes.isSuccess,
    preferencias.data?.som,
    preferencias.isSuccess,
    sessao?.userId,
  ]);

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
      <aside
        aria-label="Menu de navegação"
        className={cn(
          "sticky top-0 hidden h-screen min-h-0 shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
          menuExpandido ? "w-64 shadow-xl" : "w-20",
        )}
        onMouseEnter={() => setMenuExpandido(true)}
        onMouseLeave={() => setMenuExpandido(false)}
        onFocus={() => setMenuExpandido(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setMenuExpandido(false);
          }
        }}
      >
        <div
          className={cn(
            "border-b border-sidebar-border",
            menuExpandido ? "px-5 py-5" : "px-3 py-4",
          )}
        >
          <div className={cn(!menuExpandido && "flex justify-center")}>
            <a
              href="/dashboard"
              aria-label="Ir para o dashboard"
              className="inline-block rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              {menuExpandido ? (
                <img
                  src="/logo-ceu.png"
                  alt="CEU Diagnósticos"
                  className="h-auto w-32 object-contain"
                />
              ) : (
                <span
                  title="CEU Diagnósticos · Gestão de Sistemas"
                  className="grid size-10 place-items-center rounded-xl bg-sidebar-primary/15 text-sidebar-primary"
                >
                  <HeartPulse className="size-5" />
                </span>
              )}
            </a>
          </div>
          {menuExpandido && (
            <p className="mt-1 text-xs text-sidebar-foreground/60">Gestão de Sistemas</p>
          )}
        </div>
        <nav
          className={cn(
            "min-h-0 flex-1 overflow-y-scroll",
            // A barra de rolagem do menu é sempre visível e necessária. Recolhido,
            // o espaço dela é reservado nos dois lados para os ícones ficarem
            // centralizados no trilho, alinhados à marca.
            menuExpandido
              ? "px-3 py-4 [scrollbar-gutter:stable]"
              : "px-2 py-4 [scrollbar-gutter:stable_both-edges]",
          )}
        >
          {gruposMenu.map((grupo) => {
            if (!grupo.itens.length) return null;
            return (
              <div
                key={grupo.grupo}
                className={cn(
                  menuExpandido
                    ? "mb-5"
                    : "mb-3 border-t border-sidebar-border/50 pt-3 first:border-t-0 first:pt-0",
                )}
              >
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
                  className={cn(
                    "flex cursor-grab items-center gap-1 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45 active:cursor-grabbing",
                    !menuExpandido && "hidden",
                  )}
                >
                  <GripVertical className="size-3 shrink-0" />
                  {grupo.grupo}
                </p>
                <ul className="space-y-0.5">
                  {grupo.itens.map((item) => {
                    const Icone = MENU_ICONS[item.icone];
                    const ativo = caminho === item.destino;
                    const classe = cn(
                      "flex items-center rounded-md py-2 text-sm transition-colors",
                      menuExpandido ? "gap-2.5 px-2.5" : "justify-center px-2",
                      ativo
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    );
                    const conteudoItem = (
                      <>
                        {menuExpandido && <GripVertical className="size-3 shrink-0 opacity-40" />}
                        <Icone className="size-4 shrink-0" />
                        {menuExpandido && <span className="truncate">{item.rotulo}</span>}
                      </>
                    );
                    const rotuloRecolhido = menuExpandido
                      ? undefined
                      : `${grupo.grupo}: ${item.rotulo}`;
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
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setAtalhoContextual({
                            item,
                            x: Math.max(8, Math.min(event.clientX, window.innerWidth - 272)),
                            y: Math.max(8, Math.min(event.clientY, window.innerHeight - 92)),
                          });
                        }}
                        title={
                          menuExpandido ? "Arraste para reordenar dentro deste grupo" : undefined
                        }
                        className="cursor-grab active:cursor-grabbing"
                      >
                        {/^https?:\/\//i.test(item.destino) ? (
                          <a
                            href={item.destino}
                            className={classe}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={rotuloRecolhido}
                            title={rotuloRecolhido}
                          >
                            {conteudoItem}
                          </a>
                        ) : (
                          <a
                            href={item.destino}
                            className={classe}
                            aria-label={rotuloRecolhido}
                            title={rotuloRecolhido}
                          >
                            {conteudoItem}
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => {
              if (!aplicativoInstalado) openEscalaCeuInstallPrompt();
            }}
            disabled={aplicativoInstalado}
            aria-label={aplicativoInstalado ? "Aplicativo já instalado" : "Instalar aplicativo"}
            title={aplicativoInstalado ? "Aplicativo já instalado" : "Instalar aplicativo"}
            className={cn(
              "mt-3 flex min-h-10 w-full items-center rounded-md border border-sidebar-primary/50 py-2 text-sm font-medium text-sidebar-primary transition-colors hover:bg-sidebar-accent disabled:cursor-default disabled:opacity-70",
              menuExpandido ? "gap-2 px-2.5 text-left" : "justify-center px-2",
            )}
          >
            <Download className="size-4 shrink-0" />
            {menuExpandido &&
              (aplicativoInstalado ? "Aplicativo já instalado" : "Instalar aplicativo")}
          </button>
        </nav>
        {atalhoContextual && (
          <div
            role="menu"
            className="fixed z-50 w-64 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
            style={{ left: atalhoContextual.x, top: atalhoContextual.y }}
            onContextMenu={(event) => event.preventDefault()}
          >
            <p className="px-2.5 py-1.5 text-xs text-muted-foreground">
              {atalhoContextual.item.rotulo}
            </p>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sm"
              disabled={
                criarAtalho.isPending ||
                Boolean(
                  atalhos.data?.some((atalho) => atalho.chave === atalhoContextual.item.chave),
                )
              }
              onClick={() => criarAtalho.mutate(atalhoContextual.item)}
            >
              <Plus className="size-4" />
              {atalhos.data?.some((atalho) => atalho.chave === atalhoContextual.item.chave)
                ? "Atalho já criado"
                : "Criar atalho no dashboard"}
            </Button>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {alertasLembretes.length > 0 && (
          <button
            className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-5 py-2 text-left text-sm font-semibold text-amber-900"
            onClick={() => setLembreteAberto(alertasLembretes[0]?.id ?? null)}
          >
            <BellRing className="size-4 shrink-0 animate-pulse" /> Você possui{" "}
            {alertasLembretes.length} lembrete(s) vencido(s) ou vencendo agora.
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
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (!aplicativoInstalado) openEscalaCeuInstallPrompt();
              }}
              disabled={aplicativoInstalado}
              aria-label={aplicativoInstalado ? "Aplicativo já instalado" : "Instalar aplicativo"}
              title={aplicativoInstalado ? "Aplicativo já instalado" : "Instalar aplicativo"}
              className="sm:hidden"
            >
              <Download className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!aplicativoInstalado) openEscalaCeuInstallPrompt();
              }}
              disabled={aplicativoInstalado}
              className="hidden gap-1.5 border-primary/40 text-primary sm:inline-flex disabled:cursor-default disabled:opacity-70"
            >
              <Download className="size-4" />
              {aplicativoInstalado ? "Aplicativo já instalado" : "Instalar aplicativo"}
            </Button>
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
                        key={pendencia.chave}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-white px-3 py-2 text-xs"
                      >
                        <span>
                          <strong>{pendencia.item_nome}</strong>
                          {pendencia.origem === "estoque"
                            ? ` · lote ${pendencia.lote || "—"} · vencido em ${pendencia.validade}`
                            : ` · validade ${pendencia.validade}`}
                        </span>
                        {pendencia.origem === "estoque" ? (
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
                        ) : (
                          <a
                            href="/fornecedores"
                            className="rounded-md border border-primary px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                          >
                            Abrir fornecedores
                          </a>
                        )}
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
        <footer className="border-t border-border/60 px-5 py-3 text-center">
          <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground/60">
            <span>Tiago Cardoso</span>
            <span aria-hidden="true" className="mx-2 opacity-50">
              ·
            </span>
            <span>Graziele Silva</span>
          </p>
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
