import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileText, Pencil, Plus, Search, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { brParaIso, hojeIso, isoParaBr, mascaraDataBr, somarDiasIso } from "@/lib/datas";
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

// As tabelas são criadas pela migration e ainda não aparecem nos tipos gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores | Clínica CEU" },
      {
        name: "description",
        content: "Fornecedores, documentos e alertas de validade da Clínica CEU.",
      },
      { property: "og:title", content: "Fornecedores | Clínica CEU" },
      {
        property: "og:description",
        content: "Controle de documentos e validades dos fornecedores.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaFornecedores,
});

type Fornecedor = {
  id: number;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ativo: boolean;
};

type Documento = {
  id: number;
  fornecedor_id: number;
  nome: string;
  numero: string | null;
  validade: string | null;
  observacoes: string | null;
};

type FormFornecedor = Omit<Fornecedor, "id"> & { id: number | null };
type FormDocumento = Omit<Documento, "id" | "fornecedor_id"> & {
  id: number | null;
  fornecedor_id: number;
};

const VAZIO_FORNECEDOR: FormFornecedor = {
  id: null,
  nome: "",
  cnpj: "",
  telefone: "",
  email: "",
  observacoes: "",
  ativo: true,
};

const vazioDocumento = (fornecedor_id: number): FormDocumento => ({
  id: null,
  fornecedor_id,
  nome: "",
  numero: "",
  validade: "",
  observacoes: "",
});

type StatusDocumento = "valido" | "alerta" | "vencido" | "sem-data";

function statusDocumento(validade: string | null): StatusDocumento {
  if (!validade) return "sem-data";
  const hoje = hojeIso();
  if (validade.slice(0, 10) < hoje) return "vencido";
  return validade.slice(0, 10) <= somarDiasIso(hoje, 30) ? "alerta" : "valido";
}

const CORES_STATUS: Record<StatusDocumento, string> = {
  valido: "border-emerald-300 bg-emerald-50 text-emerald-900",
  alerta: "border-orange-300 bg-orange-50 text-orange-900",
  vencido: "border-red-300 bg-red-50 text-red-900",
  "sem-data": "border-slate-200 bg-slate-50 text-slate-700",
};

const ROTULOS_STATUS: Record<StatusDocumento, string> = {
  valido: "Dentro da validade",
  alerta: "Vence nos próximos 30 dias",
  vencido: "Vencido",
  "sem-data": "Sem validade informada",
};

