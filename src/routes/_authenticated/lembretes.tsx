import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Check, ChevronDown, Clock3, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { supabase } from "@/integrations/supabase/client";
import { hojeIso } from "@/lib/datas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/lembretes")({
  head: () => ({
    meta: [{ title: "Lembretes | Clínica CEU" }, { name: "robots", content: "noindex" }],
  }),
  component: PaginaLembretes,
});

type Status = "pendente" | "concluido" | "adiado";
type Prioridade = "alta" | "media" | "baixa";
type Recorrencia = "nenhuma" | "diaria" | "semanal" | "mensal" | "anual" | "personalizada";
type Lembrete = {
  id: number;
  user_id: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  prioridade: Prioridade;
  data_lembrete: string;
  hora_lembrete: string | null;
  recorrencia: Recorrencia;
  recorrencia_dias: number | null;
  status: Status;
  som_ativo: boolean;
  popup_ativo: boolean;
  observacoes: string | null;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
  concluido_em: string | null;
  adiado_ate: string | null;
};
type Formulario = Omit<
  Lembrete,
  "id" | "user_id" | "criado_por" | "criado_em" | "atualizado_em" | "concluido_em"
> & { id: number | null };
const CATEGORIAS = [
  "documentos",
  "pacientes",
  "manutencao",
  "impressoras",
  "computadores",
  "rede",
  "contratos",
  "financeiro",
  "ligacoes",
  "estoque",
  "outros",
];
const CATEGORIA_LABEL: Record<string, string> = {
  documentos: "Documentos",
  pacientes: "Pacientes",
  manutencao: "Manutenção",
  impressoras: "Impressoras",
  computadores: "Computadores",
  rede: "Rede",
  contratos: "Contratos",
  financeiro: "Financeiro",
  ligacoes: "Ligações",
  estoque: "Estoque",
  outros: "Outros",
};
const PRIORIDADES: { id: Prioridade; label: string; cor: string }[] = [
  { id: "alta", label: "Alta", cor: "bg-red-500" },
  { id: "media", label: "Média", cor: "bg-amber-500" },
  { id: "baixa", label: "Baixa", cor: "bg-emerald-500" },
];
const STATUS: { id: Status; label: string }[] = [
  { id: "pendente", label: "Pendentes" },
  { id: "adiado", label: "Adiados" },
  { id: "concluido", label: "Concluídos" },
];
const VAZIO: Formulario = {
  id: null,
  titulo: "",
  descricao: "",
  categoria: "outros",
  prioridade: "media",
  data_lembrete: hojeIso(),
  hora_lembrete: "",
  recorrencia: "nenhuma",
  recorrencia_dias: null,
  status: "pendente",
  som_ativo: false,
  popup_ativo: true,
  observacoes: "",
  adiado_ate: null,
};
const SEM_VALOR = "__nenhum__";
function formatar(iso: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${iso.slice(0, 10)}T12:00:00`));
}
function adicionarRecorrencia(
  data: string,
  recorrencia: Recorrencia,
  diasPersonalizados: number | null,
) {
  const d = new Date(`${data}T12:00:00`);
  if (recorrencia === "diaria") d.setDate(d.getDate() + 1);
  if (recorrencia === "semanal") d.setDate(d.getDate() + 7);
  if (recorrencia === "mensal") d.setMonth(d.getMonth() + 1);
  if (recorrencia === "anual") d.setFullYear(d.getFullYear() + 1);
  if (recorrencia === "personalizada") d.setDate(d.getDate() + (diasPersonalizados ?? 1));
  return d.toISOString().slice(0, 10);
}
function inicioHoje() {
  return new Date(`${hojeIso()}T00:00:00`);
}

function PaginaLembretes() {
  const { temModulo, isAdmin, sessao, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [categoria, setCategoria] = useState("todos");
  const [prioridade, setPrioridade] = useState("todos");
  const [form, setForm] = useState<Formulario | null>(null);
  const [som, setSom] = useState(false);
  const podeVer = isAdmin || temModulo("lembretes");
  const podeAdicionar = isAdmin || temModulo("lembretes_adicionar");
  const podeEditar = isAdmin || temModulo("lembretes_editar");
  const podeExcluir = isAdmin || temModulo("lembretes_excluir");
  const query = useQuery({
    queryKey: ["lembretes", isAdmin],
    enabled: podeVer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lembretes")
        .select("*")
        .order("data_lembrete")
        .order("hora_lembrete");
      if (error) throw error;
      return (data ?? []) as Lembrete[];
    },
  });
  const todos = query.data ?? [];
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return todos.filter(
      (r) =>
        (filtro === "todos" || r.status === filtro) &&
        (categoria === "todos" || r.categoria === categoria) &&
        (prioridade === "todos" || r.prioridade === prioridade) &&
        (!termo ||
          [r.titulo, r.descricao, r.observacoes, r.categoria]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(termo)),
    );
  }, [todos, busca, filtro, categoria, prioridade]);
  const vencidos = todos.filter(
    (r) => r.status !== "concluido" && r.data_lembrete < hojeIso(),
  ).length;
  const hoje = todos.filter(
    (r) => r.status !== "concluido" && r.data_lembrete === hojeIso(),
  ).length;
  const proximos = todos.filter((r) => {
    const d = new Date(`${r.data_lembrete}T00:00:00`);
    const limite = inicioHoje();
    limite.setDate(limite.getDate() + 7);
    return r.status !== "concluido" && d >= inicioHoje() && d <= limite;
  }).length;
  const concluidos = todos.filter((r) => r.status === "concluido").length;
  const registrar = async (operacao: string, id: number, dados: unknown) => {
    await supabase.from("audit_logs").insert({
      user_id: sessao?.userId,
      usuario_nome: sessao?.nome,
      tabela: "lembretes",
      operacao,
      registro_id: String(id),
      dados_novos: dados,
    });
  };
  const salvar = useMutation({
    mutationFn: async (f: Formulario) => {
      if (!f.titulo.trim() || !f.data_lembrete)
        throw new Error("Informe título e data do lembrete.");
      const payload = {
        titulo: f.titulo.trim(),
        descricao: f.descricao?.trim() || null,
        categoria: f.categoria,
        prioridade: f.prioridade,
        data_lembrete: f.data_lembrete,
        hora_lembrete: f.hora_lembrete || null,
        recorrencia: f.recorrencia,
        recorrencia_dias: f.recorrencia === "personalizada" ? f.recorrencia_dias : null,
        status: f.status,
        som_ativo: f.som_ativo,
        popup_ativo: f.popup_ativo,
        observacoes: f.observacoes?.trim() || null,
        adiado_ate: f.adiado_ate || null,
        atualizado_por: sessao?.userId,
      };
      if (f.id) {
        const { error } = await supabase.from("lembretes").update(payload).eq("id", f.id);
        if (error) throw error;
        await registrar("UPDATE", f.id, payload);
      } else {
        const { data, error } = await supabase
          .from("lembretes")
          .insert({ ...payload, user_id: sessao?.userId, criado_por: sessao?.userId })
          .select("id")
          .single();
        if (error) throw error;
        await registrar("INSERT", data.id, payload);
      }
    },
    onSuccess: () => {
      toast.success("Lembrete salvo.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["lembretes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const concluir = useMutation({
    mutationFn: async (r: Lembrete) => {
      if (r.recorrencia !== "nenhuma") {
        const proxima = adicionarRecorrencia(r.data_lembrete, r.recorrencia, r.recorrencia_dias);
        const { error } = await supabase
          .from("lembretes")
          .update({
            data_lembrete: proxima,
            status: "pendente",
            concluido_em: null,
            atualizado_por: sessao?.userId,
          })
          .eq("id", r.id);
        if (error) throw error;
        await registrar("CONCLUIR_RECORRENTE", r.id, { proxima });
      } else {
        const { error } = await supabase
          .from("lembretes")
          .update({
            status: "concluido",
            concluido_em: new Date().toISOString(),
            atualizado_por: sessao?.userId,
          })
          .eq("id", r.id);
        if (error) throw error;
        await registrar("CONCLUIR", r.id, null);
      }
    },
    onSuccess: () => {
      toast.success("Lembrete concluído.");
      queryClient.invalidateQueries({ queryKey: ["lembretes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const adiar = useMutation({
    mutationFn: async ({ r, minutos }: { r: Lembrete; minutos: number }) => {
      const ate = new Date(Date.now() + minutos * 60000).toISOString();
      const { error } = await supabase
        .from("lembretes")
        .update({ status: "adiado", adiado_ate: ate, atualizado_por: sessao?.userId })
        .eq("id", r.id);
      if (error) throw error;
      await registrar("ADIAR", r.id, { adiado_ate: ate });
    },
    onSuccess: () => {
      toast.success("Lembrete adiado.");
      queryClient.invalidateQueries({ queryKey: ["lembretes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const excluir = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("lembretes").delete().eq("id", id);
      if (error) throw error;
      await registrar("DELETE", id, null);
    },
    onSuccess: () => {
      toast.success("Lembrete excluído.");
      queryClient.invalidateQueries({ queryKey: ["lembretes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const atualizarPreferencia = async (valor: boolean) => {
    setSom(valor);
    const { error } = await supabase
      .from("profiles")
      .update({ preferencias_lembretes: { som: valor, popup: true } })
      .eq("id", sessao?.userId);
    if (error) toast.error("Não foi possível salvar a preferência.");
    else toast.success(valor ? "Alerta sonoro ativado." : "Alerta sonoro desativado.");
  };
  if (!carregandoSessao && !podeVer)
    return (
      <AppShell titulo="Lembretes">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso aos lembretes.
        </div>
      </AppShell>
    );
  return (
    <AppShell
      titulo="Lembretes"
      descricao="Avisos e pendências importantes"
      acoes={
        podeAdicionar && (
          <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
            <Plus className="mr-1.5 size-4" /> Novo lembrete
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card-superficie border-red-200 p-4">
            <p className="text-xs text-red-600">Vencidos</p>
            <p className="text-2xl font-semibold">{vencidos}</p>
          </div>
          <div className="card-superficie border-amber-200 p-4">
            <p className="text-xs text-amber-600">Vencem hoje</p>
            <p className="text-2xl font-semibold">{hoje}</p>
          </div>
          <div className="card-superficie border-emerald-200 p-4">
            <p className="text-xs text-emerald-600">Próximos 7 dias</p>
            <p className="text-2xl font-semibold">{proximos}</p>
          </div>
          <div className="card-superficie p-4">
            <p className="text-xs text-muted-foreground">Concluídos</p>
            <p className="text-2xl font-semibold">{concluidos}</p>
          </div>
        </div>
        {(vencidos > 0 || hoje > 0) && (
          <div className="flex items-center gap-3 rounded-md border-2 border-amber-300 bg-amber-50 p-4 text-amber-900">
            <BellRing className="size-5 shrink-0" />
            <strong>
              {vencidos > 0
                ? `Você possui ${vencidos} lembrete(s) vencido(s).`
                : `${hoje} lembrete(s) vencem hoje.`}
            </strong>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar lembrete..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {STATUS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Categorias</SelectItem>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORIA_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={prioridade} onValueChange={setPrioridade}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Prioridades</SelectItem>
              {PRIORIDADES.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={som} onCheckedChange={atualizarPreferencia} /> Som
          </label>
        </div>
        {query.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtrados.map((r) => {
              const vencido = r.status !== "concluido" && r.data_lembrete < hojeIso();
              const p = PRIORIDADES.find((x) => x.id === r.prioridade)!;
              return (
                <article
                  key={r.id}
                  className={`card-superficie border-l-4 ${vencido ? "border-l-red-500" : r.status === "concluido" ? "border-l-slate-300" : `border-l-${p.id === "alta" ? "red" : p.id === "media" ? "amber" : "emerald"}-500`} p-4`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{r.titulo}</h2>
                        <span
                          className={`size-2.5 rounded-full ${p.cor}`}
                          title={`Prioridade ${p.label}`}
                        />
                        <Badge variant="outline">
                          {CATEGORIA_LABEL[r.categoria] ?? r.categoria}
                        </Badge>
                      </div>
                      {r.descricao && (
                        <p className="mt-1 text-sm text-muted-foreground">{r.descricao}</p>
                      )}
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 className="size-3" /> {formatar(r.data_lembrete)}{" "}
                        {r.hora_lembrete ?? ""}{" "}
                        {r.recorrencia !== "nenhuma" && `• ${r.recorrencia}`}
                      </p>
                      {r.observacoes && (
                        <p className="mt-1 text-xs text-muted-foreground">{r.observacoes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Concluir"
                        onClick={() => concluir.mutate(r)}
                      >
                        <Check className="size-4 text-emerald-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Adiar"
                        onClick={() => adiar.mutate({ r, minutos: 60 })}
                      >
                        <ChevronDown className="size-4 text-amber-600" />
                      </Button>
                      {(isAdmin || podeEditar) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar"
                          onClick={() => setForm({ ...r, id: r.id })}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      {(isAdmin || podeExcluir) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Excluir"
                          onClick={() => confirm("Excluir este lembrete?") && excluir.mutate(r.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            {!filtrados.length && (
              <p className="text-sm text-muted-foreground">Nenhum lembrete encontrado.</p>
            )}
          </div>
        )}
        <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{form?.id ? "Editar lembrete" : "Novo lembrete"}</DialogTitle>
              <DialogDescription>
                O lembrete é pessoal e fica visível somente para o proprietário.
              </DialogDescription>
            </DialogHeader>
            {form && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Título *</Label>
                  <Input
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria *</Label>
                  <Select
                    value={form.categoria}
                    onValueChange={(v) => setForm({ ...form, categoria: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORIA_LABEL[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Prioridade *</Label>
                  <Select
                    value={form.prioridade}
                    onValueChange={(v) => setForm({ ...form, prioridade: v as Prioridade })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORIDADES.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={form.data_lembrete}
                    onChange={(e) => setForm({ ...form, data_lembrete: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Hora</Label>
                  <Input
                    type="time"
                    value={form.hora_lembrete ?? ""}
                    onChange={(e) => setForm({ ...form, hora_lembrete: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Recorrência</Label>
                  <Select
                    value={form.recorrencia}
                    onValueChange={(v) => setForm({ ...form, recorrencia: v as Recorrencia })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        ["nenhuma", "Nenhuma"],
                        ["diaria", "Diária"],
                        ["semanal", "Semanal"],
                        ["mensal", "Mensal"],
                        ["anual", "Anual"],
                        ["personalizada", "Personalizada"],
                      ].map(([id, label]) => (
                        <SelectItem key={id} value={id}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                {form.recorrencia === "personalizada" && (
                  <div className="space-y-1.5">
                    <Label>Repetir a cada (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={3650}
                      value={form.recorrencia_dias ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          recorrencia_dias: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                )}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={form.descricao ?? ""}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={form.observacoes ?? ""}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-5 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={form.som_ativo}
                      onCheckedChange={(v) => setForm({ ...form, som_ativo: v })}
                    />{" "}
                    Alerta sonoro
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={form.popup_ativo}
                      onCheckedChange={(v) => setForm({ ...form, popup_ativo: v })}
                    />{" "}
                    Popup
                  </label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button disabled={salvar.isPending} onClick={() => form && salvar.mutate(form)}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
