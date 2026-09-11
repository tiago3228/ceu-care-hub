import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Search, Trash2, BellRing, Check } from "lucide-react";
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
}

interface FormNota {
  id: number | null;
  titulo: string;
  conteudo: string;
  dataAlerta: string;
  horaAlerta: string;
  concluida: boolean;
}

const VAZIO: FormNota = {
  id: null,
  titulo: "",
  conteudo: "",
  dataAlerta: "",
  horaAlerta: "",
  concluida: false,
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
    queryKey: ["notas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas")
        .select("*")
        .eq("created_by", sessao?.userId ?? "")
        .order("data_criacao", { ascending: false })
        .order("id", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Nota[];
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
      );
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
      };
      if (f.id) {
        const { error } = await supabase.from("notas").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notas").insert({
          ...payload,
          data_criacao: hojeIso(),
          hora_criacao: horaAgora(),
          created_by: sessao?.userId ?? null,
        });
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
        .eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notas"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const excluir = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("notas").delete().eq("id", id);
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
                className="card-superficie flex items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-foreground">
                    {n.titulo || "Sem título"}
                  </h2>
                  {n.conteudo && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
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
                  </div>
                </div>
                {!somenteLeitura && (
                  <div className="flex shrink-0 flex-col gap-1">
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
