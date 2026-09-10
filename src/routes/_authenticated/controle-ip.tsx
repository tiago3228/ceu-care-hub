import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Activity,
  Download,
  FileUp,
  Globe2,
  Plus,
  Search,
  Trash2,
  Pencil,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSessao } from "@/hooks/use-sessao";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/controle-ip")({ component: ControleIp });

type Categoria =
  | "impressoras"
  | "computadores"
  | "servidores"
  | "dvr"
  | "wifi"
  | "roteadores"
  | "tv_corporativas"
  | "switch"
  | "atl"
  | "relogio_ponto";
type Unidade = "MATRIZ" | "MN";
type Status = "online" | "offline" | "nao_verificado";
type Registro = {
  id: number;
  unidade: Unidade;
  categoria: Categoria;
  ip: string | null;
  nome: string;
  local: string | null;
  andar: string | null;
  setor: string | null;
  patrimonio: string | null;
  modelo: string | null;
  fabricante: string | null;
  mac_address: string | null;
  porta: string | null;
  observacoes: string | null;
  status_online: Status;
  ultima_verificacao: string | null;
};
type Formulario = Omit<Registro, "id" | "status_online" | "ultima_verificacao"> & { id?: number };

const CATEGORIAS: { id: Categoria; label: string; icon: string }[] = [
  { id: "impressoras", label: "Impressoras", icon: "🖨️" },
  { id: "computadores", label: "Computadores", icon: "💻" },
  { id: "servidores", label: "Servidores", icon: "🖥️" },
  { id: "dvr", label: "DVR", icon: "📹" },
  { id: "wifi", label: "Wi-Fi", icon: "📡" },
  { id: "roteadores", label: "Roteadores", icon: "🌐" },
  { id: "tv_corporativas", label: "TV Corporativas", icon: "📺" },
  { id: "switch", label: "Switch", icon: "🔀" },
  { id: "atl", label: "ATL", icon: "☎️" },
  { id: "relogio_ponto", label: "Relógio de Ponto", icon: "⏰" },
];
const TODOS = "todos";
const VAZIO: Formulario = {
  unidade: "MATRIZ",
  categoria: "impressoras",
  ip: null,
  nome: "",
  local: null,
  andar: null,
  setor: null,
  patrimonio: null,
  modelo: null,
  fabricante: null,
  mac_address: null,
  porta: null,
  observacoes: null,
};
const cliente = supabase as any;

