import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { TIPOS_ITEM, type Item } from "@/lib/estoque";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/itens")({
  head: () => ({
    meta: [
      { title: "Itens e materiais | Clínica CEU" },
      {
        name: "description",
        content:
          "Cadastro de materiais e medicamentos da Clínica CEU: código, grupo, unidade, registro Anvisa, preço e controle de validade.",
      },
      { property: "og:title", content: "Itens e materiais | Clínica CEU" },
      { property: "og:description", content: "Catálogo de materiais e medicamentos usado pelo estoque." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaItens,
});

type FormItem = Omit<Item, "id"> & { id: number | null };

const VAZIO: FormItem = {
  id: null,
  codigo: "",
  nome: "",
  tipo: "Material",
  grupo: "",
  unidade: "UN",
  referencia: "",
  anvisa: "",
  preco: null,
  custo: null,
  ativo: true,
  el: false,
  cs: false,
  be: false,
  controla_validade: true,
};

function PaginaItens() {
  const { temModulo, somenteLeitura, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [form, setForm] = useState<FormItem | null>(null);

  const itens = useQuery({
    queryKey: ["itens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("itens").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (itens.data ?? [])
      .filter((i) => (mostrarInativos ? true : i.ativo))
      .filter((i) => tipo === "todos" || i.tipo === tipo)
      .filter(
        (i) =>
          !termo ||
          i.nome.toLowerCase().includes(termo) ||
          (i.codigo ?? "").toLowerCase().includes(termo) ||
          (i.grupo ?? "").toLowerCase().includes(termo),
      );
  }, [itens.data, busca, tipo, mostrarInativos]);

  const grupos = useMemo(
    () => Array.from(new Set((itens.data ?? []).map((i) => i.tipo).filter(Boolean))).sort(),
    [itens.data],
  );

  const salvar = useMutation({
    mutationFn: async (f: FormItem) => {
      if (!f.nome.trim()) throw new Error("Informe o nome do item.");
      const payload = {
        codigo: f.codigo?.trim() || null,
        nome: f.nome.trim(),
        tipo: f.tipo || "Material",
        grupo: f.grupo?.trim() || null,
        unidade: f.unidade?.trim() || null,
        referencia: f.referencia?.trim() || null,
        anvisa: f.anvisa?.trim() || null,
        preco: f.preco,
        custo: f.custo,
        ativo: f.ativo,
        el: f.el,
        cs: f.cs,
        be: f.be,
        controla_validade: f.controla_validade,
      };
      if (f.id) {
        const { error } = await supabase.from("itens").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("itens").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Item salvo.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["itens"] });
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!carregandoSessao && !temModulo("itens") && !temModulo("estoque")) {
    return (
      <AppShell titulo="Itens e materiais">
        <div className="card-superficie max-w-md p-6 text-sm">Você não tem acesso ao cadastro de itens.</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Itens e materiais"
      descricao={`${lista.length} item(ns) listados`}
      acoes={
        !somenteLeitura && (
          <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
            <Plus className="mr-1.5 size-4" /> Novo item
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, código ou grupo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {grupos.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={mostrarInativos} onCheckedChange={setMostrarInativos} />
          Mostrar inativos
        </label>
      </div>

      {itens.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {lista.map((i) => (
            <article key={i.id} className="card-superficie flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-foreground">{i.nome}</h2>
                <p className="text-xs text-muted-foreground">
                  {[i.codigo, i.tipo, i.grupo, i.unidade].filter(Boolean).join(" • ")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {!i.ativo && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
                  {i.controla_validade && <Badge variant="outline" className="text-[10px]">Controla validade</Badge>}
                  {i.el && <Badge variant="secondary" className="text-[10px]">EL</Badge>}
                  {i.cs && <Badge variant="secondary" className="text-[10px]">CS</Badge>}
                  {i.be && <Badge variant="secondary" className="text-[10px]">BE</Badge>}
                </div>
              </div>
              {!somenteLeitura && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${i.nome}`}
                  onClick={() => setForm({ ...i })}
                >
                  <Pencil className="size-4" />
                </Button>
              )}
            </article>
          ))}
          {!lista.length && <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar item" : "Novo item"}</DialogTitle>
            <DialogDescription>
              Itens que controlam validade exigem data de vencimento na entrada de lotes.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="i-nome">Nome</Label>
                <Input id="i-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-codigo">Código</Label>
                <Input id="i-codigo" value={form.codigo ?? ""} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-tipo">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger id="i-tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set([...TIPOS_ITEM, ...grupos])).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-grupo">Grupo</Label>
                <Input id="i-grupo" value={form.grupo ?? ""} onChange={(e) => setForm({ ...form, grupo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-unidade">Unidade</Label>
                <Input id="i-unidade" value={form.unidade ?? ""} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-ref">Referência</Label>
                <Input id="i-ref" value={form.referencia ?? ""} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-anvisa">Registro Anvisa</Label>
                <Input id="i-anvisa" value={form.anvisa ?? ""} onChange={(e) => setForm({ ...form, anvisa: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-preco">Preço (R$)</Label>
                <Input
                  id="i-preco"
                  inputMode="decimal"
                  value={form.preco ?? ""}
                  onChange={(e) => setForm({ ...form, preco: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-custo">Custo (R$)</Label>
                <Input
                  id="i-custo"
                  inputMode="decimal"
                  value={form.custo ?? ""}
                  onChange={(e) => setForm({ ...form, custo: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")) })}
                />
              </div>
              <div className="flex flex-wrap gap-4 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.controla_validade} onCheckedChange={(v) => setForm({ ...form, controla_validade: v })} />
                  Controla validade
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                  Ativo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.el} onCheckedChange={(v) => setForm({ ...form, el: v })} /> EL
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.cs} onCheckedChange={(v) => setForm({ ...form, cs: v })} /> CS
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.be} onCheckedChange={(v) => setForm({ ...form, be: v })} /> BE
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
            <Button disabled={salvar.isPending} onClick={() => form && salvar.mutate(form)}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
