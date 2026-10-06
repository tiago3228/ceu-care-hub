import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { brParaIso, isoParaBr, mascaraDataBr } from "@/lib/datas";
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

export const Route = createFileRoute("/_authenticated/pacientes")({
  head: () => ({
    meta: [
      { title: "Pacientes | Clínica CEU" },
      {
        name: "description",
        content:
          "Cadastro de pacientes da Clínica CEU com prontuário sequencial automático, data de nascimento e histórico de atendimentos de enfermagem.",
      },
      { property: "og:title", content: "Pacientes | Clínica CEU" },
      {
        property: "og:description",
        content: "Prontuários e dados básicos dos pacientes atendidos pela enfermagem.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaPacientes,
});

interface Paciente {
  id: number;
  prontuario: string | null;
  nome: string;
  data_nascimento: string | null;
  observacoes: string | null;
  arquivado: boolean;
}

interface FormPaciente {
  id: number | null;
  nome: string;
  nascimento: string;
  observacoes: string;
  arquivado: boolean;
}

const VAZIO: FormPaciente = {
  id: null,
  nome: "",
  nascimento: "",
  observacoes: "",
  arquivado: false,
};

function PaginaPacientes() {
  const { temModulo, somenteLeitura, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [form, setForm] = useState<FormPaciente | null>(null);

  const pacientes = useQuery({
    queryKey: ["pacientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select("*")
        .order("nome")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Paciente[];
    },
  });

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (pacientes.data ?? [])
      .filter((p) => (mostrarArquivados ? true : !p.arquivado))
      .filter(
        (p) =>
          !termo || p.nome.toLowerCase().includes(termo) || (p.prontuario ?? "").includes(termo),
      )
      .slice(0, 400);
  }, [pacientes.data, busca, mostrarArquivados]);

  const salvar = useMutation({
    mutationFn: async (f: FormPaciente) => {
      if (!f.nome.trim()) throw new Error("Informe o nome do Paciente.");
      const nascimento = f.nascimento ? brParaIso(f.nascimento) : null;
      if (f.nascimento && !nascimento) throw new Error("Data de nascimento inválida (DD-MM-AAAA).");
      const payload = {
        nome: f.nome.trim().toUpperCase(),
        data_nascimento: nascimento,
        observacoes: f.observacoes.trim() || null,
        arquivado: f.arquivado,
      };
      if (f.id) {
        const { error } = await supabase.from("pacientes").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pacientes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Paciente salvo.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      queryClient.invalidateQueries({ queryKey: ["enfermagem-apoio"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!carregandoSessao && !temModulo("enfermagem")) {
    return (
      <AppShell titulo="Pacientes">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso ao cadastro de Pacientes.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Pacientes"
      descricao={`${lista.length} Pacientes exibidos`}
      acoes={
        !somenteLeitura && (
          <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
            <Plus className="mr-1.5 size-4" /> Novo Paciente
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou prontuário"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={mostrarArquivados} onCheckedChange={setMostrarArquivados} />
          Mostrar arquivados
        </label>
      </div>

      {pacientes.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {lista.map((p) => (
            <article
              key={p.id}
              className="card-superficie flex items-start justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-foreground">{p.nome}</h2>
                <p className="text-xs text-muted-foreground">
                  {[
                    p.prontuario ? `Prontuário ${p.prontuario}` : null,
                    isoParaBr(p.data_nascimento),
                  ]
                    .filter(Boolean)
                    .join(" • ") || "Sem dados complementares"}
                </p>
                {p.arquivado && (
                  <Badge variant="destructive" className="mt-2 text-[10px]">
                    Arquivado
                  </Badge>
                )}
              </div>
              {!somenteLeitura && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${p.nome}`}
                  onClick={() =>
                    setForm({
                      id: p.id,
                      nome: p.nome,
                      nascimento: isoParaBr(p.data_nascimento),
                      observacoes: p.observacoes ?? "",
                      arquivado: p.arquivado,
                    })
                  }
                >
                  <Pencil className="size-4" />
                </Button>
              )}
            </article>
          ))}
          {!lista.length && (
            <p className="text-sm text-muted-foreground">Nenhum Paciente encontrado.</p>
          )}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar Paciente" : "Novo Paciente"}</DialogTitle>
            <DialogDescription>
              O número de prontuário é gerado automaticamente pelo sistema.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-nome">Nome</Label>
                <Input
                  id="p-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-nasc">Nascimento (DD-MM-AAAA)</Label>
                <Input
                  id="p-nasc"
                  value={form.nascimento}
                  onChange={(e) => setForm({ ...form, nascimento: mascaraDataBr(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-obs">Observações</Label>
                <Textarea
                  id="p-obs"
                  rows={3}
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.arquivado}
                  onCheckedChange={(v) => setForm({ ...form, arquivado: v })}
                />
                Arquivado
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
