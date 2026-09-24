import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
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

// A coluna setor é criada pela migration e será incorporada aos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/salas-enfermagem")({
  head: () => ({
    meta: [
      { title: "Salas de exame — Enfermagem | Clínica CEU" },
      {
        name: "description",
        content: "Cadastro independente das salas de exame utilizadas pela Enfermagem.",
      },
      { property: "og:title", content: "Salas de exame — Enfermagem | Clínica CEU" },
      {
        property: "og:description",
        content: "Salas de exames independentes para a escala semanal da Enfermagem.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaSalas,
});

const SEM_VALOR = "__nenhum__";

interface Sala {
  id: number;
  nome: string;
  unidade: string | null;
  especialidade_principal: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  ativa: boolean;
  recursos: string | null;
  observacoes: string | null;
  aparelho_id: number | null;
  setor: "operacao" | "enfermagem";
}

type FormSala = Omit<Sala, "id"> & {
  id: number | null;
  medicoIds: number[];
  colaboradoraIds: number[];
};

const VAZIO: FormSala = {
  id: null,
  nome: "",
  unidade: "",
  especialidade_principal: "",
  horario_inicio: "",
  horario_fim: "",
  ativa: true,
  recursos: "",
  observacoes: "",
  aparelho_id: null,
  setor: "enfermagem",
  medicoIds: [],
  colaboradoraIds: [],
};

function PaginaSalas() {
  const { temModulo, somenteLeitura, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const [form, setForm] = useState<FormSala | null>(null);

  const salas = useQuery({
    queryKey: ["salas-enfermagem"],
    queryFn: async () => {
      const { data, error } = await db
        .from("salas")
        .select("*")
        .eq("setor", "enfermagem")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Sala[];
    },
  });

  const apoio = useQuery({
    queryKey: ["salas-enfermagem-apoio"],
    queryFn: async () => {
      const [aparelhos, esp, medicos, colaboradoras, salasDoSetor, medicoSalas, salaColaboradoras] =
        await Promise.all([
          supabase
            .from("aparelhos_ultrassom")
            .select("id, sala, aparelho")
            .eq("ativo", true)
            .order("sala"),
          supabase.from("especialidades").select("sigla, descricao").order("sigla"),
          db
            .from("medicos")
            .select("id, nome")
            .eq("setor", "enfermagem")
            .eq("ativo", true)
            .order("nome"),
          db
            .from("colaboradoras")
            .select("id, nome")
            .eq("setor", "enfermagem")
            .eq("desativada", false)
            .order("nome"),
          db.from("salas").select("id").eq("setor", "enfermagem"),
          supabase.from("medico_salas").select("medico_id, sala_id"),
          supabase.from("sala_colaboradoras").select("colaboradora_id, sala_id"),
        ]);
      const salaIds = new Set((salasDoSetor.data ?? []).map((s: { id: number }) => s.id));
      const medicoIds = new Set((medicos.data ?? []).map((m: { id: number }) => m.id));
      const colaboradoraIds = new Set((colaboradoras.data ?? []).map((c: { id: number }) => c.id));
      return {
        aparelhos: (aparelhos.data ?? []) as { id: number; sala: string; aparelho: string }[],
        especialidades: (esp.data ?? []) as { sigla: string; descricao: string | null }[],
        medicos: (medicos.data ?? []) as { id: number; nome: string }[],
        colaboradoras: (colaboradoras.data ?? []) as { id: number; nome: string }[],
        medicoSalas: (medicoSalas.data ?? []).filter(
          (v: { medico_id: number; sala_id: number }) =>
            salaIds.has(v.sala_id) && medicoIds.has(v.medico_id),
        ) as { medico_id: number; sala_id: number }[],
        salaColaboradoras: (salaColaboradoras.data ?? []).filter(
          (v: { colaboradora_id: number; sala_id: number }) =>
            salaIds.has(v.sala_id) && colaboradoraIds.has(v.colaboradora_id),
        ) as { colaboradora_id: number; sala_id: number }[],
      };
    },
  });

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (salas.data ?? [])
      .filter((s) => (mostrarInativas ? true : s.ativa))
      .filter(
        (s) =>
          !termo ||
          s.nome.toLowerCase().includes(termo) ||
          (s.unidade ?? "").toLowerCase().includes(termo) ||
          (s.especialidade_principal ?? "").toLowerCase().includes(termo),
      );
  }, [salas.data, busca, mostrarInativas]);

  const salvar = useMutation({
    mutationFn: async (f: FormSala) => {
      if (!f.nome.trim()) throw new Error("Informe o nome da sala.");
      const payload = {
        nome: f.nome.trim(),
        unidade: f.unidade?.trim() || null,
        especialidade_principal: f.especialidade_principal?.trim() || null,
        horario_inicio: f.horario_inicio || null,
        horario_fim: f.horario_fim || null,
        ativa: f.ativa,
        recursos: f.recursos?.trim() || null,
        observacoes: f.observacoes?.trim() || null,
        aparelho_id: f.aparelho_id,
        setor: "enfermagem" as const,
      };
      let id = f.id;
      if (id) {
        const { error } = await db.from("salas").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { data, error } = await db.from("salas").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id as number;
      }
      const { error: erroMedicos } = await supabase.from("medico_salas").delete().eq("sala_id", id);
      if (erroMedicos) throw erroMedicos;
      const { error: erroColaboradoras } = await supabase
        .from("sala_colaboradoras")
        .delete()
        .eq("sala_id", id);
      if (erroColaboradoras) throw erroColaboradoras;
      if (f.medicoIds.length) {
        const { error } = await supabase
          .from("medico_salas")
          .insert(f.medicoIds.map((medico_id) => ({ medico_id, sala_id: id })));
        if (error) throw error;
      }
      if (f.colaboradoraIds.length) {
        const { error } = await supabase
          .from("sala_colaboradoras")
          .insert(f.colaboradoraIds.map((colaboradora_id) => ({ colaboradora_id, sala_id: id })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Sala salva.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["salas-enfermagem"] });
      queryClient.invalidateQueries({ queryKey: ["salas-enfermagem-apoio"] });
      queryClient.invalidateQueries({ queryKey: ["escala-apoio"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const excluir = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await db.from("salas").delete().eq("id", id).eq("setor", "enfermagem");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sala enviada para a lixeira.");
      queryClient.invalidateQueries({ queryKey: ["salas-enfermagem"] });
      queryClient.invalidateQueries({ queryKey: ["escala-apoio"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const excluirTodas = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("salas").delete().eq("setor", "enfermagem");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Todas as salas de Enfermagem foram enviadas para a lixeira.");
      queryClient.invalidateQueries({ queryKey: ["salas-enfermagem"] });
      queryClient.invalidateQueries({ queryKey: ["escala-apoio"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const alternarAtiva = useMutation({
    mutationFn: async ({ id, ativa }: { id: number; ativa: boolean }) => {
      const { error } = await db
        .from("salas")
        .update({ ativa })
        .eq("id", id)
        .eq("setor", "enfermagem");
      if (error) throw error;
    },
    onSuccess: (_, { ativa }) => {
      toast.success(ativa ? "Sala ativada." : "Sala inativada.");
      queryClient.invalidateQueries({ queryKey: ["salas-enfermagem"] });
      queryClient.invalidateQueries({ queryKey: ["escala-apoio"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!carregandoSessao && !temModulo("enfermagem")) {
    return (
      <AppShell titulo="Salas de exame — Enfermagem">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso ao cadastro de salas.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Salas de exame — Enfermagem"
      descricao={`${lista.length} sala(s) de exame da Enfermagem`}
      acoes={
        !somenteLeitura && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (window.confirm("Enviar todas as salas de Enfermagem para a lixeira?")) {
                  excluirTodas.mutate();
                }
              }}
            >
              <Trash2 className="mr-1.5 size-4" /> Apagar todas
            </Button>
            <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
              <Plus className="mr-1.5 size-4" /> Nova sala
            </Button>
          </div>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, unidade ou especialidade"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={mostrarInativas} onCheckedChange={setMostrarInativas} />
          Mostrar inativas
        </label>
      </div>

      {salas.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {lista.map((s) => {
            const aparelho = apoio.data?.aparelhos.find((a) => a.id === s.aparelho_id);
            return (
              <article
                key={s.id}
                className="card-superficie flex items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-foreground">{s.nome}</h2>
                  <p className="text-xs text-muted-foreground">
                    {[
                      s.unidade,
                      s.especialidade_principal,
                      s.horario_inicio && s.horario_fim
                        ? `${s.horario_inicio}–${s.horario_fim}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" • ") || "Sem dados complementares"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {!s.ativa && (
                      <Badge variant="destructive" className="text-[10px]">
                        Inativa
                      </Badge>
                    )}
                    {aparelho && (
                      <Badge variant="outline" className="text-[10px]">
                        {aparelho.aparelho}
                      </Badge>
                    )}
                    {(s.recursos ?? "")
                      .split(",")
                      .map((r) => r.trim())
                      .filter(Boolean)
                      .slice(0, 3)
                      .map((r) => (
                        <Badge key={r} variant="secondary" className="text-[10px]">
                          {r}
                        </Badge>
                      ))}
                  </div>
                </div>
                {!somenteLeitura && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={s.ativa ? `Inativar ${s.nome}` : `Ativar ${s.nome}`}
                      title={s.ativa ? "Inativar sala" : "Ativar sala"}
                      onClick={() => alternarAtiva.mutate({ id: s.id, ativa: !s.ativa })}
                    >
                      <Power
                        className={`size-4 ${s.ativa ? "text-emerald-600" : "text-muted-foreground"}`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${s.nome}`}
                      title="Editar sala"
                      onClick={() =>
                        setForm({
                          ...s,
                          unidade: s.unidade ?? "",
                          especialidade_principal: s.especialidade_principal ?? "",
                          horario_inicio: s.horario_inicio ?? "",
                          horario_fim: s.horario_fim ?? "",
                          recursos: s.recursos ?? "",
                          observacoes: s.observacoes ?? "",
                          medicoIds: (apoio.data?.medicoSalas ?? [])
                            .filter((v) => v.sala_id === s.id)
                            .map((v) => v.medico_id),
                          colaboradoraIds: (apoio.data?.salaColaboradoras ?? [])
                            .filter((v) => v.sala_id === s.id)
                            .map((v) => v.colaboradora_id),
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Excluir ${s.nome}`}
                      title="Excluir sala"
                      onClick={() => {
                        if (window.confirm(`Enviar a sala "${s.nome}" para a lixeira?`)) {
                          excluir.mutate(s.id);
                        }
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
            <p className="text-sm text-muted-foreground">Nenhuma sala encontrada.</p>
          )}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar sala" : "Nova sala"}</DialogTitle>
            <DialogDescription>
              A especialidade da sala é usada na checagem de compatibilidade da escala.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="s-nome">Nome</Label>
                <Input
                  id="s-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-unid">Unidade</Label>
                <Input
                  id="s-unid"
                  value={form.unidade ?? ""}
                  onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Especialidade principal</Label>
                <Select
                  value={form.especialidade_principal || SEM_VALOR}
                  onValueChange={(v) =>
                    setForm({ ...form, especialidade_principal: v === SEM_VALOR ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={SEM_VALOR}>Não informada</SelectItem>
                    {(apoio.data?.especialidades ?? []).map((e) => (
                      <SelectItem key={e.sigla} value={e.sigla}>
                        {e.sigla}
                        {e.descricao ? ` — ${e.descricao}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-ini">Abertura</Label>
                <Input
                  id="s-ini"
                  type="time"
                  value={form.horario_inicio ?? ""}
                  onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-fim">Fechamento</Label>
                <Input
                  id="s-fim"
                  type="time"
                  value={form.horario_fim ?? ""}
                  onChange={(e) => setForm({ ...form, horario_fim: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Aparelho de ultrassom</Label>
                <Select
                  value={form.aparelho_id ? String(form.aparelho_id) : SEM_VALOR}
                  onValueChange={(v) =>
                    setForm({ ...form, aparelho_id: v === SEM_VALOR ? null : Number(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={SEM_VALOR}>Nenhum</SelectItem>
                    {(apoio.data?.aparelhos ?? []).map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.aparelho} — {a.sala}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Médicos vinculados a esta sala</Label>
                <div className="max-h-36 overflow-y-auto rounded-md border p-3">
                  {(apoio.data?.medicos ?? []).length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(apoio.data?.medicos ?? []).map((medico) => (
                        <label key={medico.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={form.medicoIds.includes(medico.id)}
                            onCheckedChange={(checked) =>
                              setForm({
                                ...form,
                                medicoIds: checked
                                  ? [...form.medicoIds, medico.id]
                                  : form.medicoIds.filter((id) => id !== medico.id),
                              })
                            }
                          />
                          {medico.nome}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum Médico ativo cadastrado para Enfermagem.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Colaboradoras vinculadas a esta sala</Label>
                <div className="max-h-36 overflow-y-auto rounded-md border p-3">
                  {(apoio.data?.colaboradoras ?? []).length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(apoio.data?.colaboradoras ?? []).map((colaboradora) => (
                        <label key={colaboradora.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={form.colaboradoraIds.includes(colaboradora.id)}
                            onCheckedChange={(checked) =>
                              setForm({
                                ...form,
                                colaboradoraIds: checked
                                  ? [...form.colaboradoraIds, colaboradora.id]
                                  : form.colaboradoraIds.filter((id) => id !== colaboradora.id),
                              })
                            }
                          />
                          {colaboradora.nome}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma Colaboradora ativa cadastrada para Enfermagem.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="s-rec">Recursos (separados por vírgula)</Label>
                <Input
                  id="s-rec"
                  value={form.recursos ?? ""}
                  onChange={(e) => setForm({ ...form, recursos: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="s-obs">Observações</Label>
                <Textarea
                  id="s-obs"
                  maxLength={800}
                  value={form.observacoes ?? ""}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.ativa}
                  onCheckedChange={(v) => setForm({ ...form, ativa: v })}
                />
                Sala ativa
              </label>
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
