import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Phone, Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useRamais } from "@/components/RamaisConsulta";
import { useSessao } from "@/hooks/use-sessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  CATEGORIAS,
  SITUACOES,
  SITUACOES_LIVRES,
  combina,
  tomSituacao,
  type Ramal,
} from "@/lib/ramais";

export const Route = createFileRoute("/_authenticated/ramais")({
  head: () => ({
    meta: [
      { title: "Ramais | Gestão de Sistemas - Clínica CEU" },
      {
        name: "description",
        content:
          "Lista telefônica interna da Clínica CEU: consulta e gerenciamento dos ramais por setor, responsável, localização e situação.",
      },
      { property: "og:title", content: "Ramais | Gestão de Sistemas - Clínica CEU" },
      {
        property: "og:description",
        content: "Consulte e gerencie os ramais telefônicos da Clínica CEU.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaRamais,
});

const TODOS = "__todos__";
const SEM_VALOR = "__nenhum__";

type FormRamal = Omit<Ramal, "id"> & { id: number | null };

const VAZIO: FormRamal = {
  id: null,
  numero: "",
  setor: "",
  responsavel: "",
  localizacao: "",
  categoria: "",
  situacao: "Em uso",
  observacoes: "",
};

function PaginaRamais() {
  const { temModulo, isMaster, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const ramais = useRamais();
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState(TODOS);
  const [categoria, setCategoria] = useState(TODOS);
  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(null);
  const [somenteLivres, setSomenteLivres] = useState(false);
  const [setoresAbertos, setSetoresAbertos] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormRamal | null>(null);
  const [excluir, setExcluir] = useState<Ramal | null>(null);

  const podeVisualizar = temModulo("ramais");
  const podeGerenciar = isMaster || temModulo("ramais_editar");

  const categorias = useMemo(
    () =>
      Array.from(
        new Set((ramais.data ?? []).map((r) => r.categoria).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [ramais.data],
  );

  const lista = useMemo(
    () =>
      (ramais.data ?? [])
        .filter((r) => combina(r, busca))
        .filter((r) => situacao === TODOS || r.situacao === situacao)
        .filter((r) => categoria === TODOS || r.categoria === categoria)
        .filter((r) => !somenteLivres || SITUACOES_LIVRES.includes(r.situacao)),
    [ramais.data, busca, situacao, categoria, somenteLivres],
  );
  const gruposPorSetor = useMemo(() => {
    const grupos = new Map<string, Ramal[]>();
    const ramaisDaCategoria = categoriaAberta
      ? lista.filter((ramal) => ramal.categoria === categoriaAberta)
      : lista;
    for (const ramal of ramaisDaCategoria) {
      const setor = ramal.setor?.trim() || "Sem setor";
      grupos.set(setor, [...(grupos.get(setor) ?? []), ramal]);
    }
    return [...grupos.entries()].sort(([a], [b]) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
    );
  }, [lista, categoriaAberta]);
  function alternarSetor(setor: string) {
    setSetoresAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(setor)) proximo.delete(setor);
      else proximo.add(setor);
      return proximo;
    });
  }
  function alternarCategoria(categoriaSelecionada: string) {
    if (categoriaAberta === categoriaSelecionada) {
      setCategoriaAberta(null);
      return;
    }
    setCategoriaAberta(categoriaSelecionada);
    setSetoresAbertos(
      new Set(
        lista
          .filter((ramal) => ramal.categoria === categoriaSelecionada)
          .map((ramal) => ramal.setor?.trim() || "Sem setor"),
      ),
    );
  }

  const resumo = useMemo(() => {
    const todos = ramais.data ?? [];
    const conta = (s: string) => todos.filter((r) => r.situacao === s).length;
    return {
      total: todos.length,
      emUso: conta("Em uso"),
      livres: conta("Livre"),
      semUso: conta("Sem utilização"),
      ausente: conta("Usuário ausente"),
      soChama: conta("Só chama"),
      inativos: conta("Inativo"),
    };
  }, [ramais.data]);

  const salvar = useMutation({
    mutationFn: async (f: FormRamal) => {
      const numero = f.numero?.trim() || null;
      if (numero && !/^\d{2,6}$/.test(numero)) {
        throw new Error("O número do ramal deve conter apenas dígitos.");
      }
      const duplicado = (ramais.data ?? []).find((r) => r.numero === numero && r.id !== f.id);
      if (numero && duplicado) throw new Error("Este número de ramal já está cadastrado.");

      const payload = {
        numero,
        setor: f.setor?.trim() || null,
        responsavel: f.responsavel?.trim() || null,
        localizacao: f.localizacao?.trim() || null,
        categoria: f.categoria?.trim() || null,
        situacao: f.situacao,
        observacoes: f.observacoes?.trim() || null,
      };

      if (f.id) {
        const { error } = await supabase.from("ramais").update(payload).eq("id", f.id);
        if (error) throw new Error(traduzirErro(error.message));
      } else {
        const { error } = await supabase.from("ramais").insert(payload);
        if (error) throw new Error(traduzirErro(error.message));
      }
    },
    onSuccess: () => {
      toast.success("Ramal salvo.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["ramais"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remover = useMutation({
    mutationFn: async (r: Ramal) => {
      const { error } = await supabase.from("ramais").delete().eq("id", r.id);
      if (error) throw new Error(traduzirErro(error.message));
    },
    onSuccess: () => {
      toast.success("Ramal excluído.");
      setExcluir(null);
      queryClient.invalidateQueries({ queryKey: ["ramais"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!carregandoSessao && !ramais.isLoading && ramais.isError) {
    return (
      <AppShell titulo="Ramais">
        <div className="card-superficie max-w-md p-6 text-sm">
          Não foi possível carregar os ramais.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Ramais"
      descricao="Lista telefônica interna da Clínica CEU"
      acoes={
        podeGerenciar && (
          <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
            <Plus className="mr-1.5 size-4" /> Adicionar ramal
          </Button>
        )
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {[
          { r: "Total", v: resumo.total },
          { r: "Em uso", v: resumo.emUso },
          { r: "Livres", v: resumo.livres },
          { r: "Sem utilização", v: resumo.semUso },
          { r: "Usuário ausente", v: resumo.ausente },
          { r: "Só chama", v: resumo.soChama },
          { r: "Inativos", v: resumo.inativos },
        ].map((i) => (
          <div key={i.r} className="card-superficie p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{i.r}</p>
            <p className="mt-1 font-display text-xl font-semibold text-foreground">{i.v}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por número, setor, responsável ou localização"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar ramal"
          />
        </div>
        <Select value={situacao} onValueChange={setSituacao}>
          <SelectTrigger className="w-[170px]" aria-label="Filtrar por situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as situações</SelectItem>
            {SITUACOES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-[190px]" aria-label="Filtrar por setor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os setores</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={somenteLivres ? "default" : "outline"}
          size="sm"
          onClick={() => setSomenteLivres((v) => !v)}
        >
          🟢 Ramais livres
        </Button>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {["Matriz", "Medicina Nuclear"].map((grupo) => {
          const quantidade = lista.filter((ramal) => ramal.categoria === grupo).length;
          const aberto = categoriaAberta === grupo;
          return (
            <button
              key={grupo}
              type="button"
              className={cn(
                "flex items-center justify-between rounded-lg border p-4 text-left transition-colors",
                aberto
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:bg-secondary/40",
              )}
              onClick={() => alternarCategoria(grupo)}
              aria-expanded={aberto}
            >
              <span className="flex items-center gap-2 font-medium">
                {aberto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                {grupo}
              </span>
              <span className="text-xs text-muted-foreground">
                {quantidade} {quantidade === 1 ? "ramal" : "ramais"}
              </span>
            </button>
          );
        })}
      </div>

      {ramais.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <div className="card-superficie p-6 text-sm text-muted-foreground">
          Nenhum ramal encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="space-y-2">
          {gruposPorSetor.map(([setor, membros]) => {
            const aberto = setoresAbertos.has(setor);
            return (
              <section key={setor} className="card-superficie overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-secondary/40"
                  onClick={() => alternarSetor(setor)}
                  aria-expanded={aberto}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {aberto ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                    <span className="truncate font-medium text-foreground">{setor}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {membros.length} {membros.length === 1 ? "ramal" : "ramais"}
                  </span>
                </button>
                {aberto && (
                  <div className="overflow-x-auto border-t border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Ramal</th>
                          <th className="hidden px-3 py-2 sm:table-cell">Responsável</th>
                          <th className="hidden px-3 py-2 md:table-cell">Localização</th>
                          <th className="hidden px-3 py-2 lg:table-cell">Observação</th>
                          <th className="px-3 py-2">Situação</th>
                          {podeGerenciar && <th className="px-3 py-2 text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {membros.map((r) => (
                          <tr key={r.id} className="border-t border-border">
                            <td className="px-3 py-2 font-semibold text-foreground">
                              {r.numero ?? "—"}
                            </td>
                            <td className="hidden px-3 py-2 sm:table-cell">
                              {r.responsavel ?? "—"}
                            </td>
                            <td className="hidden px-3 py-2 md:table-cell">
                              {r.localizacao ?? "—"}
                            </td>
                            <td className="hidden max-w-[260px] truncate px-3 py-2 text-muted-foreground lg:table-cell">
                              {r.observacoes ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={cn(
                                  "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                                  tomSituacao(r.situacao),
                                )}
                              >
                                {r.situacao}
                              </span>
                            </td>
                            {podeGerenciar && (
                              <td className="px-3 py-2">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Editar ramal ${r.numero ?? ""}`}
                                    onClick={() =>
                                      setForm({
                                        id: r.id,
                                        numero: r.numero ?? "",
                                        setor: r.setor ?? "",
                                        responsavel: r.responsavel ?? "",
                                        localizacao: r.localizacao ?? "",
                                        categoria: r.categoria ?? "",
                                        situacao: r.situacao,
                                        observacoes: r.observacoes ?? "",
                                      })
                                    }
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Excluir ramal ${r.numero ?? ""}`}
                                    onClick={() => setExcluir(r)}
                                  >
                                    <Trash2 className="size-4 text-vermelho" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {!podeGerenciar && podeVisualizar && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Phone className="size-3.5" /> Você pode consultar os ramais. Alterações são feitas pela
          administração.
        </p>
      )}

      <Dialog open={!!form} onOpenChange={(a) => !a && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar ramal" : "Adicionar ramal"}</DialogTitle>
            <DialogDescription>
              O número pode ficar em branco para ramais ainda não definidos.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="numero">Número do ramal</Label>
                <Input
                  id="numero"
                  inputMode="numeric"
                  value={form.numero ?? ""}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="situacao">Situação</Label>
                <Select
                  value={form.situacao}
                  onValueChange={(v) => setForm({ ...form, situacao: v })}
                >
                  <SelectTrigger id="situacao">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITUACOES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="setor">Setor / descrição</Label>
                <Input
                  id="setor"
                  value={form.setor ?? ""}
                  onChange={(e) => setForm({ ...form, setor: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="responsavel">Responsável</Label>
                <Input
                  id="responsavel"
                  value={form.responsavel ?? ""}
                  onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="localizacao">Localização</Label>
                <Input
                  id="localizacao"
                  value={form.localizacao ?? ""}
                  onChange={(e) => setForm({ ...form, localizacao: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="categoria">Categoria</Label>
                <Select
                  value={form.categoria || SEM_VALOR}
                  onValueChange={(v) => setForm({ ...form, categoria: v === SEM_VALOR ? "" : v })}
                >
                  <SelectTrigger id="categoria">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_VALOR}>Sem categoria</SelectItem>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="observacoes">Observação</Label>
                <Textarea
                  id="observacoes"
                  rows={3}
                  value={form.observacoes ?? ""}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
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

      <AlertDialog open={!!excluir} onOpenChange={(a) => !a && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ramal?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o ramal {excluir?.numero ?? "sem número"}
              {excluir?.setor ? ` - ${excluir.setor}` : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluir && remover.mutate(excluir)}>
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function traduzirErro(mensagem: string) {
  if (mensagem.includes("ramais_numero_unico")) return "Este número de ramal já está cadastrado.";
  if (mensagem.toLowerCase().includes("row-level security") || mensagem.includes("permission"))
    return "Você não tem permissão para alterar os ramais.";
  return mensagem;
}
