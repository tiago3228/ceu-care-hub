import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, FileText, Pencil, Plus, Search, Trash2, Wrench } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { supabase } from "@/integrations/supabase/client";
import {
  salvarEquipamentoUs,
  excluirEquipamentoUs,
  revelarSenhaEquipamentoUs,
} from "@/lib/equipamentos-us.functions";
import { hojeIso } from "@/lib/datas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/equipamentos-us")({
  head: () => ({
    meta: [
      { title: "Aparelhos de US / Equipamentos | Clínica CEU" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaEquipamentosUs,
});

type Status = "operacional" | "atencao" | "manutencao_vencida" | "inativo";
type Equipamento = Record<string, any> & {
  id: number;
  nome: string;
  localizacao: string;
  modelo: string;
  voltagem: 110 | 220 | null;
  grava: boolean;
  patrimonio: string;
  serial: string;
  status: Status;
  proxima_manutencao: string | null;
  senha_cadastrada: boolean;
};
type Formulario = Record<string, any> & {
  id: number | null;
  nome: string;
  localizacao: string;
  modelo: string;
  patrimonio: string;
  serial: string;
  status: Status;
};
const STATUS: { id: Status; label: string; cor: string }[] = [
  { id: "operacional", label: "Operacional", cor: "bg-emerald-500" },
  { id: "atencao", label: "Atenção", cor: "bg-amber-500" },
  { id: "manutencao_vencida", label: "Manutenção vencida", cor: "bg-red-500" },
  { id: "inativo", label: "Inativo", cor: "bg-slate-500" },
];
const VAZIO: Formulario = {
  id: null,
  nome: "",
  localizacao: "",
  modelo: "",
  voltagem: null,
  grava: false,
  fabricante: "",
  ano_fabricacao: null,
  patrimonio: "",
  serial: "",
  numero_anvisa: "",
  versao_software: "",
  ip: "",
  porta: "",
  gateway: "",
  mascara: "",
  dns: "",
  mac: "",
  aetitle: "",
  worklist: "",
  storage_scp: "",
  storage_scu: "",
  servidor_dicom: "",
  porta_dicom: "",
  observacoes_dicom: "",
  usuario: "",
  senha: "",
  ultima_manutencao: null,
  proxima_manutencao: null,
  empresa_responsavel: "",
  contato_tecnico: "",
  telefone_tecnico: "",
  contrato_vigente: false,
  alerta_manutencao: true,
  dias_alerta_manutencao: 30,
  observacoes: "",
  status: "operacional",
};
function dataBr(data: string | null) {
  return data
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${data.slice(0, 10)}T12:00:00`))
    : "—";
}
function statusCalculado(e: Equipamento): Status {
  if (e.status === "inativo") return "inativo";
  if (e.proxima_manutencao && e.proxima_manutencao < hojeIso()) return "manutencao_vencida";
  if (
    e.proxima_manutencao &&
    e.proxima_manutencao <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  )
    return "atencao";
  return e.status ?? "operacional";
}
function baixar(nome: string, texto: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff", texto], { type: "text/csv;charset=utf-8" }));
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}

function PaginaEquipamentosUs() {
  const { temModulo, isAdmin, sessao, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [localFiltro, setLocalFiltro] = useState("todos");
  const [modeloFiltro, setModeloFiltro] = useState("todos");
  const [manutencaoFiltro, setManutencaoFiltro] = useState("todos");
  const [form, setForm] = useState<Formulario | null>(null);
  const [senha, setSenha] = useState<{ id: number; valor: string } | null>(null);
  const podeVer = isAdmin || temModulo("equipamentos_us");
  const podeAdicionar = isAdmin || temModulo("equipamentos_us_adicionar");
  const podeEditar = isAdmin || temModulo("equipamentos_us_editar");
  const podeExcluir = isAdmin || temModulo("equipamentos_us_excluir");
  const podeSenha = isAdmin || temModulo("equipamentos_us_visualizar_senhas");
  const equipamentos = useQuery({
    queryKey: ["equipamentos-us"],
    enabled: podeVer,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("equipamentos_us")
        .select(
          "id,nome,localizacao,modelo,voltagem,grava,fabricante,ano_fabricacao,patrimonio,serial,numero_anvisa,versao_software,ip,porta,gateway,mascara,dns,mac,aetitle,worklist,storage_scp,storage_scu,servidor_dicom,porta_dicom,observacoes_dicom,usuario,senha_cadastrada,ultima_manutencao,proxima_manutencao,empresa_responsavel,contato_tecnico,telefone_tecnico,contrato_vigente,alerta_manutencao,dias_alerta_manutencao,observacoes,status,criado_por,criado_em,atualizado_por,atualizado_em",
        )
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Equipamento[];
    },
  });
  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (equipamentos.data ?? []).filter((e) => {
      const status = statusCalculado(e);
      const texto = [
        e.nome,
        e.patrimonio,
        e.serial,
        e.modelo,
        e.voltagem,
        e.grava ? "grava" : "não grava",
        e.fabricante,
        e.localizacao,
        e.ip,
        e.aetitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const manutencao =
        manutencaoFiltro === "todos" ||
        (manutencaoFiltro === "com_ip"
          ? !!e.ip
          : manutencaoFiltro === "sem_ip"
            ? !e.ip
            : manutencaoFiltro === "vencida"
              ? status === "manutencao_vencida"
              : manutencaoFiltro === "proxima"
                ? status === "atencao"
                : true);
      return (
        (!termo || texto.includes(termo)) &&
        (localFiltro === "todos" || e.localizacao === localFiltro) &&
        (modeloFiltro === "todos" || e.modelo === modeloFiltro) &&
        manutencao
      );
    });
  }, [equipamentos.data, busca, localFiltro, modeloFiltro, manutencaoFiltro]);
  const salvar = useMutation({
    mutationFn: async (f: Formulario) => {
      const resultado = await salvarEquipamentoUs({ data: f });
      if (f.proxima_manutencao && f.alerta_manutencao && temModulo("lembretes_adicionar")) {
        const dataAlerta = new Date(`${f.proxima_manutencao}T12:00:00`);
        dataAlerta.setDate(dataAlerta.getDate() - Number(f.dias_alerta_manutencao || 30));
        await (supabase as any).from("lembretes").insert({
          user_id: sessao?.userId,
          criado_por: sessao?.userId,
          titulo: `Manutenção: ${f.nome}`,
          descricao: `Manutenção preventiva do equipamento ${f.patrimonio}.`,
          categoria: "manutencao",
          prioridade: "media",
          data_lembrete: dataAlerta.toISOString().slice(0, 10),
          status: "pendente",
          popup_ativo: true,
          som_ativo: false,
        });
      }
      return resultado;
    },
    onSuccess: () => {
      toast.success("Equipamento salvo.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["equipamentos-us"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const excluir = useMutation({
    mutationFn: (id: number) => excluirEquipamentoUs({ data: { id } }),
    onSuccess: () => {
      toast.success("Equipamento excluído.");
      queryClient.invalidateQueries({ queryKey: ["equipamentos-us"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  async function revelar(e: Equipamento, motivo: "revelar" | "copiar") {
    if (!podeSenha) return toast.error("Você não tem permissão para visualizar senhas.");
    try {
      const resultado = await revelarSenhaEquipamentoUs({ data: { id: e.id, motivo } });
      if (motivo === "copiar") {
        await navigator.clipboard.writeText(resultado.senha);
        toast.success("Senha copiada; ação auditada.");
      } else setSenha({ id: e.id, valor: resultado.senha });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  function exportar() {
    const cabecalho = [
      "Nome",
      "Localização",
      "Modelo",
      "Fabricante",
      "Patrimônio",
      "Serial",
      "IP",
      "AETitle",
      "Última manutenção",
      "Próxima manutenção",
      "Status",
    ];
    const linhas = lista.map((e) => [
      e.nome,
      e.localizacao,
      e.modelo,
      e.fabricante ?? "",
      e.patrimonio,
      e.serial,
      e.ip ?? "",
      e.aetitle ?? "",
      e.ultima_manutencao ?? "",
      e.proxima_manutencao ?? "",
      STATUS.find((s) => s.id === statusCalculado(e))?.label ?? "",
    ]);
    baixar(
      "equipamentos-us.csv",
      [cabecalho, ...linhas]
        .map((l) => l.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";"))
        .join("\n"),
    );
    toast.success(`${lista.length} equipamento(s) exportado(s).`);
  }
  function exportarXlsx() {
    const linhas = lista.map((e) => ({
      Nome: e.nome,
      Localização: e.localizacao,
      Modelo: e.modelo,
      Voltagem: e.voltagem ? `${e.voltagem}V` : "",
      Gravação: e.grava ? "Sim" : "Não",
      Fabricante: e.fabricante ?? "",
      Patrimônio: e.patrimonio,
      Serial: e.serial,
      IP: e.ip ?? "",
      AETitle: e.aetitle ?? "",
      "Última manutenção": e.ultima_manutencao ?? "",
      "Próxima manutenção": e.proxima_manutencao ?? "",
      Status: STATUS.find((s) => s.id === statusCalculado(e))?.label ?? "",
    }));
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(linhas), "Equipamentos US");
    XLSX.writeFile(livro, "equipamentos-us.xlsx");
    toast.success(`${lista.length} equipamento(s) exportado(s) em XLSX.`);
  }
  if (!carregandoSessao && !podeVer)
    return (
      <AppShell titulo="Aparelhos de US / Equipamentos">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso a este módulo.
        </div>
      </AppShell>
    );
  const locais = [...new Set((equipamentos.data ?? []).map((e) => e.localizacao))];
  const modelos = [...new Set((equipamentos.data ?? []).map((e) => e.modelo))];
  return (
    <AppShell
      titulo="Aparelhos de US / Equipamentos"
      descricao="Ficha técnica, rede, DICOM e manutenção"
      acoes={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportar}>
            <FileText className="mr-1.5 size-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportarXlsx}>
            XLSX
          </Button>
          {podeAdicionar && (
            <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
              <Plus className="mr-1.5 size-4" /> Novo equipamento
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card-superficie p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold">{(equipamentos.data ?? []).length}</p>
          </div>
          <div className="card-superficie p-4">
            <p className="text-xs text-emerald-600">Operacionais</p>
            <p className="text-2xl font-semibold">
              {(equipamentos.data ?? []).filter((e) => statusCalculado(e) === "operacional").length}
            </p>
          </div>
          <div className="card-superficie p-4">
            <p className="text-xs text-amber-600">Manutenção próxima</p>
            <p className="text-2xl font-semibold">
              {(equipamentos.data ?? []).filter((e) => statusCalculado(e) === "atencao").length}
            </p>
          </div>
          <div className="card-superficie p-4">
            <p className="text-xs text-red-600">Vencidas</p>
            <p className="text-2xl font-semibold">
              {
                (equipamentos.data ?? []).filter((e) => statusCalculado(e) === "manutencao_vencida")
                  .length
              }
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Nome, patrimônio, serial, IP, AETitle..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select value={localFiltro} onValueChange={setLocalFiltro}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Localização" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas localizações</SelectItem>
              {locais.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={modeloFiltro} onValueChange={setModeloFiltro}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos modelos</SelectItem>
              {modelos.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={manutencaoFiltro} onValueChange={setManutencaoFiltro}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Manutenção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas situações</SelectItem>
              <SelectItem value="vencida">Manutenção vencida</SelectItem>
              <SelectItem value="proxima">Manutenção próxima</SelectItem>
              <SelectItem value="com_ip">Com IP</SelectItem>
              <SelectItem value="sem_ip">Sem IP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {equipamentos.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="card-superficie overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3">Equipamento</th>
                  <th className="p-3">Voltagem</th>
                  <th className="p-3">Gravação</th>
                  <th className="p-3">Localização</th>
                  <th className="p-3">Modelo</th>
                  <th className="p-3">Patrimônio</th>
                  <th className="p-3">Serial</th>
                  <th className="p-3">IP</th>
                  <th className="p-3">Manutenção</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((e) => {
                  const st = statusCalculado(e);
                  const stInfo = STATUS.find((s) => s.id === st)!;
                  return (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">
                        {e.nome}
                        <div className="text-xs text-muted-foreground">{e.fabricante ?? ""}</div>
                      </td>
                      <td className="p-3 font-medium">{e.voltagem ? `${e.voltagem}V` : "—"}</td>
                      <td className="p-3">{e.grava ? "Sim" : "Não"}</td>
                      <td className="p-3">{e.localizacao}</td>
                      <td className="p-3">{e.modelo}</td>
                      <td className="p-3">{e.patrimonio}</td>
                      <td className="p-3">{e.serial}</td>
                      <td className="p-3">{e.ip ?? "—"}</td>
                      <td className="p-3">
                        <div>{dataBr(e.proxima_manutencao)}</div>
                        <div className="text-xs text-muted-foreground">
                          última: {dataBr(e.ultima_manutencao)}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">
                          <span
                            className={`mr-1.5 inline-block size-2 rounded-full ${stInfo.cor}`}
                          />
                          {stInfo.label}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {podeEditar && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar"
                              onClick={() => setForm({ ...e, senha: "" })}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          {podeSenha && e.senha_cadastrada && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Revelar senha"
                                onClick={() => revelar(e, "revelar")}
                              >
                                {senha?.id === e.id ? (
                                  <EyeOff className="size-4" />
                                ) : (
                                  <Eye className="size-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Copiar senha"
                                onClick={() => revelar(e, "copiar")}
                              >
                                <Copy className="size-4" />
                              </Button>
                            </>
                          )}
                          {podeExcluir && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Excluir"
                              onClick={() =>
                                confirm("Excluir este equipamento?") && excluir.mutate(e.id)
                              }
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                        {senha?.id === e.id && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Senha revelada: {senha.valor}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!lista.length && (
              <p className="p-6 text-sm text-muted-foreground">Nenhum equipamento encontrado.</p>
            )}
          </div>
        )}
        <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
          <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{form?.id ? "Editar equipamento" : "Novo equipamento"}</DialogTitle>
              <DialogDescription>
                Campos com * são obrigatórios. Senhas não são exibidas na listagem e são cifradas no
                servidor.
              </DialogDescription>
            </DialogHeader>
            {form && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Voltagem (110 ou 220)</Label>
                  <Select
                    value={form.voltagem ? String(form.voltagem) : ""}
                    onValueChange={(v) => setForm({ ...form, voltagem: Number(v) as 110 | 220 })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione 110 ou 220" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="110">110 V</SelectItem>
                      <SelectItem value="220">220 V</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 self-end pb-2">
                  <Switch
                    checked={form.grava}
                    onCheckedChange={(v) => setForm({ ...form, grava: v })}
                  />
                  <Label>Grava</Label>
                </div>
                <div className="space-y-1.5">
                  <Label>Nome do Equipamento *</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Localização *</Label>
                  <Input
                    value={form.localizacao}
                    onChange={(e) => setForm({ ...form, localizacao: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Modelo *</Label>
                  <Input
                    value={form.modelo}
                    onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fabricante</Label>
                  <Input
                    value={form.fabricante}
                    onChange={(e) => setForm({ ...form, fabricante: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Patrimônio *</Label>
                  <Input
                    value={form.patrimonio}
                    onChange={(e) => setForm({ ...form, patrimonio: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Serial *</Label>
                  <Input
                    value={form.serial}
                    onChange={(e) => setForm({ ...form, serial: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ano de fabricação</Label>
                  <Input
                    type="number"
                    value={form.ano_fabricacao ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        ano_fabricacao: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Número ANVISA</Label>
                  <Input
                    value={form.numero_anvisa}
                    onChange={(e) => setForm({ ...form, numero_anvisa: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Versão de software</Label>
                  <Input
                    value={form.versao_software}
                    onChange={(e) => setForm({ ...form, versao_software: e.target.value })}
                  />
                </div>
                <div className="col-span-full border-t pt-3 text-sm font-semibold">
                  Rede e DICOM
                </div>
                {(
                  [
                    "ip",
                    "porta",
                    "gateway",
                    "mascara",
                    "dns",
                    "mac",
                    "aetitle",
                    "worklist",
                    "storage_scp",
                    "storage_scu",
                    "servidor_dicom",
                    "porta_dicom",
                  ] as const
                ).map((campo) => (
                  <div key={campo} className="space-y-1.5">
                    <Label>
                      {campo.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())}
                    </Label>
                    <Input
                      value={form[campo] ?? ""}
                      onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                    />
                  </div>
                ))}
                <div className="space-y-1.5 sm:col-span-3">
                  <Label>Observações DICOM</Label>
                  <Textarea
                    value={form.observacoes_dicom}
                    onChange={(e) => setForm({ ...form, observacoes_dicom: e.target.value })}
                  />
                </div>
                <div className="col-span-full border-t pt-3 text-sm font-semibold">Credenciais</div>
                <div className="space-y-1.5">
                  <Label>Usuário</Label>
                  <Input
                    value={form.usuario}
                    onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Senha {form.id ? "(deixe vazia para manter)" : ""}</Label>
                  <Input
                    type="password"
                    value={form.senha}
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  />
                </div>
                <div className="col-span-full border-t pt-3 text-sm font-semibold">Manutenção</div>
                <div className="space-y-1.5">
                  <Label>Última manutenção</Label>
                  <Input
                    type="date"
                    value={form.ultima_manutencao ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, ultima_manutencao: e.target.value || null })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Próxima manutenção</Label>
                  <Input
                    type="date"
                    value={form.proxima_manutencao ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, proxima_manutencao: e.target.value || null })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Empresa responsável</Label>
                  <Input
                    value={form.empresa_responsavel}
                    onChange={(e) => setForm({ ...form, empresa_responsavel: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contato técnico</Label>
                  <Input
                    value={form.contato_tecnico}
                    onChange={(e) => setForm({ ...form, contato_tecnico: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone técnico</Label>
                  <Input
                    value={form.telefone_tecnico}
                    onChange={(e) => setForm({ ...form, telefone_tecnico: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Dias de alerta antes</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={form.dias_alerta_manutencao}
                    onChange={(e) =>
                      setForm({ ...form, dias_alerta_manutencao: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.contrato_vigente}
                    onCheckedChange={(v) => setForm({ ...form, contrato_vigente: v })}
                  />{" "}
                  Contrato vigente
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.alerta_manutencao}
                    onCheckedChange={(v) => setForm({ ...form, alerta_manutencao: v })}
                  />{" "}
                  Criar alerta
                </div>
                <div className="space-y-1.5 sm:col-span-3">
                  <Label>Observações</Label>
                  <Textarea
                    className="min-h-28"
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v as Status })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button disabled={salvar.isPending} onClick={() => form && salvar.mutate(form)}>
                Salvar equipamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