function unidadePorIp(ip: string | null): Unidade | null {
  if (!ip) return null;
  const partes = ip.trim().split(".");
  if (partes.length !== 4 || partes[0] !== "192") return null;
  if (partes[1] === "0") return "MATRIZ";
  if (partes[1] === "1") return "MN";
  return null;
}
function validarIp(ip: string | null) {
  if (!ip) return true;
  const unidade = unidadePorIp(ip);
  return (
    !!unidade && ip.split(".").every((n) => /^\d+$/.test(n) && Number(n) >= 0 && Number(n) <= 255)
  );
}
function statusLabel(status: Status) {
  return status === "online" ? "Online" : status === "offline" ? "Offline" : "Não verificado";
}
function statusClass(status: Status) {
  return status === "online"
    ? "bg-emerald-100 text-emerald-800"
    : status === "offline"
      ? "bg-red-100 text-red-800"
      : "bg-slate-100 text-slate-600";
}
function formatarData(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}
function baixar(nome: string, conteudo: Blob) {
  const url = URL.createObjectURL(conteudo);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function ControleIp() {
  const { sessao, isAdmin, temModulo, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<string>(CATEGORIAS[0].id);
  const [unidade, setUnidade] = useState<Unidade | typeof TODOS>(TODOS);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<Formulario | null>(null);
  const [excluir, setExcluir] = useState<Registro | null>(null);
  const [arquivo, setArquivo] = useState<HTMLInputElement | null>(null);
  const podeAdicionar = isAdmin || temModulo("controle_ip_adicionar");
  const podeEditar = isAdmin || temModulo("controle_ip_editar");
  const podeExcluir = isAdmin || temModulo("controle_ip_excluir");

  const registros = useQuery({
    queryKey: ["controle-ip"],
    queryFn: async () => {
      const { data, error } = await cliente
        .from("controle_ip")
        .select("*")
        .order("unidade")
        .order("categoria")
        .order("ip");
      if (error) throw error;
      return (data ?? []) as Registro[];
    },
  });
  const todos = registros.data ?? [];
  const filtrados = useMemo(
    () =>
      todos.filter((r) => {
        const texto = [r.ip, r.nome, r.local, r.setor, r.patrimonio, r.modelo, r.observacoes]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          (aba === "todos" || r.categoria === aba) &&
          (unidade === TODOS || r.unidade === unidade) &&
          (!busca.trim() || texto.includes(busca.toLowerCase().trim()))
        );
      }),
    [todos, aba, unidade, busca],
  );
  const livres = useMemo(() => {
    const usados = new Set(todos.map((r) => r.ip).filter(Boolean));
    const faixa = unidade === "MN" ? "1" : "0";
    return Array.from({ length: 254 }, (_, i) => `192.168.${faixa}.${i + 1}`).filter(
      (ip) => !usados.has(ip),
    );
  }, [todos, unidade]);

  const salvar = useMutation({
    mutationFn: async (f: Formulario) => {
      const ip = f.ip?.trim() || null;
      if (ip && !validarIp(ip))
        throw new Error("Use um IP válido das faixas 192.168.0.x (MATRIZ) ou 192.168.1.x (MN).");
      if (!f.nome.trim()) throw new Error("Informe o nome do equipamento.");
      const detectada = unidadePorIp(ip);
      const payload = {
        unidade: detectada ?? f.unidade,
        categoria: f.categoria,
        ip,
        nome: f.nome.trim(),
        local: f.local?.trim() || null,
        andar: f.andar?.trim() || null,
        setor: f.setor?.trim() || null,
        patrimonio: f.patrimonio?.trim() || null,
        modelo: f.modelo?.trim() || null,
        fabricante: f.fabricante?.trim() || null,
        mac_address: f.mac_address?.trim() || null,
        porta: f.porta?.trim() || null,
        observacoes: f.observacoes?.trim() || null,
      };
      const query = f.id
        ? cliente.from("controle_ip").update(payload).eq("id", f.id)
        : cliente.from("controle_ip").insert(payload);
      const { error } = await query;
      if (error)
        throw new Error(
          error.message.includes("duplicate") ? "Este IP já está cadastrado." : error.message,
        );
    },
    onSuccess: () => {
      toast.success("Equipamento salvo.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["controle-ip"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const remover = useMutation({
    mutationFn: async (r: Registro) => {
      const { error } = await cliente.from("controle_ip").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído.");
      setExcluir(null);
      queryClient.invalidateQueries({ queryKey: ["controle-ip"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const verificar = useMutation({
    mutationFn: async (r: Registro) => {
      if (!r.ip) throw new Error("Este equipamento não possui IP.");
      const inicio = Date.now();
      let status: Status = "offline";
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 2500);
        await fetch(`http://${r.ip}`, { mode: "no-cors", signal: controller.signal });
        window.clearTimeout(timer);
        status = "online";
      } catch {
        status = "offline";
      }
      const { error } = await cliente
        .from("controle_ip")
        .update({ status_online: status, ultima_verificacao: new Date().toISOString() })
        .eq("id", r.id);
      if (error) throw error;
      return { status, ms: Date.now() - inicio };
    },
    onSuccess: (r) => {
      toast.success(`${r.status === "online" ? "Online" : "Offline"} (${r.ms} ms)`);
      queryClient.invalidateQueries({ queryKey: ["controle-ip"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function exportar() {
    const dados = filtrados.map((r) => ({
      Unidade: r.unidade,
      Categoria: CATEGORIAS.find((c) => c.id === r.categoria)?.label,
      IP: r.ip ?? "",
      Nome: r.nome,
      Local: r.local ?? "",
      Andar: r.andar ?? "",
      Setor: r.setor ?? "",
      Patrimônio: r.patrimonio ?? "",
      Modelo: r.modelo ?? "",
      Fabricante: r.fabricante ?? "",
      MAC: r.mac_address ?? "",
      Porta: r.porta ?? "",
      Status: statusLabel(r.status_online),
      Observações: r.observacoes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Controle IP");
    baixar(
      "controle-ip.xlsx",
      new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], {
        type: "application/octet-stream",
      }),
    );
    toast.success(`${dados.length} registro(s) exportado(s).`);
  }
  async function importar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[workbook.SheetNames[0]],
      );
      let total = 0;
      for (const row of rows) {
        const ip = String(row.IP ?? row.ip ?? "").trim() || null;
        const cat = String(row.Categoria ?? row.categoria ?? aba)
          .toLowerCase()
          .replaceAll(" ", "_") as Categoria;
        const nome = String(row.Nome ?? row.nome ?? row.Equipamento ?? "").trim();
        if (!nome || (ip && !validarIp(ip))) continue;
        const detected = unidadePorIp(ip);
        const unidadePlanilha = String(row.Unidade ?? "").toUpperCase();
        const payload = {
          unidade:
            detected ??
            ((unidadePlanilha === "MN" || unidadePlanilha === "MEDICINA NUCLEAR"
              ? "MN"
              : unidadePlanilha === "MATRIZ"
                ? "MATRIZ"
                : unidade === "MN"
                  ? "MN"
                  : "MATRIZ") as Unidade),
          categoria: CATEGORIAS.some((c) => c.id === cat) ? cat : (aba as Categoria),
          ip,
          nome,
          local: String(row.Local ?? "") || null,
          andar: String(row.Andar ?? "") || null,
          setor: String(row.Setor ?? "") || null,
          patrimonio: String(row.Patrimônio ?? row.Patrimonio ?? "") || null,
          modelo: String(row.Modelo ?? "") || null,
          fabricante: String(row.Fabricante ?? "") || null,
          mac_address: String(row.MAC ?? row.mac_address ?? "") || null,
          porta: String(row.Porta ?? "") || null,
          observacoes: String(row.Observações ?? row.Observacoes ?? "") || null,
        };
        const { error } = await cliente.from("controle_ip").upsert(payload, { onConflict: "ip" });
        if (!error) total++;
      }
      toast.success(`${total} registro(s) importado(s). Registros inválidos foram ignorados.`);
      queryClient.invalidateQueries({ queryKey: ["controle-ip"] });
    } catch (e) {
      toast.error(`Falha na importação: ${(e as Error).message}`);
    }
    event.target.value = "";
  }

  if (!carregandoSessao && !temModulo("controle_ip"))
    return (
      <AppShell titulo="Controle de IP">
        <div className="card-superficie max-w-lg p-6 text-sm">
          Você não tem acesso ao Controle de IP.
        </div>
      </AppShell>
    );
  const tituloAba =
    aba === "todos" ? "Todos os equipamentos" : CATEGORIAS.find((c) => c.id === aba)?.label;
  return (
    <AppShell
      titulo="Controle de IP"
      descricao="Inventário de rede, disponibilidade e auditoria"
      acoes={
        <div className="flex gap-2">
          <input
            ref={(el) => setArquivo(el)}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={importar}
          />
          {podeAdicionar && (
            <Button variant="outline" size="sm" onClick={() => arquivo?.click()}>
              <FileUp className="mr-1.5 size-4" />
              Importar
            </Button>
          )}
          <Button size="sm" onClick={exportar}>
            <Download className="mr-1.5 size-4" />
            Exportar
          </Button>
          {podeAdicionar && (
            <Button
              size="sm"
              onClick={() =>
                setForm({
                  ...VAZIO,
                  categoria: CATEGORIAS.some((c) => c.id === aba)
                    ? (aba as Categoria)
                    : "impressoras",
                })
              }
            >
              <Plus className="mr-1.5 size-4" />
              Adicionar
            </Button>
          )}
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card-superficie p-3">
          <p className="text-xs uppercase text-muted-foreground">Total</p>
          <p className="mt-1 text-xl font-semibold">{todos.length}</p>
        </div>
        <div className="card-superficie p-3">
          <p className="text-xs uppercase text-muted-foreground">Online</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">
            {todos.filter((r) => r.status_online === "online").length}
          </p>
        </div>
        <div className="card-superficie p-3">
          <p className="text-xs uppercase text-muted-foreground">Offline</p>
          <p className="mt-1 text-xl font-semibold text-red-700">
            {todos.filter((r) => r.status_online === "offline").length}
          </p>
        </div>
        <div className="card-superficie p-3">
          <p className="text-xs uppercase text-muted-foreground">
            IPs livres ({unidade === TODOS ? "Matriz" : unidade})
          </p>
          <p className="mt-1 text-xl font-semibold">{livres.length}</p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por IP, nome, local, setor, patrimônio..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={unidade} onValueChange={(v) => setUnidade(v as typeof unidade)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as unidades</SelectItem>
            <SelectItem value="MATRIZ">MATRIZ · 192.168.0.x</SelectItem>
            <SelectItem value="MN">MN · 192.168.1.x</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          {CATEGORIAS.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.icon} {c.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="livres">IPs livres</TabsTrigger>
        </TabsList>
        <TabsContent value="livres">
          <div className="card-superficie overflow-hidden">
            <div className="border-b border-border p-4">
              <h2 className="font-semibold">
                IPs livres de {unidade === "MN" ? "MEDICINA NUCLEAR" : "MATRIZ"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Faixa 192.168.{unidade === "MN" ? "1" : "0"}.1 até .254 · {livres.length}{" "}
                disponíveis
              </p>
            </div>
            <div className="grid max-h-[460px] grid-cols-2 gap-2 overflow-auto p-4 sm:grid-cols-4 lg:grid-cols-8">
              {livres.map((ip) => (
                <button
                  key={ip}
                  type="button"
                  className="rounded border border-border px-2 py-2 text-left text-sm hover:border-primary hover:bg-primary/5"
                  onClick={() =>
                    podeAdicionar &&
                    setForm({
                      ...VAZIO,
                      ip,
                      nome: `Reserva de IP ${ip}`,
                      unidade: unidade === TODOS ? "MATRIZ" : unidade,
                    })
                  }
                >
                  <span className="mr-1 inline-block size-2 rounded-full bg-slate-300" />
                  {ip}
                  {podeAdicionar && <span className="ml-1 text-xs text-primary">Reservar</span>}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>
        <TabsContent value={aba === "livres" ? "__none" : aba}>
          <div className="card-superficie overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h2 className="font-semibold">{tituloAba}</h2>
                <p className="text-sm text-muted-foreground">
                  {filtrados.length} registro(s) encontrado(s)
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => registros.refetch()}>
                <RefreshCw className="mr-1.5 size-4" />
                Atualizar
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3">Equipamento</th>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3">Local / Setor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono">
                        {r.ip ?? <span className="text-muted-foreground">sem IP</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {[r.fabricante, r.modelo, r.patrimonio].filter(Boolean).join(" · ") ||
                            "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{r.unidade}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {[r.local, r.setor, r.andar].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${statusClass(r.status_online)}`}
                        >
                          {r.status_online === "online" ? (
                            <Wifi className="size-3" />
                          ) : r.status_online === "offline" ? (
                            <WifiOff className="size-3" />
                          ) : (
                            <Activity className="size-3" />
                          )}
                          {statusLabel(r.status_online)}
                        </span>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {formatarData(r.ultima_verificacao)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {r.ip && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Verificar disponibilidade"
                              onClick={() => verificar.mutate(r)}
                              disabled={verificar.isPending}
                            >
                              <Globe2 className="size-4" />
                            </Button>
                          )}
                          {podeEditar && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar"
                              onClick={() => setForm({ ...r })}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          {podeExcluir && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Excluir"
                              onClick={() => setExcluir(r)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filtrados.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        Nenhum equipamento encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <p className="mt-4 text-xs text-muted-foreground">
        A unidade é identificada automaticamente pelo IP: 192.168.0.x = MATRIZ e 192.168.1.x =
        MEDICINA NUCLEAR. Todas as inclusões, edições, exclusões e verificações ficam no histórico
        de auditoria.
      </p>
      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar equipamento" : "Novo equipamento"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                salvar.mutate(form);
              }}
            >
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nome / identificação *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>IP</Label>
                <Input
                  value={form.ip ?? ""}
                  placeholder="192.168.0.10"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ip: e.target.value || null,
                      unidade: unidadePorIp(e.target.value) ?? form.unidade,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade (automática pelo IP)</Label>
                <Select
                  value={form.unidade}
                  onValueChange={(v) => setForm({ ...form, unidade: v as Unidade })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MATRIZ">MATRIZ</SelectItem>
                    <SelectItem value="MN">MEDICINA NUCLEAR (MN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(v) => setForm({ ...form, categoria: v as Categoria })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Local</Label>
                <Input
                  value={form.local ?? ""}
                  onChange={(e) => setForm({ ...form, local: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Andar</Label>
                <Input
                  value={form.andar ?? ""}
                  onChange={(e) => setForm({ ...form, andar: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <Input
                  value={form.setor ?? ""}
                  onChange={(e) => setForm({ ...form, setor: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Patrimônio</Label>
                <Input
                  value={form.patrimonio ?? ""}
                  onChange={(e) => setForm({ ...form, patrimonio: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo</Label>
                <Input
                  value={form.modelo ?? ""}
                  onChange={(e) => setForm({ ...form, modelo: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fabricante</Label>
                <Input
                  value={form.fabricante ?? ""}
                  onChange={(e) => setForm({ ...form, fabricante: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>MAC address</Label>
                <Input
                  value={form.mac_address ?? ""}
                  onChange={(e) => setForm({ ...form, mac_address: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Porta</Label>
                <Input
                  value={form.porta ?? ""}
                  onChange={(e) => setForm({ ...form, porta: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.observacoes ?? ""}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value || null })}
                />
              </div>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvar.isPending}>
                  {salvar.isPending ? "Salvando..." : "Salvar equipamento"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!excluir} onOpenChange={(open) => !open && setExcluir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir equipamento?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O registro de <strong>{excluir?.nome}</strong> será removido, mas a auditoria
            permanecerá.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setExcluir(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => excluir && remover.mutate(excluir)}
              disabled={remover.isPending}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
