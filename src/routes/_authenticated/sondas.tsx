import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Search, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { brParaIso, isoParaBr, mascaraDataBr, hojeIso } from "@/lib/datas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SondasInventario } from "@/components/SondasInventario";

export const Route = createFileRoute("/_authenticated/sondas")({
  head: () => ({
    meta: [
      { title: "Sondas | Clínica CEU" },
      {
        name: "description",
        content:
          "Controle de desinfecção de sondas, teste de fita e troca de cuba da Clínica CEU, com histórico, responsáveis e alertas de validade.",
      },
      { property: "og:title", content: "Sondas | Clínica CEU" },
      {
        property: "og:description",
        content: "Registros de desinfecção, teste de fita e troca de cuba das sondas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaSondas,
});

interface Desinfeccao {
  id: number;
  data: string;
  numero_sonda: string;
  protocolo: string | null;
  horario_inicio: string | null;
  horario_termino: string | null;
  assinatura: string | null;
  observacao: string | null;
}

interface TesteFita {
  id: number;
  data_teste: string;
  produto: string | null;
  lote: string | null;
  validade: string | null;
  validade_produto_cuba: string | null;
  responsavel: string | null;
  observacao: string | null;
}

interface TrocaCuba {
  id: number;
  data_troca: string;
  produto: string | null;
  lote: string | null;
  validade_rioscope: string | null;
  proxima_troca: string | null;
  responsavel: string | null;
}

function horaAgora() {
  return new Date().toTimeString().slice(0, 5);
}

const FORM_DESINF = {
  data: isoParaBr(hojeIso()),
  numero_sonda: "",
  protocolo: "",
  horario_inicio: horaAgora(),
  horario_termino: "",
  assinatura: "",
  observacao: "",
};

const FORM_FITA = {
  data_teste: isoParaBr(hojeIso()),
  produto: "",
  lote: "",
  validade: "",
  validade_produto_cuba: "",
  responsavel: "",
  observacao: "",
};

const FORM_CUBA = {
  data_troca: isoParaBr(hojeIso()),
  produto: "",
  lote: "",
  validade_rioscope: "",
  proxima_troca: "",
  responsavel: "",
};

function PaginaSondas() {
  const { temModulo, somenteLeitura, sessao, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState("desinfeccao");
  const [formDesinf, setFormDesinf] = useState<typeof FORM_DESINF | null>(null);
  const [formFita, setFormFita] = useState<typeof FORM_FITA | null>(null);
  const [formCuba, setFormCuba] = useState<typeof FORM_CUBA | null>(null);

  const desinfeccoes = useQuery({
    queryKey: ["sondas-desinfeccao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sondas_desinfeccao")
        .select("*")
        .order("data", { ascending: false })
        .order("id", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Desinfeccao[];
    },
  });

  const testes = useQuery({
    queryKey: ["sondas-teste-fita"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sondas_teste_fita")
        .select("*")
        .order("data_teste", { ascending: false })
        .order("id", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as TesteFita[];
    },
  });

  const cubas = useQuery({
    queryKey: ["sondas-troca-cuba"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sondas_troca_cuba")
        .select("*")
        .order("data_troca", { ascending: false })
        .order("id", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as TrocaCuba[];
    },
  });

  const termo = busca.trim().toLowerCase();
  const listaDesinf = useMemo(
    () =>
      (desinfeccoes.data ?? []).filter((d) =>
        !termo
          ? true
          : [d.numero_sonda, d.protocolo, d.assinatura, d.observacao]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(termo)),
      ),
    [desinfeccoes.data, termo],
  );
  const listaFita = useMemo(
    () =>
      (testes.data ?? []).filter((t) =>
        !termo
          ? true
          : [t.produto, t.lote, t.responsavel, t.observacao]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(termo)),
      ),
    [testes.data, termo],
  );
  const listaCuba = useMemo(
    () =>
      (cubas.data ?? []).filter((c) =>
        !termo
          ? true
          : [c.produto, c.lote, c.responsavel]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(termo)),
      ),
    [cubas.data, termo],
  );

  /** Última troca de cuba: alerta quando a próxima troca já passou (nunca bloqueia registros). */
  const ultimaCuba = (cubas.data ?? [])[0];
  const cubaVencida =
    !!ultimaCuba?.proxima_troca && ultimaCuba.proxima_troca.slice(0, 10) < hojeIso();

  const salvarDesinf = useMutation({
    mutationFn: async (f: typeof FORM_DESINF) => {
      const data = brParaIso(f.data);
      if (!data) throw new Error("Informe a data no formato DD-MM-AAAA.");
      if (!f.numero_sonda.trim()) throw new Error("Informe o número da sonda.");
      const { error } = await supabase.from("sondas_desinfeccao").insert({
        data,
        numero_sonda: f.numero_sonda.trim(),
        protocolo: f.protocolo.trim() || null,
        horario_inicio: f.horario_inicio || null,
        horario_termino: f.horario_termino || null,
        assinatura: f.assinatura.trim() || sessao?.nome || null,
        observacao: f.observacao.trim() || null,
        created_by: sessao?.userId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Desinfecção registrada.");
      setFormDesinf(null);
      queryClient.invalidateQueries({ queryKey: ["sondas-desinfeccao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarFita = useMutation({
    mutationFn: async (f: typeof FORM_FITA) => {
      const data = brParaIso(f.data_teste);
      if (!data) throw new Error("Informe a data do teste no formato DD-MM-AAAA.");
      const validade = f.validade ? brParaIso(f.validade) : null;
      if (f.validade && !validade) throw new Error("Validade inválida (DD-MM-AAAA).");
      const validadeCuba = f.validade_produto_cuba ? brParaIso(f.validade_produto_cuba) : null;
      if (f.validade_produto_cuba && !validadeCuba)
        throw new Error("Validade do produto da cuba inválida (DD-MM-AAAA).");
      const { error } = await supabase.from("sondas_teste_fita").insert({
        data_teste: data,
        produto: f.produto.trim() || null,
        lote: f.lote.trim() || null,
        validade,
        validade_produto_cuba: validadeCuba,
        responsavel: f.responsavel.trim() || sessao?.nome || null,
        observacao: f.observacao.trim() || null,
        created_by: sessao?.userId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Teste de fita registrado.");
      setFormFita(null);
      queryClient.invalidateQueries({ queryKey: ["sondas-teste-fita"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarCuba = useMutation({
    mutationFn: async (f: typeof FORM_CUBA) => {
      const data = brParaIso(f.data_troca);
      if (!data) throw new Error("Informe a data da troca no formato DD-MM-AAAA.");
      const proxima = f.proxima_troca ? brParaIso(f.proxima_troca) : null;
      if (f.proxima_troca && !proxima) throw new Error("Próxima troca inválida (DD-MM-AAAA).");
      const validade = f.validade_rioscope ? brParaIso(f.validade_rioscope) : null;
      if (f.validade_rioscope && !validade) throw new Error("Validade inválida (DD-MM-AAAA).");
      const { error } = await supabase.from("sondas_troca_cuba").insert({
        data_troca: data,
        produto: f.produto.trim() || null,
        lote: f.lote.trim() || null,
        validade_rioscope: validade,
        proxima_troca: proxima,
        responsavel: f.responsavel.trim() || sessao?.nome || null,
        created_by: sessao?.userId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Troca de cuba registrada.");
      setFormCuba(null);
      queryClient.invalidateQueries({ queryKey: ["sondas-troca-cuba"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async ({ tabela, id }: { tabela: string; id: number }) => {
      const { error } = await supabase
        .from(tabela as "sondas_desinfeccao")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return tabela;
    },
    onSuccess: (tabela) => {
      toast.success("Registro excluído.");
      const chave =
        tabela === "sondas_desinfeccao"
          ? "sondas-desinfeccao"
          : tabela === "sondas_teste_fita"
            ? "sondas-teste-fita"
            : "sondas-troca-cuba";
      queryClient.invalidateQueries({ queryKey: [chave] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (carregandoSessao) {
    return (
      <AppShell titulo="Sondas">
        <Skeleton className="h-64 w-full" />
      </AppShell>
    );
  }

  if (!temModulo("sondas")) {
    return (
      <AppShell titulo="Sondas">
        <p className="text-sm text-muted-foreground">Você não tem acesso ao controle de sondas.</p>
      </AppShell>
    );
  }

  const podeEditar = !somenteLeitura;

  function novo() {
    if (aba === "desinfeccao") setFormDesinf({ ...FORM_DESINF, horario_inicio: horaAgora() });
    else if (aba === "fita") setFormFita({ ...FORM_FITA });
    else setFormCuba({ ...FORM_CUBA });
  }

  return (
    <AppShell
      titulo="Sondas"
      descricao="Desinfecção, teste de fita e troca de cuba com histórico rastreável"
      acoes={
        podeEditar && aba !== "inventario" ? (
          <Button size="sm" onClick={novo}>
            <Plus className="size-4" /> Novo registro
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {cubaVencida && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>
              A próxima troca de cuba estava prevista para{" "}
              <strong>{isoParaBr(ultimaCuba?.proxima_troca)}</strong>. Verifique a solução da cuba.
            </span>
          </div>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por sonda, produto, lote ou responsável"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="inventario">🔬 Inventário técnico</TabsTrigger>
            <TabsTrigger value="desinfeccao">Desinfecção</TabsTrigger>
            <TabsTrigger value="fita">Teste de fita</TabsTrigger>
            <TabsTrigger value="cuba">Troca de cuba</TabsTrigger>
          </TabsList>

          <TabsContent value="inventario" className="mt-4">
            <SondasInventario />
          </TabsContent>

          <TabsContent value="desinfeccao" className="mt-4">
            {desinfeccoes.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : listaDesinf.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma desinfecção registrada.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Sonda</th>
                      <th className="px-3 py-2">Protocolo</th>
                      <th className="px-3 py-2">Início</th>
                      <th className="px-3 py-2">Término</th>
                      <th className="px-3 py-2">Assinatura</th>
                      <th className="px-3 py-2">Observação</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {listaDesinf.map((d) => (
                      <tr key={d.id} className="border-t border-border">
                        <td className="whitespace-nowrap px-3 py-2">{isoParaBr(d.data)}</td>
                        <td className="px-3 py-2 font-medium">{d.numero_sonda}</td>
                        <td className="px-3 py-2">{d.protocolo ?? "—"}</td>
                        <td className="px-3 py-2">{d.horario_inicio?.slice(0, 5) ?? "—"}</td>
                        <td className="px-3 py-2">{d.horario_termino?.slice(0, 5) ?? "—"}</td>
                        <td className="px-3 py-2">{d.assinatura ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{d.observacao ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          {podeEditar && (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Excluir registro"
                              onClick={() =>
                                excluir.mutate({ tabela: "sondas_desinfeccao", id: d.id })
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="fita" className="mt-4">
            {testes.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : listaFita.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum teste de fita registrado.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Produto</th>
                      <th className="px-3 py-2">Lote</th>
                      <th className="px-3 py-2">Validade</th>
                      <th className="px-3 py-2">Validade cuba</th>
                      <th className="px-3 py-2">Responsável</th>
                      <th className="px-3 py-2">Observação</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {listaFita.map((t) => {
                      const vencido = !!t.validade && t.validade.slice(0, 10) < hojeIso();
                      return (
                        <tr key={t.id} className="border-t border-border">
                          <td className="whitespace-nowrap px-3 py-2">{isoParaBr(t.data_teste)}</td>
                          <td className="px-3 py-2 font-medium">{t.produto ?? "—"}</td>
                          <td className="px-3 py-2">{t.lote ?? "—"}</td>
                          <td className="px-3 py-2">
                            {t.validade ? (
                              <Badge variant={vencido ? "destructive" : "secondary"}>
                                {isoParaBr(t.validade)}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2">{isoParaBr(t.validade_produto_cuba) || "—"}</td>
                          <td className="px-3 py-2">{t.responsavel ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{t.observacao ?? "—"}</td>
                          <td className="px-3 py-2 text-right">
                            {podeEditar && (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Excluir registro"
                                onClick={() =>
                                  excluir.mutate({ tabela: "sondas_teste_fita", id: t.id })
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="cuba" className="mt-4">
            {cubas.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : listaCuba.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma troca de cuba registrada.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Data da troca</th>
                      <th className="px-3 py-2">Produto</th>
                      <th className="px-3 py-2">Lote</th>
                      <th className="px-3 py-2">Validade Rioscope</th>
                      <th className="px-3 py-2">Próxima troca</th>
                      <th className="px-3 py-2">Responsável</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {listaCuba.map((c) => {
                      const atrasada =
                        !!c.proxima_troca && c.proxima_troca.slice(0, 10) < hojeIso();
                      return (
                        <tr key={c.id} className="border-t border-border">
                          <td className="whitespace-nowrap px-3 py-2">{isoParaBr(c.data_troca)}</td>
                          <td className="px-3 py-2 font-medium">{c.produto ?? "—"}</td>
                          <td className="px-3 py-2">{c.lote ?? "—"}</td>
                          <td className="px-3 py-2">{isoParaBr(c.validade_rioscope) || "—"}</td>
                          <td className="px-3 py-2">
                            {c.proxima_troca ? (
                              <Badge variant={atrasada ? "destructive" : "secondary"}>
                                {isoParaBr(c.proxima_troca)}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2">{c.responsavel ?? "—"}</td>
                          <td className="px-3 py-2 text-right">
                            {podeEditar && (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Excluir registro"
                                onClick={() =>
                                  excluir.mutate({ tabela: "sondas_troca_cuba", id: c.id })
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Desinfecção */}
      <Dialog open={!!formDesinf} onOpenChange={(o) => !o && setFormDesinf(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar desinfecção</DialogTitle>
            <DialogDescription>
              Registre o ciclo de desinfecção da sonda com horários e responsável.
            </DialogDescription>
          </DialogHeader>
          {formDesinf && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="d-data">Data</Label>
                <Input
                  id="d-data"
                  value={formDesinf.data}
                  onChange={(e) =>
                    setFormDesinf({ ...formDesinf, data: mascaraDataBr(e.target.value) })
                  }
                  placeholder="DD-MM-AAAA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-sonda">Número da sonda</Label>
                <Input
                  id="d-sonda"
                  value={formDesinf.numero_sonda}
                  onChange={(e) => setFormDesinf({ ...formDesinf, numero_sonda: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-prot">Protocolo</Label>
                <Input
                  id="d-prot"
                  value={formDesinf.protocolo}
                  onChange={(e) => setFormDesinf({ ...formDesinf, protocolo: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-assin">Assinatura / responsável</Label>
                <Input
                  id="d-assin"
                  value={formDesinf.assinatura}
                  onChange={(e) => setFormDesinf({ ...formDesinf, assinatura: e.target.value })}
                  placeholder={sessao?.nome ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-ini">Início</Label>
                <Input
                  id="d-ini"
                  type="time"
                  value={formDesinf.horario_inicio}
                  onChange={(e) => setFormDesinf({ ...formDesinf, horario_inicio: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-fim">Término</Label>
                <Input
                  id="d-fim"
                  type="time"
                  value={formDesinf.horario_termino}
                  onChange={(e) =>
                    setFormDesinf({ ...formDesinf, horario_termino: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="d-obs">Observação</Label>
                <Textarea
                  id="d-obs"
                  value={formDesinf.observacao}
                  onChange={(e) => setFormDesinf({ ...formDesinf, observacao: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormDesinf(null)}>
              Cancelar
            </Button>
            <Button
              disabled={salvarDesinf.isPending}
              onClick={() => formDesinf && salvarDesinf.mutate(formDesinf)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teste de fita */}
      <Dialog open={!!formFita} onOpenChange={(o) => !o && setFormFita(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar teste de fita</DialogTitle>
            <DialogDescription>
              Controle da concentração da solução usada na desinfecção das sondas.
            </DialogDescription>
          </DialogHeader>
          {formFita && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="f-data">Data do teste</Label>
                <Input
                  id="f-data"
                  value={formFita.data_teste}
                  onChange={(e) =>
                    setFormFita({ ...formFita, data_teste: mascaraDataBr(e.target.value) })
                  }
                  placeholder="DD-MM-AAAA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-prod">Produto</Label>
                <Input
                  id="f-prod"
                  value={formFita.produto}
                  onChange={(e) => setFormFita({ ...formFita, produto: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-lote">Lote</Label>
                <Input
                  id="f-lote"
                  value={formFita.lote}
                  onChange={(e) => setFormFita({ ...formFita, lote: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-val">Validade da fita</Label>
                <Input
                  id="f-val"
                  value={formFita.validade}
                  onChange={(e) =>
                    setFormFita({ ...formFita, validade: mascaraDataBr(e.target.value) })
                  }
                  placeholder="DD-MM-AAAA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-valc">Validade do produto da cuba</Label>
                <Input
                  id="f-valc"
                  value={formFita.validade_produto_cuba}
                  onChange={(e) =>
                    setFormFita({
                      ...formFita,
                      validade_produto_cuba: mascaraDataBr(e.target.value),
                    })
                  }
                  placeholder="DD-MM-AAAA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-resp">Responsável</Label>
                <Input
                  id="f-resp"
                  value={formFita.responsavel}
                  onChange={(e) => setFormFita({ ...formFita, responsavel: e.target.value })}
                  placeholder={sessao?.nome ?? ""}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="f-obs">Observação</Label>
                <Textarea
                  id="f-obs"
                  value={formFita.observacao}
                  onChange={(e) => setFormFita({ ...formFita, observacao: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormFita(null)}>
              Cancelar
            </Button>
            <Button
              disabled={salvarFita.isPending}
              onClick={() => formFita && salvarFita.mutate(formFita)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Troca de cuba */}
      <Dialog open={!!formCuba} onOpenChange={(o) => !o && setFormCuba(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar troca de cuba</DialogTitle>
            <DialogDescription>
              Informe a solução usada e a data prevista para a próxima troca.
            </DialogDescription>
          </DialogHeader>
          {formCuba && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-data">Data da troca</Label>
                <Input
                  id="c-data"
                  value={formCuba.data_troca}
                  onChange={(e) =>
                    setFormCuba({ ...formCuba, data_troca: mascaraDataBr(e.target.value) })
                  }
                  placeholder="DD-MM-AAAA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-prox">Próxima troca</Label>
                <Input
                  id="c-prox"
                  value={formCuba.proxima_troca}
                  onChange={(e) =>
                    setFormCuba({ ...formCuba, proxima_troca: mascaraDataBr(e.target.value) })
                  }
                  placeholder="DD-MM-AAAA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-prod">Produto</Label>
                <Input
                  id="c-prod"
                  value={formCuba.produto}
                  onChange={(e) => setFormCuba({ ...formCuba, produto: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-lote">Lote</Label>
                <Input
                  id="c-lote"
                  value={formCuba.lote}
                  onChange={(e) => setFormCuba({ ...formCuba, lote: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-val">Validade Rioscope</Label>
                <Input
                  id="c-val"
                  value={formCuba.validade_rioscope}
                  onChange={(e) =>
                    setFormCuba({ ...formCuba, validade_rioscope: mascaraDataBr(e.target.value) })
                  }
                  placeholder="DD-MM-AAAA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-resp">Responsável</Label>
                <Input
                  id="c-resp"
                  value={formCuba.responsavel}
                  onChange={(e) => setFormCuba({ ...formCuba, responsavel: e.target.value })}
                  placeholder={sessao?.nome ?? ""}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormCuba(null)}>
              Cancelar
            </Button>
            <Button
              disabled={salvarCuba.isPending}
              onClick={() => formCuba && salvarCuba.mutate(formCuba)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
