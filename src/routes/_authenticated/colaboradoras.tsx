import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

export const Route = createFileRoute("/_authenticated/colaboradoras")({
  head: () => ({
    meta: [
      { title: "Colaboradoras | Clínica CEU" },
      {
        name: "description",
        content:
          "Cadastro de colaboradoras da Clínica CEU: jornada, especialidades, treinamentos, médicos atendidos e banco de horas.",
      },
      { property: "og:title", content: "Colaboradoras | Clínica CEU" },
      {
        property: "og:description",
        content: "Equipe de apoio, jornadas e vínculos usados na sugestão da escala semanal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaColaboradoras,
});

const SEM_VALOR = "__nenhum__";
const TIPOS = [
  "Secretária",
  "Recepção",
  "Técnica",
  "Enfermeira",
  "Estagiária",
  "Coordenadora",
  "Supervisora",
];

interface Colaboradora {
  id: number;
  nome: string;
  apelido: string | null;
  cargo: string | null;
  jornada: string | null;
  status: string | null;
  entrada: string | null;
  saida: string | null;
  especialidades: string | null;
  treinamentos: string | null;
  funcoes: string | null;
  observacoes: string | null;
  banco_horas: number;
  medico_padrao_id: number | null;
  tipo_colaboradora: string | null;
  atende_todos_medicos: boolean;
  desativada: boolean;
  ausente?: boolean;
  motivoAusencia?: string | null;
}

type FormColab = Omit<Colaboradora, "id" | "banco_horas"> & {
  id: number | null;
  medicoIds: number[];
  ausente: boolean;
  motivoAusencia: string;
};

const VAZIO: FormColab = {
  id: null,
  nome: "",
  apelido: "",
  cargo: "",
  jornada: "",
  status: "",
  entrada: "",
  saida: "",
  especialidades: "",
  treinamentos: "",
  funcoes: "",
  observacoes: "",
  medico_padrao_id: null,
  tipo_colaboradora: "",
  atende_todos_medicos: false,
  desativada: false,
  medicoIds: [],
  ausente: false,
  motivoAusencia: "",
};

function PaginaColaboradoras() {
  const { temModulo, somenteLeitura, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [mostrarDesativadas, setMostrarDesativadas] = useState(false);
  const [form, setForm] = useState<FormColab | null>(null);

  const colaboradoras = useQuery({
    queryKey: ["colaboradoras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradoras").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Colaboradora[];
    },
  });

  const apoio = useQuery({
    queryKey: ["colaboradoras-apoio"],
    queryFn: async () => {
      const [medicos, esp, vinculos, ausencias] = await Promise.all([
        supabase.from("medicos").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("especialidades").select("sigla, descricao").order("sigla"),
        supabase.from("colaboradora_medicos_padrao").select("colaboradora_id, medico_id"),
        supabase
          .from("ausencias")
          .select("colaboradora_id, tipo, observacoes, data_inicio, data_fim")
          .gte("data_fim", new Date().toISOString().slice(0, 10)),
      ]);
      return {
        medicos: (medicos.data ?? []) as { id: number; nome: string }[],
        especialidades: (esp.data ?? []) as { sigla: string; descricao: string | null }[],
        vinculos: (vinculos.data ?? []) as { colaboradora_id: number; medico_id: number }[],
        ausencias: (ausencias.data ?? []) as {
          colaboradora_id: number;
          tipo: string | null;
          observacoes: string | null;
          data_inicio: string | null;
          data_fim: string | null;
        }[],
      };
    },
  });

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (colaboradoras.data ?? [])
      .filter((c) => (mostrarDesativadas ? true : !c.desativada))
      .filter(
        (c) =>
          !termo ||
          c.nome.toLowerCase().includes(termo) ||
          (c.apelido ?? "").toLowerCase().includes(termo) ||
          (c.cargo ?? "").toLowerCase().includes(termo) ||
          (c.especialidades ?? "").toLowerCase().includes(termo),
      );
  }, [colaboradoras.data, busca, mostrarDesativadas]);

  const salvar = useMutation({
    mutationFn: async (f: FormColab) => {
      if (!f.nome.trim()) throw new Error("Informe o nome da colaboradora.");
      const payload = {
        nome: f.nome.trim(),
        apelido: f.apelido?.trim() || null,
        cargo: f.cargo?.trim() || null,
        jornada: f.jornada?.trim() || null,
        status: f.status?.trim() || null,
        entrada: f.entrada || null,
        saida: f.saida || null,
        especialidades: f.especialidades?.trim() || null,
        treinamentos: f.treinamentos?.trim() || null,
        funcoes: f.funcoes?.trim() || null,
        observacoes: f.observacoes?.trim() || null,
        medico_padrao_id: f.medico_padrao_id,
        tipo_colaboradora: f.tipo_colaboradora?.trim() || null,
        atende_todos_medicos: f.atende_todos_medicos,
        desativada: f.desativada,
      };
      let id = f.id;
      if (id) {
        const { error } = await (supabase as any)
          .from("colaboradoras")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("colaboradoras")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        id = data.id as number;
      }
      const { error: errDel } = await supabase
        .from("colaboradora_medicos_padrao")
        .delete()
        .eq("colaboradora_id", id);
      if (errDel) throw errDel;
      if (f.medicoIds.length) {
        const { error } = await supabase
          .from("colaboradora_medicos_padrao")
          .insert(f.medicoIds.map((medico_id) => ({ colaboradora_id: id as number, medico_id })));
        if (error) throw error;
      }
      await supabase
        .from("ausencias")
        .delete()
        .eq("colaboradora_id", id)
        .gte("data_fim", new Date().toISOString().slice(0, 10));
      if (f.ausente) {
        const { error } = await supabase.from("ausencias").insert({
          colaboradora_id: id,
          tipo: f.motivoAusencia.trim() || "Ausência",
          data_inicio: new Date().toISOString().slice(0, 10),
          data_fim: "2099-12-31",
          observacoes: f.motivoAusencia.trim() || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Colaboradora salva.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["colaboradoras"] });
      queryClient.invalidateQueries({ queryKey: ["colaboradoras-apoio"] });
      queryClient.invalidateQueries({ queryKey: ["escala-apoio"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!carregandoSessao && !temModulo("colaboradoras")) {
    return (
      <AppShell titulo="Colaboradoras">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso ao cadastro de colaboradoras.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Colaboradoras"
      descricao={`${lista.length} colaboradora(s) listadas`}
      acoes={
        !somenteLeitura && (
          <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
            <Plus className="mr-1.5 size-4" /> Nova colaboradora
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, cargo ou especialidade"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={mostrarDesativadas} onCheckedChange={setMostrarDesativadas} />
          Mostrar desativadas
        </label>
      </div>

      {colaboradoras.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {lista.map((c) => (
            <article
              key={c.id}
              className="card-superficie flex items-start justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-foreground">{c.nome}</h2>
                <p className="text-xs text-muted-foreground">
                  {[c.cargo, c.jornada, c.entrada && c.saida ? `${c.entrada}–${c.saida}` : null]
                    .filter(Boolean)
                    .join(" • ") || "Sem jornada definida"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.desativada && (
                    <Badge variant="destructive" className="text-[10px]">
                      Desativada
                    </Badge>
                  )}
                  {c.atende_todos_medicos && (
                    <Badge variant="secondary" className="text-[10px]">
                      Atende todos
                    </Badge>
                  )}
                  {c.tipo_colaboradora && (
                    <Badge variant="outline" className="text-[10px]">
                      {c.tipo_colaboradora}
                    </Badge>
                  )}
                  {!!Number(c.banco_horas) && (
                    <Badge variant="outline" className="text-[10px]">
                      Banco: {Number(c.banco_horas)}h
                    </Badge>
                  )}
                  {(c.especialidades ?? "")
                    .split(",")
                    .map((e) => e.trim())
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((e) => (
                      <Badge key={e} variant="outline" className="text-[10px]">
                        {e}
                      </Badge>
                    ))}
                </div>
              </div>
              {!somenteLeitura && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${c.nome}`}
                  onClick={() => {
                    const ausencia = (apoio.data?.ausencias ?? []).find(
                      (a) => a.colaboradora_id === c.id,
                    );
                    setForm({
                      ...c,
                      apelido: c.apelido ?? c.nome.trim().split(/\s+/)[0] ?? "",
                      jornada: c.jornada ?? "",
                      status: c.status ?? "",
                      entrada: c.entrada ?? "",
                      saida: c.saida ?? "",
                      especialidades: c.especialidades ?? "",
                      treinamentos: c.treinamentos ?? "",
                      funcoes: c.funcoes ?? "",
                      observacoes: c.observacoes ?? "",
                      tipo_colaboradora: c.tipo_colaboradora ?? "",
                      medicoIds: (apoio.data?.vinculos ?? [])
                        .filter((v) => v.colaboradora_id === c.id)
                        .map((v) => v.medico_id),
                      ausente: !!ausencia,
                      motivoAusencia: ausencia?.observacoes ?? ausencia?.tipo ?? "",
                    });
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              )}
            </article>
          ))}
          {!lista.length && (
            <p className="text-sm text-muted-foreground">Nenhuma colaboradora encontrada.</p>
          )}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar colaboradora" : "Nova colaboradora"}</DialogTitle>
            <DialogDescription>
              Especialidades, treinamentos e médicos vinculados alimentam a pontuação das sugestões.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="c-nome">Nome</Label>
                <Input
                  id="c-nome"
                  value={form.nome}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nome: e.target.value,
                      apelido: form.apelido || e.target.value.trim().split(/\s+/)[0] || "",
                    })
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="c-apelido">Apelido para a escala/JPEG</Label>
                <Input
                  id="c-apelido"
                  value={form.apelido ?? ""}
                  onChange={(e) => setForm({ ...form, apelido: e.target.value })}
                  placeholder="Primeiro nome sugerido automaticamente"
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  Administradores podem editar este nome curto. O nome completo permanece no
                  cadastro.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-cargo">Cargo</Label>
                <Input
                  id="c-cargo"
                  value={form.cargo ?? ""}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo_colaboradora || SEM_VALOR}
                  onValueChange={(v) =>
                    setForm({ ...form, tipo_colaboradora: v === SEM_VALOR ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_VALOR}>Não informado</SelectItem>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-jornada">Jornada</Label>
                <Input
                  id="c-jornada"
                  placeholder="Ex.: 44h semanais"
                  value={form.jornada ?? ""}
                  onChange={(e) => setForm({ ...form, jornada: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="c-ent">Entrada</Label>
                  <Input
                    id="c-ent"
                    type="time"
                    value={form.entrada ?? ""}
                    onChange={(e) => setForm({ ...form, entrada: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-sai">Saída</Label>
                  <Input
                    id="c-sai"
                    type="time"
                    value={form.saida ?? ""}
                    onChange={(e) => setForm({ ...form, saida: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="c-esp">Especialidades (separadas por vírgula)</Label>
                <Input
                  id="c-esp"
                  value={form.especialidades ?? ""}
                  onChange={(e) => setForm({ ...form, especialidades: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Siglas cadastradas:{" "}
                  {(apoio.data?.especialidades ?? []).map((e) => e.sigla).join(", ") || "—"}
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="c-trein">Treinamentos</Label>
                <Input
                  id="c-trein"
                  placeholder="Ex.: Experiente, Punção, Vacina"
                  value={form.treinamentos ?? ""}
                  onChange={(e) => setForm({ ...form, treinamentos: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="c-func">Funções</Label>
                <Input
                  id="c-func"
                  value={form.funcoes ?? ""}
                  onChange={(e) => setForm({ ...form, funcoes: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Médico padrão</Label>
                <Select
                  value={form.medico_padrao_id ? String(form.medico_padrao_id) : SEM_VALOR}
                  onValueChange={(v) =>
                    setForm({ ...form, medico_padrao_id: v === SEM_VALOR ? null : Number(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={SEM_VALOR}>Nenhum</SelectItem>
                    {(apoio.data?.medicos ?? []).map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Médicos que costuma atender</Label>
                <div className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
                  {(apoio.data?.medicos ?? []).map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.medicoIds.includes(m.id)}
                        onCheckedChange={(v) =>
                          setForm({
                            ...form,
                            medicoIds: v
                              ? [...form.medicoIds, m.id]
                              : form.medicoIds.filter((x) => x !== m.id),
                          })
                        }
                      />
                      <span className="truncate">{m.nome}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="c-obs">Observações</Label>
                <Textarea
                  id="c-obs"
                  maxLength={800}
                  value={form.observacoes ?? ""}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.atende_todos_medicos}
                  onCheckedChange={(v) => setForm({ ...form, atende_todos_medicos: v })}
                />
                Atende todos os médicos
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={!form.desativada}
                  onCheckedChange={(v) => setForm({ ...form, desativada: !v })}
                />
                Colaboradora ativa
              </label>
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-amber-950">
                  <Switch
                    checked={form.ausente}
                    onCheckedChange={(v) => setForm({ ...form, ausente: v })}
                  />
                  Marcar como ausente
                </label>
                {form.ausente && (
                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="c-motivo-ausencia">Motivo da ausência</Label>
                    <Input
                      id="c-motivo-ausencia"
                      placeholder="Ex.: férias, atestado, folga, licença"
                      value={form.motivoAusencia}
                      onChange={(e) => setForm({ ...form, motivoAusencia: e.target.value })}
                    />
                    <p className="text-xs text-amber-800">
                      Ao tentar incluí-la na escala, o sistema exibirá um alerta para confirmação da
                      coordenadora.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={() => form && salvar.mutate(form)} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
