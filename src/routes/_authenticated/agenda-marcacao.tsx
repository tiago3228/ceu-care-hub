import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
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
import { hojeIso, isoParaBr } from "@/lib/datas";
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
  data_prevista: string;
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

function deslocarMes(iso: string, delta: number) {
  const [ano, mes] = iso.split("-").map(Number);
  return `${ano + Math.floor((mes - 1 + delta) / 12)}-${String(((((mes - 1 + delta) % 12) + 12) % 12) + 1).padStart(2, "0")}-01`;
}
function diasDoMes(mesIso: string) {
  const [ano, mes] = mesIso.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
  const quantidade = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const inicio = (primeiro.getUTCDay() + 6) % 7;
  return [
    ...Array(inicio).fill(null),
    ...Array.from(
      { length: quantidade },
      (_, i) => `${mesIso.slice(0, 8)}${String(i + 1).padStart(2, "0")}`,
    ),
  ];
}
function dataLegivel(mesIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${mesIso}T00:00:00Z`));
}
function limparTelefone(telefone: string) {
  const numeros = telefone.replace(/\D/g, "");
  return numeros.startsWith("55") ? numeros : `55${numeros}`;
}

function PaginaAgenda() {
  const { temModulo, isAdmin, sessao, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(hojeIso().slice(0, 7) + "-01");
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [unidadeFiltro, setUnidadeFiltro] = useState("todos");
  const [colaboradorFiltro, setColaboradorFiltro] = useState("todos");
  const [form, setForm] = useState<Formulario | null>(null);

  const podeVer = isAdmin || temModulo("agenda_marcacao");
  const podeAdicionar = isAdmin || temModulo("agenda_marcacao_adicionar");
  const podeEditar = isAdmin || temModulo("agenda_marcacao_editar");
  const podeExcluir = isAdmin || temModulo("agenda_marcacao_excluir");

  const registros = useQuery({
    queryKey: ["agenda-marcacao", isAdmin, colaboradorFiltro],
    enabled: podeVer,
    queryFn: async () => {
      let query = supabase.from("agenda_marcacao").select("*").order("data_prevista").order("id");
      if (isAdmin && colaboradorFiltro !== "todos") query = query.eq("user_id", colaboradorFiltro);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Registro[];
    },
  });
  const colaboradores = useQuery({
    queryKey: ["agenda-colaboradores"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const todos = registros.data ?? [];
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
    filtrados.forEach((r) => mapa.set(r.data_prevista, [...(mapa.get(r.data_prevista) ?? []), r]));
    return mapa;
  }, [filtrados]);
  const resumo = STATUS.map((s) => ({
    ...s,
    total: filtrados.filter((r) => r.status === s.id).length,
  }));
  const unidades = [...new Set(todos.map((r) => r.unidade).filter(Boolean))] as string[];

  const registrar = async (operacao: string, registroId: number, dadosNovos: unknown) => {
    await supabase.from("audit_logs").insert({
      user_id: sessao?.userId,
      usuario_nome: sessao?.nome,
      tabela: "agenda_marcacao",
      operacao,
      registro_id: String(registroId),
      dados_novos: dadosNovos,
    });
  };
  const salvar = useMutation({
    mutationFn: async (f: Formulario) => {
      if (!f.nome_paciente.trim() || !f.telefone.trim() || !f.exame.trim() || !f.data_prevista)
        throw new Error("Preencha paciente, telefone, exame e data prevista.");
      const payload = {
        ...f,
        id: undefined,
        user_id: undefined,
        created_at: undefined,
        updated_at: undefined,
        nome_paciente: f.nome_paciente.trim(),
        telefone: f.telefone.trim(),
        exame: f.exame.trim(),
        updated_by: sessao?.userId,
      };
      delete (payload as Record<string, unknown>).id;
      delete (payload as Record<string, unknown>).user_id;
      delete (payload as Record<string, unknown>).created_at;
      delete (payload as Record<string, unknown>).updated_at;
      if (f.id) {
        const { error } = await supabase.from("agenda_marcacao").update(payload).eq("id", f.id);
        if (error) throw error;
        await registrar("UPDATE", f.id, payload);
      } else {
        const { data, error } = await supabase
          .from("agenda_marcacao")
          .insert({ ...payload, user_id: sessao?.userId, created_by: sessao?.userId })
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
      const { error } = await supabase.from("agenda_marcacao").delete().eq("id", id);
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
  const dias = diasDoMes(mes);

  return (
    <AppShell
      titulo="Minha Agenda"
      descricao={`Agenda pessoal • ${dataLegivel(mes)}`}
      acoes={
        podeAdicionar && (
          <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
            <Plus className="mr-1.5 size-4" /> Novo registro
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {resumo.map((s) => (
            <div key={s.id} className="card-superficie flex items-center gap-2 p-3">
              <span className={`size-3 rounded-full ${s.bg}`} />
              <div>
                <p className={`text-xs font-medium ${s.cor}`}>{s.label}</p>
                <p className="text-xl font-semibold">{s.total}</p>
              </div>
            </div>
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
          {isAdmin && (
            <Select
              value={colaboradorFiltro}
              onValueChange={(v) => {
                setColaboradorFiltro(v);
                queryClient.invalidateQueries({ queryKey: ["agenda-marcacao"] });
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os colaboradores</SelectItem>
                {(colaboradores.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="card-superficie overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-3">
            <Button variant="outline" size="icon" onClick={() => setMes(deslocarMes(mes, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <h2 className="text-base font-semibold capitalize">{dataLegivel(mes)}</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMes(hojeIso().slice(0, 7) + "-01")}
              >
                Hoje
              </Button>
              <Button variant="outline" size="icon" onClick={() => setMes(deslocarMes(mes, 1))}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-border text-center text-[10px] font-semibold uppercase text-muted-foreground">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
              <div key={d} className="p-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {dias.map((dia, i) => (
              <div
                key={`${dia ?? "vazio"}-${i}`}
                className={`min-h-28 border-b border-r border-border p-1.5 ${dia === hojeIso() ? "bg-primary/5" : ""}`}
              >
                {dia && (
                  <>
                    <button
                      className="mb-1 text-xs font-semibold hover:text-primary"
                      onClick={() => podeAdicionar && setForm({ ...VAZIO, data_prevista: dia })}
                    >
                      {Number(dia.slice(-2))}
                    </button>
                    <div className="space-y-1">
                      {(porDia.get(dia) ?? []).map((r) => (
                        <div
                          key={r.id}
                          className="group rounded border border-border/60 p-1 text-left text-[10px] hover:bg-secondary/60"
                        >
                          <button
                            className="flex w-full items-start gap-1"
                            onClick={() => (podeEditar || isAdmin) && editar(r)}
                          >
                            <span
                              className={`mt-0.5 size-2 shrink-0 rounded-full ${STATUS_MAP[r.status].bg}`}
                            />
                            <span className="min-w-0 truncate font-medium">{r.nome_paciente}</span>
                          </button>
                          <p className="truncate text-muted-foreground">{r.exame}</p>
                          <div className="hidden gap-1 group-hover:flex">
                            <button
                              className="text-emerald-600"
                              title="WhatsApp"
                              onClick={() => abrirWhatsApp(r)}
                            >
                              <MessageCircle className="size-3" />
                            </button>
                            {(podeExcluir || isAdmin) && (
                              <button
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
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        {registros.isLoading && <Skeleton className="h-20 w-full" />}
        {todos.some(
          (r) => r.lembrete && r.lembrete_em && r.lembrete_em <= new Date().toISOString(),
        ) && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            Existem lembretes vencidos na sua agenda.
          </div>
        )}
      </div>
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar registro" : "Novo registro"}</DialogTitle>
            <DialogDescription>
              Os registros são pessoais e ficam visíveis somente para o proprietário.
              Administradores podem consultar todas as agendas.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome do Paciente *</Label>
                <Input
                  value={form.nome_paciente}
                  onChange={(e) => setForm({ ...form, nome_paciente: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone *</Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Exame *</Label>
                <Input
                  value={form.exame}
                  onChange={(e) => setForm({ ...form, exame: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data Prevista *</Label>
                <Input
                  type="date"
                  value={form.data_prevista}
                  onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status *</Label>
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
