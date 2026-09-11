import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { FileText, Pencil, Plus, Search, Trash2, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/hooks/use-sessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  salvarOcorrenciaSonda,
  salvarSonda,
  excluirSonda,
} from "@/lib/sondas-inventario.functions";

const TIPOS = [
  "Convexa",
  "Linear",
  "Endocavitária",
  "Cardíaca",
  "Microconvexa",
  "Volumétrica",
  "Pediátrica",
  "Transesofágica",
  "Intraoperatória",
  "Outro",
];
const STATUS = [
  { id: "em_uso", label: "Em uso" },
  { id: "reserva", label: "Reserva" },
  { id: "manutencao", label: "Em manutenção" },
  { id: "inativa", label: "Inativa" },
  { id: "baixada", label: "Baixada" },
];
type Sonda = Record<string, any> & {
  id: number;
  nome: string;
  modelo: string;
  tipo: string;
  serial: string;
  localizacao: string;
  status: string;
  equipamento_ids?: number[];
};
type Form = Record<string, any> & {
  id: number | null;
  nome: string;
  modelo: string;
  fabricante: string;
  tipo: string;
  serial: string;
  patrimonio: string;
  localizacao: string;
  sala: string;
  setor: string;
  status: string;
  equipamento_ids: number[];
};
const VAZIO: Form = {
  id: null,
  nome: "",
  modelo: "",
  fabricante: "",
  tipo: "",
  serial: "",
  patrimonio: "",
  ano_fabricacao: null,
  frequencia: "",
  numero_anvisa: "",
  localizacao: "",
  sala: "",
  setor: "",
  data_aquisicao: null,
  garantia: "",
  status: "em_uso",
  ultima_manutencao: null,
  proxima_manutencao: null,
  empresa_responsavel: "",
  contato_tecnico: "",
  telefone_tecnico: "",
  observacoes_manutencao: "",
  observacoes: "",
  equipamento_ids: [],
};
function csv(rows: any[], name: string) {
  const keys = Object.keys(rows[0] ?? {});
  const body = [keys, ...rows.map((r) => keys.map((k) => String(r[k] ?? "").replaceAll('"', '""')))]
    .map((r) => r.map((v) => `"${v}"`).join(";"))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff", body], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
}
function labelStatus(v: string) {
  return STATUS.find((s) => s.id === v)?.label ?? v;
}

