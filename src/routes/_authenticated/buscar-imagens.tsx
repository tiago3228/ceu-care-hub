import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  CircleHelp,
  Copy,
  FolderOpen,
  Image,
  Loader2,
  Search,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSessao } from "@/hooks/use-sessao";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/buscar-imagens")({
  head: () => ({
    meta: [
      { title: "Buscar imagens | Clínica CEU" },
      { name: "description", content: "Busca local de exames DICOM nos servidores antigos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BuscarImagens,
});

const AUXILIAR_LOCAL = "http://127.0.0.1:8765";

type Resultado = {
  id: string;
  patient: string;
  patient_id: string;
  date: string;
  modality: string;
  image_count: number | null;
  source: string;
  path: string | null;
  openable: boolean;
};

type ResultadoBusca = {
  results: Resultado[];
  warnings: string[];
  total: number;
};

type EstadoConexao = "nao_verificado" | "online" | "offline";

function formatarData(valor: string) {
  if (/^\d{8}$/.test(valor))
    return `${valor.slice(6, 8)}/${valor.slice(4, 6)}/${valor.slice(0, 4)}`;
  if (/^\d{6}$/.test(valor)) return `${valor.slice(4, 6)}/${valor.slice(0, 4)}`;
  if (/^\d{4}$/.test(valor)) return valor;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return valor || "—";
}

function auxiliarSemResposta(error: unknown) {
  return (
    error instanceof TypeError ||
    /failed to fetch|networkerror|load failed|fetch failed/i.test(
      error instanceof Error ? error.message : String(error),
    )
  );
}

async function tokenDaSessao() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error("Não foi possível validar sua sessão. Entre novamente no portal.");
  const token = data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre novamente no portal.");
  return token;
}

async function requisitarLocal<T>(path: string, body?: Record<string, string>) {
  const token = await tokenDaSessao();
  const response = await fetch(`${AUXILIAR_LOCAL}${path}`, {
    method: body ? "POST" : "GET",
    mode: "cors",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok)
    throw new Error(payload.error || `Falha do auxiliar local (${response.status}).`);
  return payload;
}

function BuscarImagens() {
  const { temModulo } = useSessao();
  const autorizado = temModulo("buscar_imagens");
  const [paciente, setPaciente] = useState("");
  const [prontuario, setProntuario] = useState("");
  const [data, setData] = useState("");
  const [modalidade, setModalidade] = useState("Todas");
  const [conexao, setConexao] = useState<EstadoConexao>("nao_verificado");
  const [auxiliarIndisponivel, setAuxiliarIndisponivel] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [pesquisando, setPesquisando] = useState(false);
  const [abrindoId, setAbrindoId] = useState<string | null>(null);
  const [anonimizandoId, setAnonimizandoId] = useState<string | null>(null);
  const [ocultarExamesComUmaImagem, setOcultarExamesComUmaImagem] = useState(false);
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const resultadosVisiveis =
    resultado?.results.filter((item) => !ocultarExamesComUmaImagem || item.image_count !== 1) ?? [];
  const examesOcultados = (resultado?.results.length ?? 0) - resultadosVisiveis.length;

  async function conectar() {
    setConectando(true);
    setAuxiliarIndisponivel(false);
    try {
      await requisitarLocal<{ status: string }>("/health");
      setConexao("online");
      toast.success("Auxiliar local conectado.");
    } catch (error) {
      const semResposta = auxiliarSemResposta(error);
      if (semResposta) setConexao("offline");
      setAuxiliarIndisponivel(semResposta);
      toast.error(
        error instanceof Error
          ? `${error.message} Inicie iniciar-auxiliar.bat neste computador e permita o acesso local no navegador.`
          : "Não foi possível conectar ao auxiliar local.",
      );
    } finally {
      setConectando(false);
    }
  }

  async function pesquisar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paciente.trim() && !prontuario.trim() && !data.trim()) {
      toast.error("Informe paciente, prontuário ou data antes de pesquisar.");
      return;
    }
    setPesquisando(true);
    setResultado(null);
    setAuxiliarIndisponivel(false);
    try {
      const response = await requisitarLocal<ResultadoBusca>("/api/search", {
        paciente: paciente.trim(),
        prontuario: prontuario.trim(),
        data: data.trim(),
        modalidade,
      });
      setConexao("online");
      setAuxiliarIndisponivel(false);
      setResultado(response);
      if (response.warnings.length) {
        response.warnings.forEach((warning) => toast.warning(warning));
      }
    } catch (error) {
      const semResposta = auxiliarSemResposta(error);
      if (semResposta) setConexao("offline");
      setAuxiliarIndisponivel(semResposta);
      toast.error(error instanceof Error ? error.message : "Falha na busca local.");
    } finally {
      setPesquisando(false);
    }
  }

  async function abrirPasta(result: Resultado) {
    setAbrindoId(result.id);
    try {
      await requisitarLocal<{ opened: boolean }>("/api/open-folder", { result_id: result.id });
      toast.success("Pasta aberta no Explorador de Arquivos deste computador.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir a pasta.");
    } finally {
      setAbrindoId(null);
    }
  }

  async function anonimizarEConverter(result: Resultado) {
    const confirmado = window.confirm(
      "Processar este exame com o MicroDicom? Serão criadas cópias na Área de Trabalho\\IMAGENS PACS; os originais não serão alterados e nenhum arquivo será enviado por e-mail. Ao final será aberta somente a pasta dos JPGs. Revise as imagens antes de compartilhar: texto gravado nos pixels pode continuar visível.",
    );
    if (!confirmado) return;

    setAnonimizandoId(result.id);
    try {
      const response = await requisitarLocal<{
        anonymized_count: number;
        jpg_count: number;
        opened: boolean;
      }>("/api/anonymize-export", { result_id: result.id });
      setConexao("online");
      if (response.opened) {
        toast.success(
          `Concluído: ${response.anonymized_count} DICOMs processados e ${response.jpg_count} JPGs gerados.`,
        );
      } else {
        toast.warning(
          `Foram gerados ${response.jpg_count} JPGs, mas o Explorador não abriu a pasta automaticamente.`,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao anonimizar e converter o exame.",
      );
    } finally {
      setAnonimizandoId(null);
    }
  }

  async function copiarCaminho(path: string) {
    try {
      await navigator.clipboard.writeText(path);
      toast.success("Caminho UNC copiado.");
    } catch {
      toast.error("O navegador não permitiu copiar o caminho.");
    }
  }

  return (
    <AppShell
      titulo="Buscar imagens"
      descricao="Pesquise exames antigos nos dois índices locais e abra a pasta pela rede."
    >
      {!autorizado ? (
        <Card>
          <CardHeader>
            <CardTitle>Acesso não autorizado</CardTitle>
            <CardDescription>
              Solicite ao administrador a permissão “Buscar exames DICOM antigos”.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">
                  <CircleHelp className="mr-2 h-4 w-4" />
                  Como usar a busca
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Como buscar imagens antigas</DialogTitle>
                  <DialogDescription>
                    Siga estes passos em cada computador que for consultar os exames.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 text-sm">
                  <section className="space-y-2">
                    <h3 className="font-semibold">1. Instalação ou atualização do auxiliar</h3>
                    <p>
                      No Explorador de Arquivos do Windows, abra a pasta compartilhada da clínica:
                    </p>
                    <code className="block break-all rounded-md bg-muted p-3 text-xs">
                      \\192.168.0.179\ap$\ti\PROGRAMAS\BUSCAR IMAGENS ANTIGAS
                    </code>
                    <p>
                      Abra o PowerShell e execute o comando abaixo. Ele procura
                      <code> instalar-auxiliar.ps1</code> dentro dessa pasta, inclusive na subpasta{" "}
                      <strong>PARA BUSCAR IMAGENS ANTIGAS</strong>, e inicia a instalação neste
                      computador:
                    </p>
                    <code className="block break-all rounded-md bg-muted p-3 text-xs">
                      {String.raw`$raiz = '\\192.168.0.179\ap$\ti\PROGRAMAS\BUSCAR IMAGENS ANTIGAS'
$instalador = Get-ChildItem -LiteralPath $raiz -Filter "instalar-auxiliar.ps1" -File -Recurse |
  Select-Object -First 1 -ExpandProperty FullName
if ($instalador) {
  powershell -NoProfile -ExecutionPolicy Bypass -File $instalador
} else {
  Write-Error "Não encontrei instalar-auxiliar.ps1 na pasta compartilhada."
}`}
                    </code>
                    <p className="text-muted-foreground">
                      Faça isso na primeira instalação ou quando receber uma atualização. O
                      instalador preserva o <code>config.json</code> existente neste computador. Se
                      o Windows bloquear o acesso à pasta compartilhada, confirme suas permissões de
                      rede com o suporte de TI.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold">2. Iniciar o auxiliar antes de pesquisar</h3>
                    <p>
                      No computador onde fará a busca, execute o arquivo local
                      <code> %LOCALAPPDATA%\CEU\BuscaImagens\iniciar-auxiliar.bat</code>. Se
                      preferir, cole este caminho na barra de endereço do Explorador de Arquivos:
                    </p>
                    <code className="block break-all rounded-md bg-muted p-3 text-xs">
                      %LOCALAPPDATA%\CEU\BuscaImagens\iniciar-auxiliar.bat
                    </code>
                    <p>
                      Mantenha a janela preta aberta enquanto usa o portal. Ela indica que o
                      auxiliar está rodando neste computador.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold">3. Conectar no portal</h3>
                    <p>
                      Volte a esta página e clique em <strong>Conectar</strong>. Na primeira vez, o
                      navegador pode pedir autorização para acessar o serviço local: permita o
                      acesso para o portal da clínica. O indicador deve mudar para
                      <strong> Conectado</strong>.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold">4. Fazer a busca</h3>
                    <p>
                      Informe ao menos um dado: nome do paciente, prontuário ou data do exame. A
                      modalidade inicia em <strong>Todas</strong>; se necessário, selecione outra.
                      Clique em <strong>Buscar nos dois servidores</strong>.
                    </p>
                    <p>
                      Para esconder exames com apenas uma imagem, marque
                      <strong> Ocultar exames com apenas 1 imagem</strong> acima da lista de
                      resultados. Desmarque para mostrar todos novamente.
                    </p>
                    <p>
                      Use <strong>Abrir pasta</strong> para ver os arquivos na rede ou
                      <strong> Copiar caminho</strong> para copiar o endereço da pasta.
                    </p>
                  </section>

                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                    <strong>Se não conectar:</strong> confirme que o auxiliar está aberto neste
                    computador, feche e inicie novamente o <code>iniciar-auxiliar.bat</code> e
                    confira se o navegador permitiu o acesso local. A busca usa os acessos de rede
                    da conta Windows conectada.
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {auxiliarIndisponivel && (
            <div
              className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="space-y-1">
                  <p className="font-semibold text-destructive">Auxiliar de busca não encontrado</p>
                  <p>
                    Inicie o arquivo local{" "}
                    <code>%LOCALAPPDATA%\CEU\BuscaImagens\iniciar-auxiliar.bat</code> e mantenha a
                    janela aberta. Depois, tente conectar novamente.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => void conectar()}
                disabled={conectando || Boolean(anonimizandoId)}
              >
                {conectando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Tentar conectar
              </Button>
            </div>
          )}
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {conexao === "online" ? (
                    <Wifi className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-muted-foreground" />
                  )}
                  Auxiliar deste computador
                </CardTitle>
                <CardDescription className="mt-2">
                  A pesquisa é enviada diretamente do navegador para o auxiliar em localhost. O
                  backend do portal não recebe filtros nem resultados.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={conexao === "online" ? "default" : "secondary"}>
                  {conexao === "online" ? "Conectado" : "Não conectado"}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void conectar()}
                  disabled={conectando || Boolean(anonimizandoId)}
                >
                  {conectando ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="mr-2 h-4 w-4" />
                  )}
                  Conectar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                A sessão e a permissão são verificadas no Supabase. O auxiliar envia ao Supabase
                somente o token de autenticação e a chave do módulo, nunca os filtros clínicos,
                resultados ou caminhos dos arquivos.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Critérios de busca</CardTitle>
              <CardDescription>
                A mesma consulta é executada em paralelo nos índices dos servidores .249 e .174.
                Informe ao menos um critério para evitar uma varredura completa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
                onSubmit={(event) => void pesquisar(event)}
              >
                <div className="space-y-2 xl:col-span-2">
                  <Label htmlFor="imagem-paciente">Paciente</Label>
                  <Input
                    id="imagem-paciente"
                    value={paciente}
                    onChange={(event) => setPaciente(event.target.value)}
                    maxLength={120}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imagem-prontuario">Prontuário</Label>
                  <Input
                    id="imagem-prontuario"
                    value={prontuario}
                    onChange={(event) => setProntuario(event.target.value)}
                    maxLength={80}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imagem-data">Data (DD/MM/AAAA, MM/AAAA ou AAAA)</Label>
                  <Input
                    id="imagem-data"
                    value={data}
                    onChange={(event) => setData(event.target.value)}
                    maxLength={10}
                    placeholder="Ex.: 15/06/2021"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modalidade</Label>
                  <Select value={modalidade} onValueChange={setModalidade}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todas">Todas</SelectItem>
                      <SelectItem value="US">Ultrassom (US)</SelectItem>
                      <SelectItem value="MG">MG</SelectItem>
                      <SelectItem value="MN">MN</SelectItem>
                      <SelectItem value="OT">OT</SelectItem>
                      <SelectItem value="CT">CT</SelectItem>
                      <SelectItem value="RX">RX</SelectItem>
                      <SelectItem value="MRI">MRI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 xl:col-span-5">
                  <Button type="submit" disabled={pesquisando || Boolean(anonimizandoId)}>
                    {pesquisando ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" />
                    )}
                    Buscar nos dois servidores
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {resultado && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Resultados ({resultadosVisiveis.length}
                  {examesOcultados > 0 ? ` de ${resultado.total}` : ""})
                </CardTitle>
                <CardDescription>
                  Os resultados ficam apenas nesta sessão do navegador. Se um servidor estiver
                  indisponível, os resultados do outro ainda serão exibidos. A anonimização e a
                  conversão ocorrem neste computador, sem enviar os arquivos ao portal.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {resultado.results.length > 0 && (
                  <div className="mb-4 flex items-center gap-2">
                    <Checkbox
                      id="ocultar-exames-uma-imagem"
                      checked={ocultarExamesComUmaImagem}
                      onCheckedChange={(checked) => setOcultarExamesComUmaImagem(checked === true)}
                    />
                    <Label htmlFor="ocultar-exames-uma-imagem" className="cursor-pointer">
                      Ocultar exames com apenas 1 imagem
                    </Label>
                  </div>
                )}
                {resultado.warnings.length > 0 && (
                  <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    {resultado.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                )}
                {resultado.results.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum exame encontrado nos índices consultados.
                  </p>
                ) : resultadosVisiveis.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Todos os exames encontrados têm apenas 1 imagem e estão ocultos pelo filtro.
                    Desative o filtro para vê-los.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Modalidade</TableHead>
                        <TableHead>Imagens</TableHead>
                        <TableHead>Prontuário</TableHead>
                        <TableHead>Servidor</TableHead>
                        <TableHead>Caminho de rede</TableHead>
                        <TableHead>Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultadosVisiveis.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="min-w-48 font-medium">
                            {item.patient || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatarData(item.date)}
                          </TableCell>
                          <TableCell>{item.modality || "—"}</TableCell>
                          <TableCell>{item.image_count ?? "—"}</TableCell>
                          <TableCell>{item.patient_id || "—"}</TableCell>
                          <TableCell className="min-w-40">{item.source}</TableCell>
                          <TableCell className="max-w-72 break-all text-xs">
                            {item.path || "Compartilhamento não mapeado"}
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-48 flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                  !item.openable || abrindoId === item.id || Boolean(anonimizandoId)
                                }
                                onClick={() => void abrirPasta(item)}
                              >
                                {abrindoId === item.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <FolderOpen className="mr-2 h-4 w-4" />
                                )}
                                Abrir pasta
                              </Button>
                              <Button
                                size="sm"
                                disabled={
                                  !item.openable || Boolean(anonimizandoId) || Boolean(abrindoId)
                                }
                                onClick={() => void anonimizarEConverter(item)}
                              >
                                {anonimizandoId === item.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Image className="mr-2 h-4 w-4" />
                                )}
                                {anonimizandoId === item.id ? "Processando..." : "Anonimizar + JPG"}
                              </Button>
                              {item.path && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => void copiarCaminho(item.path!)}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copiar caminho
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
