import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Copy,
  Monitor,
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
import { obterMonitoramentoAtual } from "@/lib/monitoramento-ip";

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
  | "relogio_ponto"
  | "ultrasson"
  | "ips_formatacao";
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
  usuario_responsavel: string | null;
  anydesk: string | null;
  patrimonio_cpu: string | null;
  patrimonio_monitor: string | null;
  sistema_operacional: string | null;
  observacoes: string | null;
  status_online: Status;
  ultima_verificacao: string | null;
  tempo_resposta_ms: number | null;
  metodo_monitoramento: string;
  erro_monitoramento: string | null;
  historico_status: Array<Record<string, unknown>>;
  rede_wifi: string | null;
  senha_wifi: string | null;
  ae_title: string | null;
  worklist: string | null;
};
type Formulario = Omit<Registro, "id" | "status_online" | "ultima_verificacao"> & { id?: number };
type ImportacaoPendente = {
  linha: number;
  payload: Record<string, unknown> | null;
  acao: "inserir" | "atualizar" | "ignorar";
  detalhe: string;
};

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
  { id: "ultrasson", label: "Ultrassom/Outros", icon: "🔊" },
  { id: "ips_formatacao", label: "IPs Formatação", icon: "🧹" },
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
  usuario_responsavel: null,
  anydesk: null,
  patrimonio_cpu: null,
  patrimonio_monitor: null,
  sistema_operacional: null,
  observacoes: null,
  tempo_resposta_ms: null,
  metodo_monitoramento: "http_browser",
  erro_monitoramento: null,
  historico_status: [],
  rede_wifi: null,
  senha_wifi: null,
  ae_title: null,
  worklist: null,
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
  const [historicoId, setHistoricoId] = useState<number | null>(null);
  const [senhasWifiVisiveis, setSenhasWifiVisiveis] = useState(false);
  const [importacaoPendente, setImportacaoPendente] = useState<ImportacaoPendente[] | null>(null);
  const [arquivo, setArquivo] = useState<HTMLInputElement | null>(null);
  const podeAdicionar = isAdmin || temModulo("controle_ip_adicionar");
  const podeEditar = isAdmin || temModulo("controle_ip_editar");
  const podeExcluir = isAdmin || temModulo("controle_ip_excluir");
  const podeVisualizarSenhaWifi = isAdmin || temModulo("controle_ip_wifi_senha_visualizar");
  const historico = useQuery({
    queryKey: ["controle-ip-historico", historicoId],
    enabled: historicoId !== null,
    queryFn: async () => {
      const { data, error } = await cliente
        .from("controle_ip_historico_status")
        .select("*")
        .eq("controle_ip_id", historicoId)
        .order("verificado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const registros = useQuery({
    queryKey: ["controle-ip", podeVisualizarSenhaWifi],
    queryFn: async () => {
      const { data, error } = await cliente
        .from("controle_ip")
        .select(
          podeVisualizarSenhaWifi
            ? "*"
            : "id,unidade,categoria,ip,nome,local,andar,setor,patrimonio,modelo,fabricante,mac_address,porta,usuario_responsavel,anydesk,patrimonio_cpu,patrimonio_monitor,sistema_operacional,observacoes,status_online,ultima_verificacao,tempo_resposta_ms,metodo_monitoramento,erro_monitoramento,historico_status,rede_wifi,ae_title,worklist",
        )
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
        const texto = [
          r.ip,
          r.nome,
          r.local,
          r.setor,
          r.patrimonio,
          r.patrimonio_cpu,
          r.patrimonio_monitor,
          r.usuario_responsavel,
          r.anydesk,
          r.ae_title,
          r.worklist,
          r.modelo,
          r.observacoes,
        ]
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
  const resumoCategorias = useMemo(
    () =>
      CATEGORIAS.map((categoria) => ({
        ...categoria,
        total: todos.filter((registro) => registro.categoria === categoria.id).length,
      })),
    [todos],
  );
  const resumoUnidades = useMemo(
    () => [
      {
        unidade: "MATRIZ" as Unidade,
        total: todos.filter((registro) => registro.unidade === "MATRIZ").length,
        faixa: "192.168.0.x",
      },
      {
        unidade: "MN" as Unidade,
        total: todos.filter((registro) => registro.unidade === "MN").length,
        faixa: "192.168.1.x",
      },
    ],
    [todos],
  );
  const livresMatriz = useMemo(
    () =>
      Array.from({ length: 254 }, (_, i) => `192.168.0.${i + 1}`).filter(
        (ip) => !todos.some((registro) => registro.ip === ip),
      ),
    [todos],
  );
  const livresMn = useMemo(
    () =>
      Array.from({ length: 254 }, (_, i) => `192.168.1.${i + 1}`).filter(
        (ip) => !todos.some((registro) => registro.ip === ip),
      ),
    [todos],
  );

  const salvar = useMutation({
    mutationFn: async (f: Formulario) => {
      const ip = f.ip?.trim() || null;
      if (ip && !validarIp(ip))
        throw new Error("Use um IP válido das faixas 192.168.0.x (MATRIZ) ou 192.168.1.x (MN).");
      if (!f.nome.trim()) throw new Error("Informe o nome do equipamento.");
      if (f.categoria === "computadores" && !f.local?.trim() && !f.setor?.trim())
        throw new Error("Informe o Local/Setor do computador.");
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
        usuario_responsavel:
          f.categoria === "computadores" ? f.usuario_responsavel?.trim() || null : null,
        anydesk: f.categoria === "computadores" ? f.anydesk?.trim() || null : null,
        patrimonio_cpu: f.categoria === "computadores" ? f.patrimonio_cpu?.trim() || null : null,
        patrimonio_monitor:
          f.categoria === "computadores" ? f.patrimonio_monitor?.trim() || null : null,
        sistema_operacional:
          f.categoria === "computadores" ? f.sistema_operacional?.trim() || null : null,
        rede_wifi: f.categoria === "wifi" ? f.rede_wifi?.trim() || null : null,
        ...(f.categoria === "wifi" && podeVisualizarSenhaWifi
          ? { senha_wifi: f.senha_wifi?.trim() || null }
          : {}),
        ae_title: f.categoria === "ultrasson" ? f.ae_title?.trim() || null : null,
        worklist: f.categoria === "ultrasson" ? f.worklist?.trim() || null : null,
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
      const resultado = await obterMonitoramentoAtual().verificar(r.ip, 2500);
      const { error } = await cliente
        .from("controle_ip")
        .update({
          status_online: resultado.status,
          tempo_resposta_ms: resultado.tempoRespostaMs,
          metodo_monitoramento: resultado.metodo,
          erro_monitoramento: resultado.erro,
          ultima_verificacao: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (error) throw error;
      return { status: resultado.status, ms: resultado.tempoRespostaMs };
    },
    onSuccess: (r) => {
      toast.success(`${r.status === "online" ? "Online" : "Offline"} (${r.ms} ms)`);
      queryClient.invalidateQueries({ queryKey: ["controle-ip"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const verificarLote = useMutation({
    mutationFn: async (lista: Registro[]) => {
      const ativos = lista.filter((registro) => registro.ip);
      for (const registro of ativos) await verificar.mutateAsync(registro);
      return ativos.length;
    },
    onSuccess: (total) =>
      toast.success(`Ping em lote concluído: ${total} equipamento(s) verificado(s).`),
    onError: (e) => toast.error((e as Error).message),
  });
  useEffect(() => {
    if (!podeEditar || !todos.length) return;
    const timer = window.setInterval(() => {
      verificarLote.mutate(todos);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [podeEditar, todos]);

  async function registrarAuditoria(operacao: string, observacoes: string) {
    await cliente.from("audit_logs").insert({
      tabela: "controle_ip",
      operacao,
      observacoes,
      registro_id: null,
      dados_novos: { quantidade: filtrados.length },
    });
  }
  function dadosExportacao() {
    return filtrados.map((r) => ({
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
      "Usuário Responsável": r.usuario_responsavel ?? "",
      AnyDesk: r.anydesk ?? "",
      "Patrimônio CPU": r.patrimonio_cpu ?? "",
      "Patrimônio Monitor": r.patrimonio_monitor ?? "",
      "Sistema Operacional": r.sistema_operacional ?? "",
      Status: statusLabel(r.status_online),
      "Tempo de Resposta (ms)": r.tempo_resposta_ms ?? "",
      "Última Verificação": r.ultima_verificacao ?? "",
      "Método de Monitoramento": r.metodo_monitoramento,
      "Erro de Monitoramento": r.erro_monitoramento ?? "",
      "Rede Wi-Fi": r.rede_wifi ?? "",
      "Senha Wi-Fi": "[PROTEGIDA — disponível somente no cadastro autorizado]",
      AETitle: r.ae_title ?? "",
      Worklist: r.worklist ?? "",
      Observações: r.observacoes ?? "",
    }));
  }
  async function exportar() {
    const dados = dadosExportacao();
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Controle IP");
    baixar(
      "controle-ip.xlsx",
      new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], {
        type: "application/octet-stream",
      }),
    );
    await registrarAuditoria("EXPORT", `Exportação XLSX de ${dados.length} registro(s)`);
    toast.success(`${dados.length} registro(s) exportado(s).`);
  }
  async function exportarCsv() {
    const dados = dadosExportacao();
    const ws = XLSX.utils.json_to_sheet(dados);
    const csv = XLSX.utils.sheet_to_csv(ws);
    baixar("controle-ip.csv", new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    await registrarAuditoria("EXPORT", `Exportação CSV de ${dados.length} registro(s)`);
    toast.success(`${dados.length} registro(s) exportado(s) em CSV.`);
  }
  async function importar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[workbook.SheetNames[0]],
      );
      const pendentes: ImportacaoPendente[] = [];
      for (const [indice, row] of rows.entries()) {
        const ip = String(row.IP ?? row.ip ?? "").trim() || null;
        const cat = String(row.Categoria ?? row.categoria ?? aba)
          .toLowerCase()
          .replaceAll(" ", "_") as Categoria;
        const nome = String(row.Nome ?? row.nome ?? row.Equipamento ?? "").trim();
        if (!nome || (ip && !validarIp(ip))) {
          pendentes.push({
            linha: indice + 2,
            payload: null,
            acao: "ignorar",
            detalhe: !nome ? "Nome obrigatório" : `IP inválido: ${ip}`,
          });
          continue;
        }
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
          categoria: CATEGORIAS.some((c) => c.id === cat)
            ? cat
            : CATEGORIAS.some((c) => c.id === aba)
              ? (aba as Categoria)
              : "impressoras",
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
          usuario_responsavel:
            String(row["Usuário Responsável"] ?? row.Usuario ?? row.Usuário ?? "") || null,
          anydesk: String(row.AnyDesk ?? row.anydesk ?? "") || null,
          patrimonio_cpu: String(row["Patrimônio CPU"] ?? row.PatrimonioCPU ?? "") || null,
          patrimonio_monitor:
            String(row["Patrimônio Monitor"] ?? row.PatrimonioMonitor ?? "") || null,
          sistema_operacional:
            String(row["Sistema Operacional"] ?? row.SistemaOperacional ?? "") || null,
          rede_wifi: String(row["Rede Wi-Fi"] ?? row.Rede ?? row.SSID ?? "") || null,
          ...(podeVisualizarSenhaWifi
            ? { senha_wifi: String(row["Senha Wi-Fi"] ?? row.Senha ?? "") || null }
            : {}),
          ae_title: String(row.AETitle ?? row["AE Title"] ?? "") || null,
          worklist: String(row.Worklist ?? row.worklist ?? "") || null,
          observacoes: String(row.Observações ?? row.Observacoes ?? "") || null,
        };
        if (payload.categoria === "computadores" && !payload.local && !payload.setor) {
          pendentes.push({
            linha: indice + 2,
            payload: null,
            acao: "ignorar",
            detalhe: `${nome}: Local/Setor obrigatório`,
          });
          continue;
        }
        const existente = ip ? todos.find((registro) => registro.ip === ip) : null;
        pendentes.push({
          linha: indice + 2,
          payload,
          acao: existente ? "atualizar" : "inserir",
          detalhe: existente ? `IP já cadastrado: ${ip}` : "Novo registro",
        });
      }
      setImportacaoPendente(pendentes);
      toast.success("Pré-visualização pronta. Nenhum registro foi alterado.");
    } catch (e) {
      toast.error(`Falha na importação: ${(e as Error).message}`);
    }
    event.target.value = "";
  }
  async function confirmarImportacao() {
    if (!importacaoPendente) return;
    let inseridos = 0;
    let atualizados = 0;
    let ignorados = 0;
    const erros: string[] = [];
    for (const item of importacaoPendente) {
      if (!item.payload) {
        ignorados++;
        erros.push(`Linha ${item.linha}: ${item.detalhe}`);
        continue;
      }
      const ip = String(item.payload.ip ?? "");
      const query = ip
        ? cliente.from("controle_ip").upsert(item.payload, { onConflict: "ip" })
        : cliente.from("controle_ip").insert(item.payload);
      const { error } = await query;
      if (error) {
        ignorados++;
        erros.push(`Linha ${item.linha}: ${error.message}`);
      } else if (item.acao === "atualizar") atualizados++;
      else inseridos++;
    }
    const resumo = `${inseridos} inserido(s), ${atualizados} atualizado(s), ${ignorados} ignorado(s)`;
    await registrarAuditoria("IMPORT", `Importação confirmada: ${resumo}`);
    queryClient.invalidateQueries({ queryKey: ["controle-ip"] });
    setImportacaoPendente(null);
    toast.success(
      `Importação concluída: ${resumo}${erros.length ? `. Erros: ${erros.length}` : ""}`,
    );
  }
  async function copiarTexto(valor: string, mensagem: string) {
    try {
      await navigator.clipboard.writeText(valor);
      toast.success(mensagem);
    } catch {
      toast.error(
        "Não foi possível copiar automaticamente. Selecione e copie o valor manualmente.",
      );
    }
  }
  async function conectarAnyDesk(registro: Registro) {
    const id = registro.anydesk?.trim();
    if (!id) {
      toast.error("Este computador não possui ID AnyDesk cadastrado.");
      return;
    }
    await copiarTexto(
      id,
      "ID AnyDesk copiado. Se o aplicativo não abrir, cole o código no AnyDesk.",
    );
    const abriu = window.open(`anydesk://${encodeURIComponent(id)}`, "_blank");
    if (!abriu) toast.info("Cole o ID copiado no aplicativo AnyDesk.");
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
          <Button variant="outline" size="sm" onClick={exportarCsv}>
            <Download className="mr-1.5 size-4" />
            CSV
          </Button>
          {podeEditar && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => verificarLote.mutate(filtrados)}
              disabled={verificarLote.isPending || !filtrados.some((registro) => registro.ip)}
            >
              <Activity className="mr-1.5 size-4" />
              {verificarLote.isPending ? "Verificando..." : "Ping em lote"}
            </Button>
          )}
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
      <section className="mb-6 space-y-4" aria-label="Dashboard do Controle de IP">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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
          <div className="card-superficie p-3">
            <p className="text-xs uppercase text-muted-foreground">Não verificados</p>
            <p className="mt-1 text-xl font-semibold text-slate-600">
              {todos.filter((r) => r.status_online === "nao_verificado").length}
            </p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card-superficie p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Distribuição por unidade</h2>
              <Globe2 className="size-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {resumoUnidades.map((item) => (
                <div key={item.unidade} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{item.unidade}</p>
                  <p className="mt-1 text-2xl font-semibold">{item.total}</p>
                  <p className="text-xs text-muted-foreground">{item.faixa}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card-superficie p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Status operacional</h2>
              <Activity className="size-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Online</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-700">
                  {todos.filter((r) => r.status_online === "online").length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Offline</p>
                <p className="mt-1 text-2xl font-semibold text-red-700">
                  {todos.filter((r) => r.status_online === "offline").length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Não verificado</p>
                <p className="mt-1 text-2xl font-semibold text-slate-600">
                  {todos.filter((r) => r.status_online === "nao_verificado").length}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="card-superficie p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Registros por categoria</h2>
            <span className="text-xs text-muted-foreground">{todos.length} no total</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {resumoCategorias.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex items-center justify-between rounded border border-border px-3 py-2 text-left text-sm hover:border-primary hover:bg-primary/5"
                onClick={() => setAba(item.id)}
              >
                <span>
                  {item.icon} {item.label}
                </span>
                <Badge variant="secondary">{item.total}</Badge>
              </button>
            ))}
          </div>
        </div>
        <div className="card-superficie p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Qualidade do inventário</h2>
            <Search className="size-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Sem IP</p>
              <p className="mt-1 text-2xl font-semibold">{todos.filter((r) => !r.ip).length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sem patrimônio</p>
              <p className="mt-1 text-2xl font-semibold">
                {
                  todos.filter((r) => !r.patrimonio && !r.patrimonio_cpu && !r.patrimonio_monitor)
                    .length
                }
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Offline</p>
              <p className="mt-1 text-2xl font-semibold text-red-700">
                {todos.filter((r) => r.status_online === "offline").length}
              </p>
            </div>
          </div>
        </div>
      </section>
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
          <TabsTrigger value="livres-matriz">IP Livre MATRIZ</TabsTrigger>
          <TabsTrigger value="livres-mn">IP Livre MN</TabsTrigger>
        </TabsList>
        <TabsContent value="livres-matriz">
          <div className="card-superficie overflow-hidden">
            <div className="border-b border-border p-4">
              <h2 className="font-semibold">IPs livres de MATRIZ</h2>
              <p className="text-sm text-muted-foreground">
                Faixa 192.168.0.1 até .254 · {livresMatriz.length} disponíveis
              </p>
            </div>
            <div className="grid max-h-[460px] grid-cols-2 gap-2 overflow-auto p-4 sm:grid-cols-4 lg:grid-cols-8">
              {livresMatriz.map((ip) => (
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
                      unidade: "MATRIZ",
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
        <TabsContent value="livres-mn">
          <div className="card-superficie overflow-hidden">
            <div className="border-b border-border p-4">
              <h2 className="font-semibold">IPs livres de MEDICINA NUCLEAR (MN)</h2>
              <p className="text-sm text-muted-foreground">
                Faixa 192.168.1.1 até .254 · {livresMn.length} disponíveis
              </p>
            </div>
            <div className="grid max-h-[460px] grid-cols-2 gap-2 overflow-auto p-4 sm:grid-cols-4 lg:grid-cols-8">
              {livresMn.map((ip) => (
                <button
                  key={ip}
                  type="button"
                  className="rounded border border-border px-2 py-2 text-left text-sm hover:border-primary hover:bg-primary/5"
                  onClick={() =>
                    podeAdicionar &&
                    setForm({ ...VAZIO, ip, nome: `Reserva de IP ${ip}`, unidade: "MN" })
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
        <TabsContent value={aba.startsWith("livres-") ? "__none" : aba}>
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
                          {r.categoria === "computadores"
                            ? [r.usuario_responsavel, r.patrimonio_cpu, r.patrimonio_monitor]
                                .filter(Boolean)
                                .join(" · ") || "—"
                            : [r.fabricante, r.modelo, r.patrimonio].filter(Boolean).join(" · ") ||
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
                          Última: {formatarData(r.ultima_verificacao)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.tempo_resposta_ms !== null
                            ? `${r.tempo_resposta_ms} ms · ${r.metodo_monitoramento}`
                            : "Sem tempo registrado"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          {r.ip && (
                            <Button
                              variant="outline"
                              size="sm"
                              title="Copiar IP"
                              onClick={() => copiarTexto(r.ip!, "IP copiado.")}
                            >
                              <Copy className="mr-1 size-3.5" />
                              Copiar IP
                            </Button>
                          )}
                          {r.categoria === "computadores" && r.anydesk && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                title="Copiar AnyDesk"
                                onClick={() => copiarTexto(r.anydesk!, "ID AnyDesk copiado.")}
                              >
                                <Copy className="mr-1 size-3.5" />
                                Copiar AnyDesk
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                title="Conectar AnyDesk"
                                onClick={() => conectarAnyDesk(r)}
                              >
                                <Monitor className="mr-1 size-3.5" />
                                Conectar AnyDesk
                              </Button>
                            </>
                          )}
                          {r.ip && (
                            <Button
                              variant="outline"
                              size="sm"
                              title="Verificar agora"
                              onClick={() => verificar.mutate(r)}
                              disabled={verificar.isPending}
                            >
                              <Globe2 className="mr-1 size-3.5" />
                              Verificar agora
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Ver histórico de verificações"
                            onClick={() => setHistoricoId(r.id)}
                          >
                            Histórico
                          </Button>
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
                <Label>
                  {form.categoria === "computadores"
                    ? "Nome do Computador *"
                    : "Nome / identificação *"}
                </Label>
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
              {form.categoria === "computadores" ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Local/Setor *</Label>
                  <Input
                    value={form.local ?? ""}
                    placeholder="Ex.: Recepção, Sala 02 ou TI"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        local: e.target.value || null,
                        setor: e.target.value || null,
                      })
                    }
                    required
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Local</Label>
                  <Input
                    value={form.local ?? ""}
                    onChange={(e) => setForm({ ...form, local: e.target.value || null })}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Andar</Label>
                <Input
                  value={form.andar ?? ""}
                  onChange={(e) => setForm({ ...form, andar: e.target.value || null })}
                />
              </div>
              {form.categoria !== "computadores" && (
                <div className="space-y-1.5">
                  <Label>Setor</Label>
                  <Input
                    value={form.setor ?? ""}
                    onChange={(e) => setForm({ ...form, setor: e.target.value || null })}
                  />
                </div>
              )}
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
              {form.categoria === "computadores" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Usuário Responsável</Label>
                    <Input
                      value={form.usuario_responsavel ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, usuario_responsavel: e.target.value || null })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>AnyDesk</Label>
                    <Input
                      value={form.anydesk ?? ""}
                      placeholder="ID AnyDesk"
                      onChange={(e) => setForm({ ...form, anydesk: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Patrimônio CPU</Label>
                    <Input
                      value={form.patrimonio_cpu ?? ""}
                      onChange={(e) => setForm({ ...form, patrimonio_cpu: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Patrimônio Monitor</Label>
                    <Input
                      value={form.patrimonio_monitor ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, patrimonio_monitor: e.target.value || null })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sistema Operacional</Label>
                    <Input
                      value={form.sistema_operacional ?? ""}
                      placeholder="Windows 11, Linux..."
                      onChange={(e) =>
                        setForm({ ...form, sistema_operacional: e.target.value || null })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status Online/Offline</Label>
                    <div
                      className={`rounded-md border px-3 py-2 text-sm ${statusClass(todos.find((registro) => registro.id === form.id)?.status_online ?? "nao_verificado")}`}
                    >
                      {statusLabel(
                        todos.find((registro) => registro.id === form.id)?.status_online ??
                          "nao_verificado",
                      )}{" "}
                      — use o botão de ping para atualizar
                    </div>
                  </div>
                </>
              )}
              {form.categoria === "wifi" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Rede / SSID</Label>
                    <Input
                      value={form.rede_wifi ?? ""}
                      onChange={(e) => setForm({ ...form, rede_wifi: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Senha Wi-Fi</Label>
                      {podeVisualizarSenhaWifi && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSenhasWifiVisiveis((visivel) => !visivel)}
                        >
                          {senhasWifiVisiveis ? "Ocultar" : "Revelar"}
                        </Button>
                      )}
                    </div>
                    <Input
                      type={podeVisualizarSenhaWifi && senhasWifiVisiveis ? "text" : "password"}
                      value={podeVisualizarSenhaWifi ? (form.senha_wifi ?? "") : ""}
                      placeholder={
                        podeVisualizarSenhaWifi
                          ? "Senha protegida"
                          : "Sem permissão para visualizar"
                      }
                      disabled={!podeVisualizarSenhaWifi}
                      onChange={(e) => setForm({ ...form, senha_wifi: e.target.value || null })}
                    />
                  </div>
                </>
              )}
              {form.categoria === "ultrasson" && (
                <>
                  <div className="space-y-1.5">
                    <Label>AETitle</Label>
                    <Input
                      value={form.ae_title ?? ""}
                      onChange={(e) => setForm({ ...form, ae_title: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Worklist</Label>
                    <Input
                      value={form.worklist ?? ""}
                      onChange={(e) => setForm({ ...form, worklist: e.target.value || null })}
                    />
                  </div>
                </>
              )}
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
      <Dialog
        open={!!importacaoPendente}
        onOpenChange={(open) => !open && setImportacaoPendente(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização da importação</DialogTitle>
          </DialogHeader>
          {importacaoPendente && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                {(["inserir", "atualizar", "ignorar"] as const).map((acao) => (
                  <div key={acao} className="rounded border border-border p-3">
                    <p className="text-xs uppercase text-muted-foreground">
                      {acao === "inserir"
                        ? "Inserir"
                        : acao === "atualizar"
                          ? "Atualizar"
                          : "Ignorar"}
                    </p>
                    <p className="mt-1 text-xl font-semibold">
                      {importacaoPendente.filter((item) => item.acao === acao).length}
                    </p>
                  </div>
                ))}
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {importacaoPendente.map((item) => (
                  <div
                    key={`${item.linha}-${item.detalhe}`}
                    className="flex items-center justify-between gap-3 rounded border border-border p-2 text-sm"
                  >
                    <span>Linha {item.linha}</span>
                    <Badge variant={item.acao === "ignorar" ? "destructive" : "secondary"}>
                      {item.acao}
                    </Badge>
                    <span className="flex-1 text-muted-foreground">{item.detalhe}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Nenhum dado foi alterado. Confirme somente após revisar as linhas do lote.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportacaoPendente(null)}>
                  Cancelar
                </Button>
                <Button onClick={confirmarImportacao}>Confirmar importação</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={historicoId !== null} onOpenChange={(open) => !open && setHistoricoId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de verificações</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {historico.isLoading && (
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            )}
            {!historico.isLoading && !historico.data?.length && (
              <p className="text-sm text-muted-foreground">Nenhuma verificação registrada.</p>
            )}
            {historico.data?.map(
              (item: {
                id: number;
                status_online: Status;
                tempo_resposta_ms: number | null;
                metodo_monitoramento: string;
                erro: string | null;
                verificado_em: string;
              }) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-3 text-sm"
                >
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(item.status_online)}`}
                  >
                    {statusLabel(item.status_online)}
                  </span>
                  <span>
                    {item.tempo_resposta_ms !== null ? `${item.tempo_resposta_ms} ms` : "—"}
                  </span>
                  <span className="text-muted-foreground">{item.metodo_monitoramento}</span>
                  <span className="text-muted-foreground">{formatarData(item.verificado_em)}</span>
                  {item.erro && <span className="w-full text-xs text-red-700">{item.erro}</span>}
                </div>
              ),
            )}
          </div>
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
