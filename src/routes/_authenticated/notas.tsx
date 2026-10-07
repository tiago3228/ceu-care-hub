import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Pin, Search, Trash2, BellRing, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { brParaIso, hojeIso, isoParaBr, mascaraDataBr } from "@/lib/datas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/notas")({
  head: () => ({
    meta: [
      { title: "Bloco de Notas | Clínica CEU" },
      {
        name: "description",
        content:
          "Bloco de notas e lembretes da Clínica CEU com data e hora de alerta, marcação de leitura e histórico de anotações da equipe.",
      },
      { property: "og:title", content: "Bloco de Notas | Clínica CEU" },
      { property: "og:description", content: "Anotações e lembretes com alerta por data e hora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaNotas,
});

interface Nota {
  id: number;
  created_by: string;
  titulo: string | null;
  conteudo: string | null;
  data_criacao: string;
  hora_criacao: string | null;
  data_alerta: string | null;
  hora_alerta: string | null;
  status: string;
  lido: boolean;
  cor: CorNota;
  fonte: FonteNota;
  urgente: boolean;
  tamanho_fonte: TamanhoFonteNota;
  negrito: boolean;
  italico: boolean;
  sublinhado: boolean;
  fixada: boolean;
}

type CorNota = "padrao" | "azul" | "verde" | "amarela" | "vermelha" | "roxa";
type FonteNota = "padrao" | "serifada" | "monoespaco" | "manuscrita";
type TamanhoFonteNota = "pequeno" | "medio" | "grande" | "muito_grande";

interface FormNota {
  id: number | null;
  titulo: string;
  conteudo: string;
  dataAlerta: string;
  horaAlerta: string;
  concluida: boolean;
  cor: CorNota;
  fonte: FonteNota;
  urgente: boolean;
  tamanhoFonte: TamanhoFonteNota;
  negrito: boolean;
  italico: boolean;
  sublinhado: boolean;
  fixada: boolean;
}

const VAZIO: FormNota = {
  id: null,
  titulo: "",
  conteudo: "",
  dataAlerta: "",
  horaAlerta: "",
  concluida: false,
  cor: "padrao",
  fonte: "padrao",
  urgente: false,
  tamanhoFonte: "medio",
  negrito: false,
  italico: false,
  sublinhado: false,
  fixada: false,
};

const ESTILOS_COR: Record<CorNota, string> = {
  padrao: "border-border bg-card",
  azul: "border-blue-300/70 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-950/30",
  verde: "border-emerald-300/70 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30",
  amarela: "border-amber-300/70 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30",
  vermelha: "border-red-300/70 bg-red-50/80 dark:border-red-800 dark:bg-red-950/30",
  roxa: "border-violet-300/70 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/30",
};

const ESTILOS_FONTE: Record<FonteNota, string> = {
  padrao: "font-sans",
  serifada: "font-serif",
  monoespaco: "font-mono",
  manuscrita: "font-cursive",
};

const ESTILOS_TAMANHO: Record<TamanhoFonteNota, string> = {
  pequeno: "text-[11px]",
  medio: "text-sm",
  grande: "text-base",
  muito_grande: "text-lg",
};

function horaAgora() {
  return new Date().toTimeString().slice(0, 5);
}

function PaginaNotas() {
  const { temModulo, somenteLeitura, sessao, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);
  const [form, setForm] = useState<FormNota | null>(null);

  const notas = useQuery({
    queryKey: ["notas", sessao?.userId],
    enabled: !!sessao?.userId && temModulo("notas"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas")
        .select("*")
        .eq("created_by", sessao?.userId ?? "")
        .order("data_criacao", { ascending: false })
        .order("id", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Nota[];
    },
  });

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (notas.data ?? [])
      .filter((n) => (mostrarConcluidas ? true : n.status !== "concluida"))
      .filter(
        (n) =>
          !termo ||
          (n.titulo ?? "").toLowerCase().includes(termo) ||
          (n.conteudo ?? "").toLowerCase().includes(termo),
      )
      .sort((a, b) => Number(b.fixada) - Number(a.fixada));
  }, [notas.data, busca, mostrarConcluidas]);

  const pendentesHoje = useMemo(
    () =>
      (notas.data ?? []).filter(
        (n) => n.status !== "concluida" && n.data_alerta && n.data_alerta <= hojeIso(),
      ).length,
    [notas.data],
  );

  const salvar = useMutation({
    mutationFn: async (f: FormNota) => {
      if (!f.titulo.trim() && !f.conteudo.trim()) throw new Error("Informe um título ou conteúdo.");
      const dataAlerta = f.dataAlerta ? brParaIso(f.dataAlerta) : null;
      if (f.dataAlerta && !dataAlerta) throw new Error("Data de alerta inválida (DD-MM-AAAA).");
      const payload = {
        titulo: f.titulo.trim() || null,
        conteudo: f.conteudo.trim() || null,
        data_alerta: dataAlerta,
        hora_alerta: f.horaAlerta.trim() || null,
        status: f.concluida ? "concluida" : "ativa",
        cor: f.cor,
        fonte: f.fonte,
        urgente: f.urgente,
        tamanho_fonte: f.tamanhoFonte,
        negrito: f.negrito,
        italico: f.italico,
        sublinhado: f.sublinhado,
        fixada: f.fixada,
      };
      if (f.id) {
        const { error } = await supabase
          .from("notas")
          .update(payload as never)
          .eq("id", f.id)
          .eq("created_by", sessao?.userId ?? "");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notas").insert({
          ...payload,
          data_criacao: hojeIso(),
          hora_criacao: horaAgora(),
          created_by: sessao?.userId ?? null,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Nota salva.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["notas"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const alternarStatus = useMutation({
    mutationFn: async (n: Nota) => {
      const { error } = await supabase
        .from("notas")
        .update({ status: n.status === "concluida" ? "ativa" : "concluida", lido: true })
        .eq("id", n.id)
        .eq("created_by", sessao?.userId ?? "");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notas"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const alternarFixada = useMutation({
    mutationFn: async (n: Nota) => {
      const { error } = await supabase
        .from("notas")
        .update({ fixada: !n.fixada })
        .eq("id", n.id)
        .eq("created_by", sessao?.userId ?? "");
      if (error) throw error;
    },
    onSuccess: (_, n) => {
      toast.success(n.fixada ? "Nota desafixada." : "Nota fixada no topo.");
      queryClient.invalidateQueries({ queryKey: ["notas"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const excluir = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("notas")
        .delete()
        .eq("id", id)
        .eq("created_by", sessao?.userId ?? "");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota excluída.");
      queryClient.invalidateQueries({ queryKey: ["notas"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!carregandoSessao && !temModulo("notas")) {
    return (
      <AppShell titulo="Bloco de Notas">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso ao bloco de notas.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Bloco de Notas"
      descricao={`${lista.length} nota(s) • ${pendentesHoje} alerta(s) para hoje`}
      acoes={
        !somenteLeitura && (
          <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
            <Plus className="mr-1.5 size-4" /> Nova nota
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por título ou conteúdo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={mostrarConcluidas} onCheckedChange={setMostrarConcluidas} />
          Mostrar concluídas
        </label>
      </div>

      {notas.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {lista.map((n) => {
            const vencida =
              !!n.data_alerta && n.data_alerta <= hojeIso() && n.status !== "concluida";
            return (
              <article
                key={n.id}
                className={`card-superficie flex items-start justify-between gap-3 border p-4 ${ESTILOS_COR[n.cor ?? "padrao"]} ${
                  ESTILOS_FONTE[n.fonte ?? "padrao"]
                } ${ESTILOS_TAMANHO[n.tamanho_fonte ?? "medio"]} ${n.negrito ? "font-bold" : ""} ${
                  n.italico ? "italic" : ""
                } ${n.sublinhado ? "underline decoration-2 underline-offset-2" : ""} ${
                  n.urgente && n.status !== "concluida"
                    ? "animate-pulse ring-2 ring-red-400/60"
                    : ""
                }`}
              >
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-foreground">
                    {n.urgente && n.status !== "concluida" ? "[URGENTE] " : ""}
                    {n.titulo || "Sem título"}
                  </h2>
                  {n.fixada && (
                    <Badge variant="secondary" className="mt-1 gap-1 text-[10px]">
                      <Pin className="size-3 fill-current" /> Fixada no topo
                    </Badge>
                  )}
                  {n.conteudo && (
                    <p className="mt-1 whitespace-pre-wrap text-inherit text-muted-foreground">
                      {n.conteudo}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Criada em {isoParaBr(n.data_criacao)} {n.hora_criacao ?? ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {n.data_alerta && (
                      <Badge
                        variant={vencida ? "destructive" : "secondary"}
                        className="gap-1 text-[10px]"
                      >
                        <BellRing className="size-3" /> {isoParaBr(n.data_alerta)}{" "}
                        {n.hora_alerta ?? ""}
                      </Badge>
                    )}
                    {n.status === "concluida" && (
                      <Badge variant="outline" className="text-[10px]">
                        Concluída
                      </Badge>
                    )}
                    {n.urgente && n.status !== "concluida" && (
                      <Badge variant="destructive" className="text-[10px]">
                        Urgente
                      </Badge>
                    )}
                  </div>
                </div>
                {!somenteLeitura && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      variant={n.fixada ? "secondary" : "ghost"}
                      size="icon"
                      aria-label={n.fixada ? "Desafixar nota" : "Fixar nota no topo"}
                      title={n.fixada ? "Desafixar do topo" : "Fixar no topo"}
                      onClick={() => alternarFixada.mutate(n)}
                    >
                      <Pin className={`size-4 ${n.fixada ? "fill-current" : ""}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={n.status === "concluida" ? "Reabrir nota" : "Concluir nota"}
                      onClick={() => alternarStatus.mutate(n)}
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar nota"
                      onClick={() =>
                        setForm({
                          id: n.id,
                          titulo: n.titulo ?? "",
                          conteudo: n.conteudo ?? "",
                          dataAlerta: isoParaBr(n.data_alerta),
                          horaAlerta: n.hora_alerta ?? "",
                          concluida: n.status === "concluida",
                          cor: n.cor ?? "padrao",
                          fonte: n.fonte ?? "padrao",
                          urgente: n.urgente ?? false,
                          tamanhoFonte: n.tamanho_fonte ?? "medio",
                          negrito: n.negrito ?? false,
                          italico: n.italico ?? false,
                          sublinhado: n.sublinhado ?? false,
                          fixada: n.fixada ?? false,
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir nota"
                      onClick={() => {
                        if (confirm("Excluir esta nota?")) excluir.mutate(n.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
          {!lista.length && (
            <p className="text-sm text-muted-foreground">Nenhuma nota encontrada.</p>
          )}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar nota" : "Nova nota"}</DialogTitle>
            <DialogDescription>Defina um alerta opcional para lembrar a equipe.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="n-titulo">Título</Label>
                <Input
                  id="n-titulo"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="n-conteudo">Conteúdo</Label>
                <Textarea
                  id="n-conteudo"
                  rows={5}
                  value={form.conteudo}
                  onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="n-cor">Cor da nota</Label>
                  <select
                    id="n-cor"
                    value={form.cor}
                    onChange={(e) => setForm({ ...form, cor: e.target.value as CorNota })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="padrao">Padrão</option>
                    <option value="azul">Azul — informação</option>
                    <option value="verde">Verde — concluído</option>
                    <option value="amarela">Amarela — atenção</option>
                    <option value="vermelha">Vermelha — prioridade</option>
                    <option value="roxa">Roxa — importante</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="n-fonte">Fonte</Label>
                  <select
                    id="n-fonte"
                    value={form.fonte}
                    onChange={(e) => setForm({ ...form, fonte: e.target.value as FonteNota })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="padrao">Padrão</option>
                    <option value="serifada">Serifada</option>
                    <option value="monoespaco">Monoespaçada</option>
                    <option value="manuscrita">Manuscrita</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="n-tamanho">Tamanho da fonte</Label>
                <select
                  id="n-tamanho"
                  value={form.tamanhoFonte}
                  onChange={(e) =>
                    setForm({ ...form, tamanhoFonte: e.target.value as TamanhoFonteNota })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="pequeno">Pequeno</option>
                  <option value="medio">Médio</option>
                  <option value="grande">Grande</option>
                  <option value="muito_grande">Muito grande</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={form.negrito ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm({ ...form, negrito: !form.negrito })}
                  aria-pressed={form.negrito}
                >
                  <strong>Negrito</strong>
                </Button>
                <Button
                  type="button"
                  variant={form.italico ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm({ ...form, italico: !form.italico })}
                  aria-pressed={form.italico}
                >
                  <em>Itálico</em>
                </Button>
                <Button
                  type="button"
                  variant={form.sublinhado ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm({ ...form, sublinhado: !form.sublinhado })}
                  aria-pressed={form.sublinhado}
                >
                  <span className="underline">Sublinhado</span>
                </Button>
              </div>
              <label className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                <Switch
                  checked={form.urgente}
                  onCheckedChange={(v) => setForm({ ...form, urgente: v })}
                />
                <span>
                  <strong>Alerta urgente</strong>
                  <span className="block text-xs opacity-80">
                    A nota ficará pulsando em vermelho até ser concluída.
                  </span>
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.fixada}
                  onCheckedChange={(v) => setForm({ ...form, fixada: v })}
                />
                <span>Fixar esta nota no topo</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="n-data">Alerta (DD-MM-AAAA)</Label>
                  <Input
                    id="n-data"
                    value={form.dataAlerta}
                    onChange={(e) =>
                      setForm({ ...form, dataAlerta: mascaraDataBr(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="n-hora">Hora</Label>
                  <Input
                    id="n-hora"
                    type="time"
                    value={form.horaAlerta}
                    onChange={(e) => setForm({ ...form, horaAlerta: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.concluida}
                  onCheckedChange={(v) => setForm({ ...form, concluida: v })}
                />
                Marcar como concluída
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button disabled={salvar.isPending} onClick={() => form && salvar.mutate(form)}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
