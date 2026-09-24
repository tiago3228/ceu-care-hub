import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Users,
  Stethoscope,
  DoorOpen,
  CalendarOff,
  Package,
  AlertTriangle,
  ClipboardList,
  KeyRound,
  Network,
  MonitorCog,
  Waves,
  CalendarHeart,
  BellRing,
  FileText,
  ShieldCheck,
  BarChart3,
  Phone,
  HeartPulse,
  ArrowDown,
  ArrowUp,
  Pencil,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { RamaisConsulta } from "@/components/RamaisConsulta";

import { useSessao } from "@/hooks/use-sessao";
import { isoParaBr, hojeIso } from "@/lib/datas";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizarIconeMenu, MENU_ICONS } from "@/lib/menu";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel | Gestão de Sistemas - Clínica CEU" },
      {
        name: "description",
        content:
          "Painel com escalas da semana, equipe ativa, ausências e alertas de estoque da Clínica CEU.",
      },
      { property: "og:title", content: "Painel | Gestão de Sistemas - Clínica CEU" },
      {
        property: "og:description",
        content: "Indicadores de escala, equipe, ausências e estoque da Clínica CEU.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Painel,
});

function inicioFimSemana() {
  const hoje = new Date(hojeIso());
  const dia = hoje.getUTCDay(); // 0 dom
  const inicio = new Date(hoje);
  inicio.setUTCDate(hoje.getUTCDate() - ((dia + 6) % 7)); // segunda
  const fim = new Date(inicio);
  fim.setUTCDate(inicio.getUTCDate() + 6);
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

async function carregarIndicadores() {
  const { inicio, fim } = inicioFimSemana();
  const hoje = hojeIso();
  const c = { count: "exact" as const, head: true };

  const [
    colaboradoras,
    medicos,
    salas,
    escalasSemana,
    escalasHoje,
    alertas,
    ausencias,
    itens,
    solicitacoes,
  ] = await Promise.all([
    supabase.from("colaboradoras").select("id", c).eq("desativada", false),
    supabase.from("medicos").select("id", c),
    supabase.from("salas").select("id", c).eq("ativa", true),
    supabase.from("escalas").select("id", c).gte("data", inicio).lte("data", fim),
    supabase
      .from("escalas")
      .select(
        "id, data, horario_inicio, horario_fim, status_compatibilidade, motivo_alerta, salas(nome), medicos(nome, apelido)",
      )
      .eq("data", hoje)
      .order("horario_inicio", { ascending: true }),
    supabase
      .from("escalas")
      .select("id", c)
      .gte("data", inicio)
      .lte("data", fim)
      .neq("status_compatibilidade", "verde"),
    supabase
      .from("ausencias")
      .select("id, tipo, data_inicio, data_fim, colaboradoras(nome), medicos(nome)")
      .lte("data_inicio", fim)
      .gte("data_fim", inicio),
    supabase.from("itens").select("id", c).eq("ativo", true),
    supabase.from("solicitacoes").select("id", c).eq("status", "pendente"),
  ]);

  return {
    inicio,
    fim,
    colaboradoras: colaboradoras.count ?? 0,
    medicos: medicos.count ?? 0,
    salas: salas.count ?? 0,
    escalasSemana: escalasSemana.count ?? 0,
    alertas: alertas.count ?? 0,
    itens: itens.count ?? 0,
    solicitacoes: solicitacoes.count ?? 0,
    escalasHoje: escalasHoje.data ?? [],
    ausencias: ausencias.data ?? [],
  };
}

function Cartao({
  rotulo,
  valor,
  icone: Icone,
  tom = "primary",
  detalhe,
}: {
  rotulo: string;
  valor: number | string;
  icone: typeof Users;
  tom?: "primary" | "verde" | "amarelo" | "vermelho";
  detalhe?: string;
}) {
  const tons = {
    primary: "bg-info-suave text-info",
    verde: "bg-verde-suave text-verde",
    amarelo: "bg-amarelo-suave text-amarelo-foreground",
    vermelho: "bg-vermelho-suave text-vermelho",
  } as const;
  return (
    <div className="card-superficie flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        <p className="mt-1.5 font-display text-2xl font-semibold text-foreground">{valor}</p>
        {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
      </div>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", tons[tom])}>
        <Icone className="size-4.5" />
      </span>
    </div>
  );
}

const DESTAQUES = [
  { label: "Gestão de usuários e permissões", icon: Users, to: "/usuarios" },
  { label: "Ramais corporativos", icon: Phone, to: "/ramais" },
  { label: "Cofre de senhas seguro", icon: KeyRound, to: "/senhas" },
  { label: "Controle de IP e rede", icon: Network, to: "/controle-ip" },
  { label: "Inventário de equipamentos", icon: MonitorCog, to: "/equipamentos-us" },
  { label: "Equipamentos de ultrassom", icon: Waves, to: "/equipamentos-us" },
  { label: "Controle de sondas", icon: Waves, to: "/sondas" },
  { label: "Agenda pessoal", icon: CalendarHeart, to: "/agenda-marcacao" },
  { label: "Escalas", icon: CalendarDays, to: "/escala" },
  { label: "Lembretes inteligentes", icon: BellRing, to: "/lembretes" },
  { label: "Gestão operacional", icon: HeartPulse, to: "/enfermagem" },
  { label: "Relatórios gerenciais", icon: BarChart3, to: "/relatorios" },
  { label: "Documentos e arquivos", icon: FileText, to: "/notas" },
  { label: "Auditoria completa", icon: ClipboardList, to: "/relatorios" },
  { label: "Controle de acesso por perfil", icon: ShieldCheck, to: "/usuarios" },
] as const;

interface AtalhoDashboard {
  id: number;
  chave: string;
  rotulo: string;
  destino: string;
  icone: string;
  ordem: number;
}

interface FormAtalho {
  id: number;
  rotulo: string;
  destino: string;
}

// A tabela é criada pela migration e ainda não aparece nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function AtalhosDashboard({ usuarioId }: { usuarioId: string | undefined }) {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<FormAtalho | null>(null);
  const [contexto, setContexto] = useState<{
    atalho: AtalhoDashboard;
    x: number;
    y: number;
  } | null>(null);
  const atalhos = useQuery({
    queryKey: ["atalhos-dashboard", usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      const { data, error } = await db
        .from("atalhos_dashboard_usuario")
        .select("id,chave,rotulo,destino,icone,ordem")
        .eq("usuario_id", usuarioId)
        .order("ordem")
        .order("rotulo");
      if (error) throw error;
      return (data ?? []) as AtalhoDashboard[];
    },
  });
  const salvar = useMutation({
    mutationFn: async (form: FormAtalho) => {
      const rotulo = form.rotulo.trim();
      const destino = form.destino.trim();
      if (!rotulo) throw new Error("Informe o nome do atalho.");
      if (!destino || (!destino.startsWith("/") && !/^https?:\/\//i.test(destino))) {
        throw new Error("O destino deve começar com / ou ser uma URL http(s).");
      }
      const { error } = await db
        .from("atalhos_dashboard_usuario")
        .update({ rotulo, destino })
        .eq("id", form.id)
        .eq("usuario_id", usuarioId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setEditando(null);
      toast.success("Atalho atualizado.");
      await queryClient.invalidateQueries({ queryKey: ["atalhos-dashboard", usuarioId] });
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const remover = useMutation({
    mutationFn: async (atalho: AtalhoDashboard) => {
      const { error } = await db
        .from("atalhos_dashboard_usuario")
        .delete()
        .eq("id", atalho.id)
        .eq("usuario_id", usuarioId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Atalho removido do dashboard.");
      await queryClient.invalidateQueries({ queryKey: ["atalhos-dashboard", usuarioId] });
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const mover = useMutation({
    mutationFn: async ({ atalho, direcao }: { atalho: AtalhoDashboard; direcao: -1 | 1 }) => {
      const lista = [...(atalhos.data ?? [])];
      const indice = lista.findIndex((item) => item.id === atalho.id);
      const novoIndice = indice + direcao;
      if (indice < 0 || novoIndice < 0 || novoIndice >= lista.length) return;
      [lista[indice], lista[novoIndice]] = [lista[novoIndice], lista[indice]];
      const atualizacoes = lista.map((item, ordem) =>
        db
          .from("atalhos_dashboard_usuario")
          .update({ ordem })
          .eq("id", item.id)
          .eq("usuario_id", usuarioId),
      );
      const resultados = await Promise.all(atualizacoes);
      const erro = resultados.find((resultado) => resultado.error)?.error;
      if (erro) throw erro;
    },
    onSuccess: async () => {
      setContexto(null);
      await queryClient.invalidateQueries({ queryKey: ["atalhos-dashboard", usuarioId] });
    },
    onError: (error) => toast.error(`Não foi possível mover o atalho: ${(error as Error).message}`),
  });
  useEffect(() => {
    const fechar = () => setContexto(null);
    const tecla = (event: KeyboardEvent) => {
      if (event.key === "Escape") fechar();
    };
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("keydown", tecla);
    };
  }, []);

  if (!atalhos.data?.length) return null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Meus atalhos
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Clique em um atalho para abrir o módulo correspondente.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {atalhos.data.map((atalho) => {
          const Icone = MENU_ICONS[normalizarIconeMenu(atalho.icone)];
          const conteudo = (
            <>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icone className="size-4" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-foreground">
                  {atalho.rotulo}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {atalho.destino}
                </span>
              </span>
            </>
          );
          return (
            <div
              key={atalho.id}
              className="card-superficie group relative flex items-center gap-3 p-3"
              onContextMenu={(event) => {
                event.preventDefault();
                setContexto({
                  atalho,
                  x: Math.max(8, Math.min(event.clientX, window.innerWidth - 272)),
                  y: Math.max(8, Math.min(event.clientY, window.innerHeight - 210)),
                });
              }}
            >
              {editando?.id === atalho.id ? (
                <div className="w-full space-y-2">
                  <Input
                    value={editando.rotulo}
                    onChange={(event) =>
                      setEditando((atual) =>
                        atual ? { ...atual, rotulo: event.target.value } : atual,
                      )
                    }
                    aria-label="Nome do atalho"
                  />
                  <Input
                    value={editando.destino}
                    onChange={(event) =>
                      setEditando((atual) =>
                        atual ? { ...atual, destino: event.target.value } : atual,
                      )
                    }
                    aria-label="Destino do atalho"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditando(null)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={() => salvar.mutate(editando)}>
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/^https?:\/\//i.test(atalho.destino) ? (
                    <a
                      href={atalho.destino}
                      target="_blank"
                      rel="noreferrer"
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setContexto({
                          atalho,
                          x: Math.max(8, Math.min(event.clientX, window.innerWidth - 272)),
                          y: Math.max(8, Math.min(event.clientY, window.innerHeight - 210)),
                        });
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {conteudo}
                    </a>
                  ) : (
                    <Link
                      to={atalho.destino as never}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setContexto({
                          atalho,
                          x: Math.max(8, Math.min(event.clientX, window.innerWidth - 272)),
                          y: Math.max(8, Math.min(event.clientY, window.innerHeight - 210)),
                        });
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {conteudo}
                    </Link>
                  )}
                  <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Editar atalho"
                      onClick={() =>
                        setEditando({
                          id: atalho.id,
                          rotulo: atalho.rotulo,
                          destino: atalho.destino,
                        })
                      }
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Excluir atalho"
                      onClick={() => {
                        if (window.confirm(`Excluir o atalho “${atalho.rotulo}”?`)) {
                          remover.mutate(atalho);
                        }
                      }}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {contexto && (
        <div
          role="menu"
          className="fixed z-50 w-64 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
          style={{ left: contexto.x, top: contexto.y }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <p className="truncate px-2.5 py-1.5 text-xs text-muted-foreground">
            Editar “{contexto.atalho.rotulo}”
          </p>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm"
            disabled={
              mover.isPending ||
              atalhos.data.findIndex((item) => item.id === contexto.atalho.id) <= 0
            }
            onClick={() => mover.mutate({ atalho: contexto.atalho, direcao: -1 })}
          >
            <ArrowUp className="size-4" /> Mover para cima
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm"
            disabled={
              mover.isPending ||
              atalhos.data.findIndex((item) => item.id === contexto.atalho.id) >=
                atalhos.data.length - 1
            }
            onClick={() => mover.mutate({ atalho: contexto.atalho, direcao: 1 })}
          >
            <ArrowDown className="size-4" /> Mover para baixo
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm"
            onClick={() => {
              setEditando({
                id: contexto.atalho.id,
                rotulo: contexto.atalho.rotulo,
                destino: contexto.atalho.destino,
              });
              setContexto(null);
            }}
          >
            <Pencil className="size-4" /> Editar / renomear
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm text-destructive hover:text-destructive"
            onClick={() => {
              if (window.confirm(`Excluir o atalho “${contexto.atalho.rotulo}”?`)) {
                remover.mutate(contexto.atalho);
                setContexto(null);
              }
            }}
          >
            <Trash2 className="size-4" /> Remover
          </Button>
        </div>
      )}
    </section>
  );
}

function Painel() {
  const { sessao, isAdmin } = useSessao();
  const { data, isLoading } = useQuery({
    queryKey: ["indicadores-painel"],
    queryFn: carregarIndicadores,
  });

  const versiculo = useQuery({
    queryKey: ["versiculo-dia"],
    queryFn: async () => {
      const { count } = await supabase
        .from("versiculos")
        .select("id", { count: "exact", head: true });
      if (!count) return null;
      const dia = Math.floor(Date.parse(hojeIso()) / 86400000) % count;
      const { data } = await supabase
        .from("versiculos")
        .select("texto, referencia")
        .range(dia, dia)
        .limit(1);
      return data?.[0] ?? null;
    },
  });

  return (
    <AppShell
      titulo={`Olá, ${sessao?.nome?.split(" ")[0] ?? ""}`}
      descricao={
        data ? `Semana de ${isoParaBr(data.inicio)} a ${isoParaBr(data.fim)}` : "Carregando semana"
      }
    >
      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <AtalhosDashboard usuarioId={sessao?.userId} />
          <section className="mb-6 overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-secondary/40 p-6 shadow-sm sm:p-8">
            <div className="max-w-3xl">
              <img
                src="/logo-ceu.png"
                alt="CEU Diagnósticos"
                className="mb-4 h-auto w-36 object-contain"
              />
              <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
                Plataforma Integrada de Gestão Clínica e Operacional
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Centralize em um único sistema as rotinas administrativas, assistenciais,
                tecnológicas e operacionais da Clínica CEU, com segurança, organização e
                rastreabilidade completa.
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {DESTAQUES.map(({ label, icon: Icon, to }) => (
                <Link
                  key={label}
                  to={to}
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/70 p-2.5 text-xs text-foreground transition-shadow hover:shadow-sm"
                >
                  <Icon className="size-4 shrink-0 text-primary" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              Desenvolvido para centralizar informações críticas da operação da Clínica CEU,
              proporcionando mais produtividade, segurança, controle e padronização dos processos
              internos.
            </p>
          </section>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Cartao
              rotulo="Escalas na semana"
              valor={data.escalasSemana}
              icone={CalendarDays}
              detalhe={`${data.escalasHoje.length} hoje`}
            />
            <Cartao
              rotulo="Alertas de compatibilidade"
              valor={data.alertas}
              icone={AlertTriangle}
              tom={data.alertas ? "amarelo" : "verde"}
              detalhe="Sugestões podem ser ignoradas com justificativa"
            />
            <Cartao
              rotulo="Colaboradoras ativas"
              valor={data.colaboradoras}
              icone={Users}
              tom="verde"
            />
            <Cartao rotulo="Médicos cadastrados" valor={data.medicos} icone={Stethoscope} />
            <Cartao rotulo="Salas ativas" valor={data.salas} icone={DoorOpen} />
            <Cartao
              rotulo="Ausências no período"
              valor={data.ausencias.length}
              icone={CalendarOff}
              tom={data.ausencias.length ? "amarelo" : "verde"}
            />
            <Cartao rotulo="Itens ativos" valor={data.itens} icone={Package} />
            <Cartao
              rotulo="Solicitações pendentes"
              valor={data.solicitacoes}
              icone={ClipboardList}
              tom={data.solicitacoes ? "amarelo" : "verde"}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <section className="card-superficie p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Escala de hoje
              </h2>
              {data.escalasHoje.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nenhuma escala registrada para hoje.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-border">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {data.escalasHoje.map((e: any) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {e.medicos?.apelido || e.medicos?.nome || "Médico não definido"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {e.salas?.nome ?? "Sala não definida"} · {e.horario_inicio ?? "--"} às{" "}
                          {e.horario_fim ?? "--"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 border-transparent",
                          e.status_compatibilidade === "verde" && "bg-verde-suave text-verde",
                          e.status_compatibilidade === "amarelo" &&
                            "bg-amarelo-suave text-amarelo-foreground",
                          e.status_compatibilidade === "vermelho" &&
                            "bg-vermelho-suave text-vermelho",
                        )}
                      >
                        {e.status_compatibilidade ?? "verde"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="space-y-4">
              <section className="card-superficie p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Ausências do período
                </h2>
                {data.ausencias.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Ninguém ausente nesta semana.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2.5">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {data.ausencias.slice(0, 6).map((a: any) => (
                      <li key={a.id} className="text-sm">
                        <span className="font-medium text-foreground">
                          {a.colaboradoras?.nome ?? a.medicos?.nome ?? "—"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {a.tipo} · {isoParaBr(a.data_inicio)} a {isoParaBr(a.data_fim)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <RamaisConsulta />

              {versiculo.data && (
                <section className="card-superficie bg-secondary/50 p-5">
                  <p className="text-sm leading-relaxed text-foreground">
                    “{versiculo.data.texto}”
                  </p>
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    {versiculo.data.referencia}
                  </p>
                </section>
              )}

              {isAdmin && (
                <Link
                  to="/usuarios"
                  className="card-superficie block p-5 transition-colors hover:bg-secondary/40"
                >
                  <p className="text-sm font-medium text-foreground">Usuários e permissões</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cadastre a equipe e libere módulos por perfil.
                  </p>
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