export function SondasInventario() {
  const { sessao, isAdmin, temModulo } = useSessao();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [form, setForm] = useState<Form | null>(null);
  const [ocorrencia, setOcorrencia] = useState<{
    sonda_id: number;
    tipo: string;
    descricao: string;
    data: string;
  } | null>(null);
  const podeAdicionar = isAdmin || temModulo("sondas_adicionar");
  const podeEditar = isAdmin || temModulo("sondas_editar");
  const podeExcluir = isAdmin || temModulo("sondas_excluir");
  const podeManutencao = isAdmin || temModulo("sondas_manutencao");
  const sondas = useQuery({
    queryKey: ["sondas-inventario"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sondas")
        .select("*,sondas_equipamentos(equipamento_id)")
        .order("nome");
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        ...s,
        equipamento_ids: (s.sondas_equipamentos ?? []).map((x: any) => x.equipamento_id),
      })) as Sonda[];
    },
  });
  const equipamentos = useQuery({
    queryKey: ["equipamentos-us"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("equipamentos_us")
        .select("id,nome,modelo,localizacao")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const lista = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return (sondas.data ?? []).filter(
      (s) =>
        (!q ||
          [
            s.nome,
            s.modelo,
            s.fabricante,
            s.tipo,
            s.serial,
            s.patrimonio,
            s.localizacao,
            s.sala,
            s.setor,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
        (tipo === "todos" || s.tipo === tipo) &&
        (status === "todos" || s.status === status),
    );
  }, [sondas.data, busca, tipo, status]);
  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      if (!f.equipamento_ids.length) throw new Error("Vincule pelo menos um aparelho compatível.");
      const result = await salvarSonda({ data: f });
      if (f.proxima_manutencao && temModulo("lembretes_adicionar")) {
        const data = new Date(`${f.proxima_manutencao}T12:00:00`);
        data.setDate(data.getDate() - 30);
        await (supabase as any).from("lembretes").insert({
          user_id: sessao?.userId,
          criado_por: sessao?.userId,
          titulo: `Manutenção da sonda: ${f.nome}`,
          descricao: `Manutenção preventiva da sonda ${f.serial}.`,
          categoria: "manutencao",
          prioridade: "media",
          data_lembrete: data.toISOString().slice(0, 10),
          status: "pendente",
          popup_ativo: true,
          som_ativo: false,
        });
      }
      return result;
    },
    onSuccess: () => {
      toast.success("Sonda salva.");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["sondas-inventario"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remover = useMutation({
    mutationFn: (id: number) => excluirSonda({ data: { id } }),
    onSuccess: () => {
      toast.success("Sonda excluída.");
      qc.invalidateQueries({ queryKey: ["sondas-inventario"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const registrar = useMutation({
    mutationFn: (x: NonNullable<typeof ocorrencia>) => salvarOcorrenciaSonda({ data: x }),
    onSuccess: () => {
      toast.success("Ocorrência registrada.");
      setOcorrencia(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = lista.map((s) => ({
    Nome: s.nome,
    Modelo: s.modelo,
    Tipo: s.tipo,
    Fabricante: s.fabricante,
    Serial: s.serial,
    Patrimônio: s.patrimonio,
    Localização: s.localizacao,
    Sala: s.sala,
    Status: labelStatus(s.status),
    "Próxima manutenção": s.proxima_manutencao ?? "",
  }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Nome, modelo, serial, patrimônio, sala..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => csv(rows, "sondas.csv")}>
          <FileText className="mr-1.5 size-4" /> CSV
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Sondas");
            XLSX.writeFile(wb, "sondas.xlsx");
          }}
        >
          XLSX
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          PDF
        </Button>
        {podeAdicionar && (
          <Button onClick={() => setForm({ ...VAZIO })}>
            <Plus className="mr-1.5 size-4" /> Nova Sonda
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card-superficie p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-semibold">{sondas.data?.length ?? 0}</p>
        </div>
        {STATUS.slice(0, 3).map((st) => (
          <div className="card-superficie p-4" key={st.id}>
            <p className="text-xs text-muted-foreground">{st.label}</p>
            <p className="text-2xl font-semibold">
              {(sondas.data ?? []).filter((s) => s.status === st.id).length}
            </p>
          </div>
        ))}
      </div>
      <div className="card-superficie overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-3">Sonda</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Serial</th>
              <th className="p-3">Patrimônio</th>
              <th className="p-3">Localização</th>
              <th className="p-3">Compatível com</th>
              <th className="p-3">Status</th>
              <th className="p-3">Manutenção</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((s) => (
              <tr className="border-b last:border-0" key={s.id}>
                <td className="p-3 font-medium">
                  {s.nome}
                  <div className="text-xs text-muted-foreground">
                    {s.modelo} · {s.fabricante || "fabricante não informado"}
                  </div>
                </td>
                <td className="p-3">{s.tipo}</td>
                <td className="p-3">{s.serial}</td>
                <td className="p-3">{s.patrimonio || "—"}</td>
                <td className="p-3">
                  {s.localizacao}
                  {s.sala ? ` · ${s.sala}` : ""}
                </td>
                <td className="p-3">{(s.equipamento_ids ?? []).length}</td>
                <td className="p-3">
                  <Badge variant={s.status === "manutencao" ? "destructive" : "outline"}>
                    {labelStatus(s.status)}
                  </Badge>
                </td>
                <td className="p-3">{s.proxima_manutencao || "—"}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {podeEditar && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => setForm({ ...VAZIO, ...s })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {podeManutencao && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Registrar ocorrência"
                        onClick={() =>
                          setOcorrencia({
                            sonda_id: s.id,
                            tipo: "Manutenção preventiva",
                            descricao: "",
                            data: new Date().toISOString().slice(0, 10),
                          })
                        }
                      >
                        <Wrench className="size-4" />
                      </Button>
                    )}
                    {podeExcluir && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir"
                        onClick={() => confirm("Excluir esta sonda?") && remover.mutate(s.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!lista.length && (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma sonda encontrada.</p>
        )}
      </div>
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar sonda" : "Nova sonda"}</DialogTitle>
            <DialogDescription>
              Ficha técnica, localização, manutenção e aparelhos compatíveis.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["nome", "Nome da Sonda *"],
                  ["modelo", "Modelo *"],
                  ["fabricante", "Fabricante"],
                  ["serial", "Serial *"],
                  ["patrimonio", "Patrimônio"],
                  ["ano_fabricacao", "Ano de Fabricação"],
                  ["frequencia", "Frequência"],
                  ["numero_anvisa", "Número ANVISA"],
                  ["localizacao", "Localização *"],
                  ["sala", "Sala"],
                  ["setor", "Setor"],
                  ["data_aquisicao", "Data de Aquisição"],
                  ["garantia", "Garantia"],
                  ["ultima_manutencao", "Última Manutenção"],
                  ["proxima_manutencao", "Próxima Manutenção"],
                  ["empresa_responsavel", "Empresa Responsável"],
                  ["contato_tecnico", "Contato Técnico"],
                  ["telefone_tecnico", "Telefone"],
                ] as [string, string][]
              ).map(([key, label]) => (
                <div className="space-y-1.5" key={key}>
                  <Label>{label}</Label>
                  <Input
                    type={
                      key === "ano_fabricacao"
                        ? "number"
                        : key.includes("data") || key.includes("manutencao")
                          ? "date"
                          : "text"
                    }
                    value={form[key] ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [key]:
                          key === "ano_fabricacao"
                            ? e.target.value
                              ? Number(e.target.value)
                              : null
                            : e.target.value,
                      })
                    }
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label>Tipo da Sonda *</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
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
              <div className="space-y-1.5 sm:col-span-3">
                <Label>Aparelhos Compatíveis *</Label>
                <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                  {(equipamentos.data ?? []).map((e: any) => (
                    <label className="flex items-center gap-2 text-sm" key={e.id}>
                      <Checkbox
                        checked={form.equipamento_ids.includes(e.id)}
                        onCheckedChange={(checked) =>
                          setForm({
                            ...form,
                            equipamento_ids: checked
                              ? [...form.equipamento_ids, e.id]
                              : form.equipamento_ids.filter((id) => id !== e.id),
                          })
                        }
                      />
                      {e.nome} <span className="text-muted-foreground">({e.modelo})</span>
                    </label>
                  ))}
                  {!equipamentos.data?.length && (
                    <span className="text-sm text-muted-foreground">
                      Cadastre primeiro um aparelho de US.
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label>Observações da Manutenção</Label>
                <Textarea
                  value={form.observacoes_manutencao ?? ""}
                  onChange={(e) => setForm({ ...form, observacoes_manutencao: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label>Observações</Label>
                <Textarea
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
              Salvar Sonda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!ocorrencia} onOpenChange={(v) => !v && setOcorrencia(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar ocorrência</DialogTitle>
            <DialogDescription>
              O registro ficará associado ao histórico técnico da sonda.
            </DialogDescription>
          </DialogHeader>
          {ocorrencia && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={ocorrencia.data}
                  onChange={(e) => setOcorrencia({ ...ocorrencia, data: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={ocorrencia.tipo}
                  onValueChange={(v) => setOcorrencia({ ...ocorrencia, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Queda",
                      "Defeito",
                      "Troca de cabo",
                      "Troca de cristal",
                      "Troca de conector",
                      "Manutenção preventiva",
                      "Manutenção corretiva",
                      "Outro",
                    ].map((x) => (
                      <SelectItem key={x} value={x}>
                        {x}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  value={ocorrencia.descricao}
                  onChange={(e) => setOcorrencia({ ...ocorrencia, descricao: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOcorrencia(null)}>
              Cancelar
            </Button>
            <Button
              disabled={registrar.isPending}
              onClick={() => ocorrencia && registrar.mutate(ocorrencia)}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
