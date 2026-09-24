/* eslint-disable @typescript-eslint/no-explicit-any */
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

export const Route = createFileRoute("/_authenticated/medicos-enfermagem")({
  head: () => ({
    meta: [
      { title: "Médicos — Enfermagem | Clínica CEU" },
      {
        name: "description",
        content:
          "Cadastro de médicos da Clínica CEU: especialidades, salas habilitadas, colaboradora padrão e exigência de profissional experiente.",
      },
      { property: "og:title", content: "Médicos — Enfermagem | Clínica CEU" },
      {
        property: "og:description",
        content: "Cadastro de médicos, especialidades e vínculos usados na escala semanal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaMedicos,
});

const SEM_VALOR = "__nenhum__";
const TODAS_COLABORADORAS = "__todas_colaboradoras__";

interface Medico {
  id: number;
  nome: string;
  apelido: string | null;
  crm: string | null;
  especialidade_principal: string | null;
  especialidades: string | null;
  procedimentos: string | null;
  observacoes: string | null;
  necessita_experiente: boolean;
  colaboradora_padrao_id: number | null;
  atende_todas_colaboradoras: boolean;
  ativo: boolean;
}

type FormMedico = Omit<Medico, "id"> & { id: number | null; salaIds: number[] };

const VAZIO: FormMedico = {
  id: null,
  nome: "",
  apelido: "",
  crm: "",
  especialidade_principal: "",
  especialidades: "",
  procedimentos: "",
  observacoes: "",
  necessita_experiente: false,
  colaboradora_padrao_id: null,
  atende_todas_colaboradoras: false,
  ativo: true,
  salaIds: [],
};

function PaginaMedicos() {
  const { temModulo, somenteLeitura, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [form, setForm] = useState<FormMedico | null>(null);
  const [novaEspecialidade, setNovaEspecialidade] = useState("");
  const [criandoEspecialidade, setCriandoEspecialidade] = useState(false);

  const medicos = useQuery({
    queryKey: ["medicos-enfermagem"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("medicos")
        .select("*")
        .eq("setor", "enfermagem")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Medico[];
    },
  });

  const apoio = useQuery({
    queryKey: ["medicos-enfermagem-apoio"],
    queryFn: async () => {
      const [salas, colabs, esp, vinculos, medicosDoSetor] = await Promise.all([
        (supabase as any).from("salas").select("id, nome").eq("setor", "enfermagem").order("nome"),
        (supabase as any)
          .from("colaboradoras")
          .select("id, nome")
          .eq("desativada", false)
          .eq("setor", "enfermagem")
          .order("nome"),
        supabase.from("especialidades").select("sigla, descricao").order("sigla"),
        supabase.from("medico_salas").select("medico_id, sala_id"),
        (supabase as any).from("medicos").select("id").eq("setor", "enfermagem"),
      ]);
      if (salas.error) throw salas.error;
      if (colabs.error) throw colabs.error;
      if (esp.error) throw esp.error;
      if (vinculos.error) throw vinculos.error;
      if (medicosDoSetor.error) throw medicosDoSetor.error;
      const salaIds = new Set((salas.data ?? []).map((s: { id: number }) => s.id));
      const medicoIds = new Set((medicosDoSetor.data ?? []).map((m: { id: number }) => m.id));
      return {
        salas: (salas.data ?? []) as { id: number; nome: string }[],
        colaboradoras: (colabs.data ?? []) as { id: number; nome: string }[],
        especialidades: (esp.data ?? []) as { sigla: string; descricao: string | null }[],
        vinculos: (vinculos.data ?? []).filter(
          (v: { medico_id: number; sala_id: number }) =>
            salaIds.has(v.sala_id) && medicoIds.has(v.medico_id),
        ) as { medico_id: number; sala_id: number }[],
      };
    },
  });
  async function adicionarEspecialidade() {
    const sigla = novaEspecialidade.trim();
    if (!sigla) return;
    setCriandoEspecialidade(true);
    const { error } = await supabase.from("especialidades").insert({ sigla, descricao: null });
    setCriandoEspecialidade(false);
    if (error) {
      toast.error(
        error.code === "23505" ? "Essa especialidade já está cadastrada." : error.message,
      );
      return;
    }
    setNovaEspecialidade("");
    toast.success(`${sigla} adicionada à lista de especialidades.`);
    await queryClient.invalidateQueries({ queryKey: ["medicos-enfermagem-apoio"] });
    setForm((atual) => (atual ? { ...atual, especialidade_principal: sigla } : atual));
  }

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (medicos.data ?? [])
      .filter((m) => (mostrarInativos ? true : m.ativo))
      .filter(
        (m) =>
          !termo ||
          m.nome.toLowerCase().includes(termo) ||
          (m.apelido ?? "").toLowerCase().includes(termo) ||
          (m.crm ?? "").toLowerCase().includes(termo) ||
          (m.especialidade_principal ?? "").toLowerCase().includes(termo),
      );
  }, [medicos.data, busca, mostrarInativos]);

  const salvar = useMutation({
    mutationFn: async (f: FormMedico) => {
      if (!f.nome.trim()) throw new Error("Informe o nome do médico.");
      const payload = {
        nome: f.nome.trim(),
        apelido: f.apelido?.trim() || null,
        crm: f.crm?.trim() || null,
        especialidade_principal: f.especialidade_principal?.trim() || null,
        especialidades: f.especialidades?.trim() || null,
        procedimentos: f.procedimentos?.trim() || null,
        observacoes: f.observacoes?.trim() || null,
        necessita_experiente: f.necessita_experiente,
        colaboradora_padrao_id: f.colaboradora_padrao_id,
        atende_todas_colaboradoras: f.atende_todas_colaboradoras,
        ativo: f.ativo,
        setor: "enfermagem",
      };
      let id = f.id;
      if (id) {
        const { error } = await supabase
          .from("medicos")
          .update(payload)
          .eq("id", id)
          .eq("setor", "enfermagem");
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("medicos")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        id = data.id as number;
      }
      const salasSelecionadas = Array.from(new Set(f.salaIds));
      if (salasSelecionadas.length) {
        const { data: salasValidas, error: erroSalas } = await supabase
          .from("salas")
          .select("id")
          .eq("setor", "enfermagem")
          .in("id", salasSelecionadas);
        if (erroSalas) throw erroSalas;
        if ((salasValidas ?? []).length !== salasSelecionadas.length) {
          throw new Error(
            "Só é possível vincular salas cadastradas em Salas de exame — Enfermagem.",
          );
        }
      }
      const { data: medicoValido, error: erroMedico } = await supabase
        .from("medicos")
        .select("id")
        .eq("id", id)
        .eq("setor", "enfermagem")
        .maybeSingle();
      if (erroMedico) throw erroMedico;
      if (!medicoValido) throw new Error("O médico selecionado não pertence ao setor Enfermagem.");
      const { error: errDel } = await supabase.from("medico_salas").delete().eq("medico_id", id);
      if (errDel) throw errDel;
      if (salasSelecionadas.length) {
        const { error } = await supabase
          .from("medico_salas")
          .insert(salasSelecionadas.map((sala_id) => ({ medico_id: id as number, sala_id })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Médico salvo.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["medicos-enfermagem"] });
      queryClient.invalidateQueries({ queryKey: ["medicos-enfermagem-apoio"] });
      queryClient.invalidateQueries({ queryKey: ["escala-apoio"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!carregandoSessao && !temModulo("enfermagem")) {
    return (
      <AppShell titulo="Médicos — Enfermagem">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso ao cadastro de médicos.
        </div>
      </AppShell>
    );
  }

  const nomeColab = (id: number | null) =>
    apoio.data?.colaboradoras.find((c) => c.id === id)?.nome ?? null;

  return (
    <AppShell
      titulo="Médicos — Enfermagem"
      descricao={`${lista.length} médico(s) listados`}
      acoes={
        !somenteLeitura && (
          <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
            <Plus className="mr-1.5 size-4" /> Novo médico
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, apelido, CRM ou especialidade"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={mostrarInativos} onCheckedChange={setMostrarInativos} />
          Mostrar inativos
        </label>
      </div>

      {medicos.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {lista.map((m) => {
            const salas = (apoio.data?.vinculos ?? [])
              .filter((v) => v.medico_id === m.id)
              .map((v) => apoio.data?.salas.find((s) => s.id === v.sala_id)?.nome)
              .filter(Boolean) as string[];
            return (
              <article
                key={m.id}
                className="card-superficie flex items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-foreground">
                    {m.nome}
                    {m.apelido ? ` (${m.apelido})` : ""}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {[m.crm ? `CRM ${m.crm}` : null, m.especialidade_principal]
                      .filter(Boolean)
                      .join(" • ") || "Sem CRM/especialidade"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {!m.ativo && (
                      <Badge variant="destructive" className="text-[10px]">
                        Inativo
                      </Badge>
                    )}
                    {m.necessita_experiente && (
                      <Badge variant="secondary" className="text-[10px]">
                        Exige experiente
                      </Badge>
                    )}
                    {nomeColab(m.colaboradora_padrao_id) && (
                      <Badge variant="outline" className="text-[10px]">
                        Padrão: {nomeColab(m.colaboradora_padrao_id)}
                      </Badge>
                    )}
                    {m.atende_todas_colaboradoras && (
                      <Badge variant="secondary" className="text-[10px]">
                        Todas as Colaboradoras
                      </Badge>
                    )}
                    {salas.slice(0, 3).map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                    {salas.length > 3 && (
                      <Badge variant="outline" className="text-[10px]">
                        +{salas.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
                {!somenteLeitura && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${m.nome}`}
                    onClick={() =>
                      setForm({
                        ...m,
                        apelido: m.apelido ?? "",
                        crm: m.crm ?? "",
                        especialidade_principal: m.especialidade_principal ?? "",
                        especialidades: m.especialidades ?? "",
                        procedimentos: m.procedimentos ?? "",
                        observacoes: m.observacoes ?? "",
                        salaIds: (apoio.data?.vinculos ?? [])
                          .filter((v) => v.medico_id === m.id)
                          .map((v) => v.sala_id),
                      })
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
              </article>
            );
          })}
          {!lista.length && (
            <p className="text-sm text-muted-foreground">Nenhum médico encontrado.</p>
          )}
        </div>
      )}

      {form && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-auto my-4 grid max-h-[92vh] w-full max-w-2xl gap-4 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <h2 className="text-lg font-semibold leading-none tracking-tight">
                {form.id ? "Editar médico" : "Novo médico"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Especialidades e salas alimentam a compatibilidade da escala semanal.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="m-nome">Nome</Label>
                <Input
                  id="m-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-apelido">Apelido</Label>
                <Input
                  id="m-apelido"
                  value={form.apelido ?? ""}
                  onChange={(e) => setForm({ ...form, apelido: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-crm">CRM</Label>
                <Input
                  id="m-crm"
                  value={form.crm ?? ""}
                  onChange={(e) => setForm({ ...form, crm: e.target.value })}
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
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 flex gap-2">
                  <Input
                    aria-label="Nova especialidade"
                    placeholder="Ex.: Cardiologista"
                    value={novaEspecialidade}
                    onChange={(event) => setNovaEspecialidade(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void adicionarEspecialidade();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void adicionarEspecialidade()}
                    disabled={criandoEspecialidade || !novaEspecialidade.trim()}
                  >
                    <Plus className="size-4" /> Criar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Crie uma nova opção e ela ficará disponível na lista, como Cardiologista.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Colaboradora padrão</Label>
                <Select
                  value={
                    form.atende_todas_colaboradoras
                      ? TODAS_COLABORADORAS
                      : form.colaboradora_padrao_id
                        ? String(form.colaboradora_padrao_id)
                        : SEM_VALOR
                  }
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      atende_todas_colaboradoras: v === TODAS_COLABORADORAS,
                      colaboradora_padrao_id:
                        v === SEM_VALOR || v === TODAS_COLABORADORAS ? null : Number(v),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={SEM_VALOR}>Nenhuma</SelectItem>
                    <SelectItem value={TODAS_COLABORADORAS}>Todas as Colaboradoras</SelectItem>
                    {(apoio.data?.colaboradoras ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="m-esp">Outras especialidades (separadas por vírgula)</Label>
                <Input
                  id="m-esp"
                  value={form.especialidades ?? ""}
                  onChange={(e) => setForm({ ...form, especialidades: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="m-proc">Procedimentos</Label>
                <Input
                  id="m-proc"
                  value={form.procedimentos ?? ""}
                  onChange={(e) => setForm({ ...form, procedimentos: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Salas habilitadas — Salas de exame — Enfermagem</Label>
                <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-3">
                  {(apoio.data?.salas ?? []).map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.salaIds.includes(s.id)}
                        onCheckedChange={(v) =>
                          setForm({
                            ...form,
                            salaIds: v
                              ? [...form.salaIds, s.id]
                              : form.salaIds.filter((x) => x !== s.id),
                          })
                        }
                      />
                      <span className="truncate">{s.nome}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="m-obs">Observações</Label>
                <Textarea
                  id="m-obs"
                  maxLength={800}
                  value={form.observacoes ?? ""}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.necessita_experiente}
                  onCheckedChange={(v) => setForm({ ...form, necessita_experiente: v })}
                />
                Exige colaboradora experiente
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                />
                Médico ativo
              </label>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
              <Button variant="outline" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button onClick={() => salvar.mutate(form)} disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