function PaginaFornecedores() {
  const { temModulo, somenteLeitura, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [fornecedorForm, setFornecedorForm] = useState<FormFornecedor | null>(null);
  const [documentoForm, setDocumentoForm] = useState<FormDocumento | null>(null);

  const fornecedores = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await db.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Fornecedor[];
    },
  });

  const documentos = useQuery({
    queryKey: ["fornecedor-documentos"],
    queryFn: async () => {
      const { data, error } = await db.from("fornecedor_documentos").select("*");
      if (error) throw error;
      return (data ?? []) as Documento[];
    },
  });

  const salvarFornecedor = useMutation({
    mutationFn: async (form: FormFornecedor) => {
      if (!form.nome.trim()) throw new Error("Informe o nome da empresa.");
      const payload = {
        nome: form.nome.trim(),
        cnpj: form.cnpj?.trim() || null,
        telefone: form.telefone?.trim() || null,
        email: form.email?.trim() || null,
        observacoes: form.observacoes?.trim() || null,
        ativo: form.ativo,
      };
      const resultado = form.id
        ? await db.from("fornecedores").update(payload).eq("id", form.id).select("id").single()
        : await db.from("fornecedores").insert(payload).select("id").single();
      if (resultado.error) throw resultado.error;
      return resultado.data.id as number;
    },
    onSuccess: () => {
      toast.success("Fornecedor salvo.");
      setFornecedorForm(null);
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const salvarDocumento = useMutation({
    mutationFn: async (form: FormDocumento) => {
      if (!form.nome.trim()) throw new Error("Informe o nome do documento.");
      const validade = form.validade ? brParaIso(form.validade) : null;
      if (form.validade && !validade) throw new Error("Validade inválida (use DD-MM-AAAA).");
      const payload = {
        fornecedor_id: form.fornecedor_id,
        nome: form.nome.trim(),
        numero: form.numero?.trim() || null,
        validade,
        observacoes: form.observacoes?.trim() || null,
      };
      const resultado = form.id
        ? await db.from("fornecedor_documentos").update(payload).eq("id", form.id)
        : await db.from("fornecedor_documentos").insert(payload);
      if (resultado.error) throw resultado.error;
    },
    onSuccess: () => {
      toast.success("Documento salvo.");
      setDocumentoForm(null);
      queryClient.invalidateQueries({ queryKey: ["fornecedor-documentos"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const excluirDocumento = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await db.from("fornecedor_documentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento enviado para a lixeira.");
      queryClient.invalidateQueries({ queryKey: ["fornecedor-documentos"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const excluirFornecedor = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await db.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor enviado para a lixeira.");
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      queryClient.invalidateQueries({ queryKey: ["fornecedor-documentos"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (fornecedores.data ?? [])
      .filter((fornecedor) => mostrarInativos || fornecedor.ativo)
      .map((fornecedor) => {
        const docs = (documentos.data ?? [])
          .filter((documento) => documento.fornecedor_id === fornecedor.id)
          .sort((a, b) => (a.validade ?? "9999-12-31").localeCompare(b.validade ?? "9999-12-31"));
        return { fornecedor, documentos: docs };
      })
      .filter(
        ({ fornecedor, documentos: docs }) =>
          !termo ||
          fornecedor.nome.toLowerCase().includes(termo) ||
          (fornecedor.cnpj ?? "").toLowerCase().includes(termo) ||
          docs.some((documento) => documento.nome.toLowerCase().includes(termo)),
      )
      .sort((a, b) => {
        const validadeA = a.documentos[0]?.validade ?? "9999-12-31";
        const validadeB = b.documentos[0]?.validade ?? "9999-12-31";
        return (
          validadeA.localeCompare(validadeB) || a.fornecedor.nome.localeCompare(b.fornecedor.nome)
        );
      });
  }, [fornecedores.data, documentos.data, busca, mostrarInativos]);

  const resumo = useMemo(() => {
    const todos = documentos.data ?? [];
    return {
      total: todos.length,
      alerta: todos.filter((documento) => statusDocumento(documento.validade) === "alerta").length,
      vencidos: todos.filter((documento) => statusDocumento(documento.validade) === "vencido")
        .length,
    };
  }, [documentos.data]);

  if (!carregandoSessao && !temModulo("fornecedores")) {
    return (
      <AppShell titulo="Fornecedores">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso ao cadastro de fornecedores.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Fornecedores"
      descricao={`${lista.length} empresa(s) • ${resumo.total} documento(s)`}
      acoes={
        !somenteLeitura && (
          <Button size="sm" onClick={() => setFornecedorForm({ ...VAZIO_FORNECEDOR })}>
            <Plus className="mr-1.5 size-4" /> Nova empresa
          </Button>
        )
      }
    >
      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar empresa ou documento"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Badge variant="outline" className="justify-center border-orange-300 text-orange-700">
          {resumo.alerta} vencendo em 30 dias
        </Badge>
        <Badge variant="outline" className="justify-center border-red-300 text-red-700">
          {resumo.vencidos} vencido(s)
        </Badge>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={mostrarInativos} onCheckedChange={setMostrarInativos} /> Mostrar inativos
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500" /> Dentro da validade
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-orange-500" /> Vence em até 30 dias
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500" /> Vencido
        </span>
        <span className="ml-auto">Documentos ordenados pela validade mais próxima</span>
      </div>

      {fornecedores.isLoading || documentos.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {lista.map(({ fornecedor, documentos: docs }) => (
            <section key={fornecedor.id} className="card-superficie overflow-hidden">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">{fornecedor.nome}</h2>
                    {!fornecedor.ativo && (
                      <Badge variant="destructive" className="text-[10px]">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[fornecedor.cnpj, fornecedor.telefone, fornecedor.email]
                      .filter(Boolean)
                      .join(" • ") || "Sem dados complementares"}
                  </p>
                </div>
                {!somenteLeitura && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Editar empresa"
                      onClick={() => setFornecedorForm({ ...fornecedor })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      title="Excluir empresa"
                      onClick={() =>
                        window.confirm(`Enviar "${fornecedor.nome}" para a lixeira?`) &&
                        excluirFornecedor.mutate(fornecedor.id)
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </header>

              <div className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium">
                    <FileText className="size-4" /> Documentos
                  </h3>
                  {!somenteLeitura && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDocumentoForm(vazioDocumento(fornecedor.id))}
                    >
                      <Plus className="mr-1.5 size-4" /> Adicionar documento
                    </Button>
                  )}
                </div>
                {docs.length ? (
                  <div className="space-y-2">
                    {docs.map((documento) => {
                      const status = statusDocumento(documento.validade);
                      return (
                        <div
                          key={documento.id}
                          className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${CORES_STATUS[status]}`}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 font-medium">
                              <span>{documento.nome}</span>
                              <Badge variant="outline" className="border-current text-[10px]">
                                {ROTULOS_STATUS[status]}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs opacity-80">
                              {documento.numero ? `Nº ${documento.numero} • ` : ""}
                              Validade: {isoParaBr(documento.validade) || "não informada"}
                              {documento.observacoes ? ` • ${documento.observacoes}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {status !== "valido" && status !== "sem-data" && (
                              <TriangleAlert className="size-4" />
                            )}
                            {!somenteLeitura && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Editar documento"
                                  onClick={() =>
                                    setDocumentoForm({
                                      ...documento,
                                      validade: isoParaBr(documento.validade),
                                      numero: documento.numero ?? "",
                                      observacoes: documento.observacoes ?? "",
                                    })
                                  }
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  title="Excluir documento"
                                  onClick={() =>
                                    window.confirm(`Enviar "${documento.nome}" para a lixeira?`) &&
                                    excluirDocumento.mutate(documento.id)
                                  }
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Nenhum documento cadastrado.
                  </p>
                )}
              </div>
            </section>
          ))}
          {!lista.length && (
            <p className="card-superficie p-8 text-center text-sm text-muted-foreground">
              Nenhum fornecedor encontrado.
            </p>
          )}
        </div>
      )}

      <Dialog open={!!fornecedorForm} onOpenChange={(v) => !v && setFornecedorForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{fornecedorForm?.id ? "Editar empresa" : "Nova empresa"}</DialogTitle>
            <DialogDescription>Cadastre os dados principais do fornecedor.</DialogDescription>
          </DialogHeader>
          {fornecedorForm && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="f-nome">Nome da empresa *</Label>
                <Input
                  id="f-nome"
                  value={fornecedorForm.nome}
                  onChange={(e) => setFornecedorForm({ ...fornecedorForm, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-cnpj">CNPJ</Label>
                <Input
                  id="f-cnpj"
                  value={fornecedorForm.cnpj ?? ""}
                  onChange={(e) => setFornecedorForm({ ...fornecedorForm, cnpj: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-tel">Telefone</Label>
                <Input
                  id="f-tel"
                  value={fornecedorForm.telefone ?? ""}
                  onChange={(e) =>
                    setFornecedorForm({ ...fornecedorForm, telefone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="f-email">E-mail</Label>
                <Input
                  id="f-email"
                  type="email"
                  value={fornecedorForm.email ?? ""}
                  onChange={(e) => setFornecedorForm({ ...fornecedorForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="f-obs">Observações</Label>
                <Textarea
                  id="f-obs"
                  value={fornecedorForm.observacoes ?? ""}
                  onChange={(e) =>
                    setFornecedorForm({ ...fornecedorForm, observacoes: e.target.value })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={fornecedorForm.ativo}
                  onCheckedChange={(ativo) => setFornecedorForm({ ...fornecedorForm, ativo })}
                />{" "}
                Empresa ativa
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFornecedorForm(null)}>
              Cancelar
            </Button>
            <Button
              disabled={salvarFornecedor.isPending}
              onClick={() => fornecedorForm && salvarFornecedor.mutate(fornecedorForm)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!documentoForm} onOpenChange={(v) => !v && setDocumentoForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{documentoForm?.id ? "Editar documento" : "Novo documento"}</DialogTitle>
            <DialogDescription>
              O documento será ordenado automaticamente pela data de validade.
            </DialogDescription>
          </DialogHeader>
          {documentoForm && (
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-nome">Nome do documento *</Label>
                <Input
                  id="d-nome"
                  placeholder="Ex.: Licença sanitária"
                  value={documentoForm.nome}
                  onChange={(e) => setDocumentoForm({ ...documentoForm, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-numero">Número / identificação</Label>
                <Input
                  id="d-numero"
                  value={documentoForm.numero ?? ""}
                  onChange={(e) => setDocumentoForm({ ...documentoForm, numero: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-validade">Validade (DD-MM-AAAA)</Label>
                <Input
                  id="d-validade"
                  placeholder="DD-MM-AAAA"
                  value={documentoForm.validade ?? ""}
                  onChange={(e) =>
                    setDocumentoForm({ ...documentoForm, validade: mascaraDataBr(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-obs">Observações</Label>
                <Textarea
                  id="d-obs"
                  value={documentoForm.observacoes ?? ""}
                  onChange={(e) =>
                    setDocumentoForm({ ...documentoForm, observacoes: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDocumentoForm(null)}>
              Cancelar
            </Button>
            <Button
              disabled={salvarDocumento.isPending}
              onClick={() => documentoForm && salvarDocumento.mutate(documentoForm)}
            >
              Salvar documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
