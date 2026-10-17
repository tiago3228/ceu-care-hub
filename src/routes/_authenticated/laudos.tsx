import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import mammoth from "mammoth";
import {
  ArrowLeft,
  BookOpenText,
  Cloud,
  ClipboardCheck,
  Download,
  FileInput,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  Plus,
  Pencil,
  Search,
  Stethoscope,
  Trash2,
  Type,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { importarAutoTextosWord } from "@/lib/laudos-documento";

// As colunas setor e outras adicionadas por migrations não constam nos tipos gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/laudos")({
  head: () => ({
    meta: [
      { title: "Laudos | Clínica CEU" },
      {
        name: "description",
        content: "Área de laudos organizada em pastas de ajuda e autotexto por médico.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaLaudos,
});

interface MedicoLaudos {
  id: number;
  nome: string;
  apelido: string | null;
  crm: string | null;
  especialidade_principal: string | null;
  especialidades: string | null;
  procedimentos: string | null;
  observacoes: string | null;
  ativo: boolean;
}

type PastaMedico = "inicio" | "ajuda" | "atestado" | "outros" | "autotexto" | "temporarios";

interface AutoTextoLaudos {
  id: number;
  nome: string;
  abreviacao: string;
  conteudo_html: string;
  conteudo_texto: string;
}

interface MaterialLaudo {
  id: number;
  categoria: "ajuda" | "atestado" | "outros";
  titulo: string;
  conteudo_texto: string;
  origem_arquivo: string | null;
  caminho_origem: string | null;
}

interface TemporarioLaudo {
  id: string;
  medico_id: number;
  titulo: string;
  conteudo_html: string;
  conteudo_texto: string;
  origem_tipo: "laudo" | "ajuda" | "autotexto";
  atualizado_em: string;
  expira_em: string;
}

interface RelatorioImportacao {
  id: string;
  arquivo_nome: string;
  status: string;
  resumo: string;
  detalhes: { falhas?: string[] };
  total_importados: number;
  total_nao_importados: number;
  criado_em: string;
}

function chaveNome(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/^(?:dra?\.?)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function pontuacaoCadastro(medico: MedicoLaudos) {
  return [
    medico.ativo,
    medico.crm,
    medico.apelido,
    medico.especialidade_principal,
    medico.especialidades,
    medico.procedimentos,
    medico.observacoes,
  ].filter(Boolean).length;
}

function deduplicarMedicos(medicos: MedicoLaudos[]) {
  const unicos = new Map<string, MedicoLaudos>();
  for (const medico of medicos) {
    const chave = chaveNome(medico.nome);
    const existente = unicos.get(chave);
    if (!existente) {
      unicos.set(chave, medico);
      continue;
    }

    const principal = pontuacaoCadastro(medico) > pontuacaoCadastro(existente) ? medico : existente;
    const complementar = principal.id === medico.id ? existente : medico;
    unicos.set(chave, {
      ...complementar,
      ...principal,
      apelido: principal.apelido ?? complementar.apelido,
      crm: principal.crm ?? complementar.crm,
      especialidade_principal:
        principal.especialidade_principal ?? complementar.especialidade_principal,
      especialidades: principal.especialidades ?? complementar.especialidades,
      procedimentos: principal.procedimentos ?? complementar.procedimentos,
      observacoes: principal.observacoes ?? complementar.observacoes,
      ativo: principal.ativo || complementar.ativo,
    });
  }
  return [...unicos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function textoParaHtml(texto: string) {
  return texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(
      (linha) =>
        `<p>${linha.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") || "<br>"}</p>`,
    )
    .join("");
}

function limparTextoImportado(texto: string) {
  return texto.replaceAll(String.fromCharCode(0), "").replace(/\r\n?/g, "\n").trim();
}

async function extrairTextoAjuda(arquivo: File) {
  const extensao = arquivo.name.split(".").pop()?.toLowerCase();
  if (["txt", "md"].includes(extensao ?? "")) {
    return limparTextoImportado(await arquivo.text());
  }
  if (extensao === "docx") {
    const resultado = await mammoth.extractRawText({ arrayBuffer: await arquivo.arrayBuffer() });
    return limparTextoImportado(resultado.value);
  }
  if (extensao === "rtf") {
    const texto = await arquivo.text();
    return limparTextoImportado(
      texto
        .replace(/\\'[0-9a-fA-F]{2}/g, "")
        .replace(/\\(par|line)\b/g, "\n")
        .replace(/\\[a-z]+-?\d* ?/gi, "")
        .replace(/[{}]/g, ""),
    );
  }
  throw new Error(`${arquivo.name}: formato não suportado. Use DOCX, RTF, TXT ou MD.`);
}

function PaginaLaudos() {
  const { temModulo, isAdmin, sessao, somenteLeitura, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const arquivoImportacaoRef = useRef<HTMLInputElement>(null);
  const arquivoAjudaRef = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState("");
  const [buscaMaterial, setBuscaMaterial] = useState("");
  const [materialRenomear, setMaterialRenomear] = useState<MaterialLaudo | null>(null);
  const [novoTituloMaterial, setNovoTituloMaterial] = useState("");
  const [salvandoTituloMaterial, setSalvandoTituloMaterial] = useState(false);
  const [medicoSelecionadoId, setMedicoSelecionadoId] = useState<number | null>(null);
  const [pastaAberta, setPastaAberta] = useState<PastaMedico>("inicio");
  const [adicionarAberto, setAdicionarAberto] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [crmNovo, setCrmNovo] = useState("");
  const [especialidadeNova, setEspecialidadeNova] = useState("");
  const [autotextoDialogo, setAutotextoDialogo] = useState(false);
  const [autotextoNome, setAutotextoNome] = useState("");
  const [autotextoAbreviacao, setAutotextoAbreviacao] = useState("");
  const [autotextoConteudo, setAutotextoConteudo] = useState("");
  const [relatorioAberto, setRelatorioAberto] = useState<RelatorioImportacao | null>(null);
  const [importandoAjuda, setImportandoAjuda] = useState(false);
  const EXTENSOES_AJUDA = ["docx", "rtf", "txt", "md"];
  const LIMITE_ARQUIVOS_AJUDA = 30;
  const LIMITE_TOTAL_AJUDA = 50 * 1024 * 1024;
  const podeGerenciarMedicos = isAdmin && !!sessao?.modulos.includes("laudos_medicos_gerenciar");
  const podeEditarConteudo = temModulo("salas") && !somenteLeitura;

  const medicos = useQuery({
    queryKey: ["laudos-medicos"],
    enabled: !carregandoSessao && temModulo("salas"),
    retry: 1,
    queryFn: async () => {
      const { data, error } = await db
        .from("laudos_medicos")
        .select(
          "medico_id,medicos:medicos(id,nome,apelido,crm,especialidade_principal,especialidades,procedimentos,observacoes,ativo)",
        );
      if (error) throw error;
      return deduplicarMedicos(
        (data ?? [])
          .map((item: { medicos: MedicoLaudos | null }) => item.medicos)
          .filter((medico: MedicoLaudos | null): medico is MedicoLaudos => !!medico),
      );
    },
  });

  const adicionarMedico = useMutation({
    mutationFn: async () => {
      if (!nomeNovo.trim()) throw new Error("Informe o nome do médico.");
      const { data, error } = await db.rpc("adicionar_medico_laudos", {
        p_nome: nomeNovo.trim(),
        p_crm: crmNovo.trim() || null,
        p_especialidade: especialidadeNova.trim() || null,
      });
      if (error) throw error;
      return Number(data);
    },
    onSuccess: (id) => {
      toast.success("Médico adicionado à biblioteca de Laudos.");
      setNomeNovo("");
      setCrmNovo("");
      setEspecialidadeNova("");
      setAdicionarAberto(false);
      setMedicoSelecionadoId(id);
      setPastaAberta("inicio");
      void queryClient.invalidateQueries({ queryKey: ["laudos-medicos"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const removerMedico = useMutation({
    mutationFn: async (medico: MedicoLaudos) => {
      const { error } = await db.rpc("remover_medico_laudos", { p_medico_id: medico.id });
      if (error) throw error;
      return medico;
    },
    onSuccess: (medico) => {
      toast.success(`${medico.nome} foi removido da biblioteca de Laudos.`);
      if (medicoSelecionadoId === medico.id) setMedicoSelecionadoId(null);
      void queryClient.invalidateQueries({ queryKey: ["laudos-medicos"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const autotextos = useQuery({
    queryKey: ["laudos-autotextos", medicoSelecionadoId],
    enabled: !!medicoSelecionadoId && pastaAberta === "autotexto" && !carregandoSessao,
    queryFn: async () => {
      const { data, error } = await db
        .from("laudos_autotextos")
        .select("id,nome,abreviacao,conteudo_html,conteudo_texto")
        .eq("medico_id", medicoSelecionadoId)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as AutoTextoLaudos[];
    },
  });

  const relatoriosImportacao = useQuery({
    queryKey: ["laudos-importacoes", medicoSelecionadoId],
    enabled: !!medicoSelecionadoId && pastaAberta === "autotexto" && !carregandoSessao,
    queryFn: async () => {
      const { data, error } = await db
        .from("laudos_importacoes")
        .select(
          "id,arquivo_nome,status,resumo,detalhes,total_importados,total_nao_importados,criado_em",
        )
        .eq("medico_id", medicoSelecionadoId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RelatorioImportacao[];
    },
  });

  const materiais = useQuery({
    queryKey: ["laudos-materiais", medicoSelecionadoId, pastaAberta],
    enabled:
      medicoSelecionadoId !== null &&
      ["ajuda", "atestado", "outros"].includes(pastaAberta) &&
      !carregandoSessao,
    queryFn: async () => {
      const consulta = db
        .from("laudos_materiais")
        .select("id,categoria,titulo,conteudo_texto,origem_arquivo,caminho_origem")
        .eq("categoria", pastaAberta)
        .order("ordem")
        .order("titulo");
      const { data, error } =
        medicoSelecionadoId === -1
          ? await consulta.is("medico_id", null)
          : await consulta.eq("medico_id", medicoSelecionadoId);
      if (error) throw error;
      return (data ?? []) as MaterialLaudo[];
    },
  });

  const temporarios = useQuery({
    queryKey: ["laudos-temporarios", medicoSelecionadoId],
    enabled: medicoSelecionadoId !== null && pastaAberta === "temporarios" && !carregandoSessao,
    queryFn: async () => {
      await db.rpc("limpar_laudos_temporarios_expirados");
      const { data, error } = await db
        .from("laudos_temporarios")
        .select(
          "id,medico_id,titulo,conteudo_html,conteudo_texto,origem_tipo,atualizado_em,expira_em",
        )
        .eq("medico_id", medicoSelecionadoId)
        .order("atualizado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TemporarioLaudo[];
    },
  });

  const materiaisVisiveis = useMemo(() => {
    const termo = buscaMaterial.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return materiais.data ?? [];
    return (materiais.data ?? []).filter((material) =>
      [material.titulo, material.conteudo_texto, material.origem_arquivo]
        .filter(Boolean)
        .some((valor) => valor!.toLocaleLowerCase("pt-BR").includes(termo)),
    );
  }, [materiais.data, buscaMaterial]);

  function baixarTexto(titulo: string, conteudo: string) {
    const blob = new Blob([conteudo || ""], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${titulo || "arquivo"}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(`Download iniciado: ${titulo}`);
  }

  function baixarMaterial(material: MaterialLaudo) {
    baixarTexto(material.titulo || "ajuda", material.conteudo_texto);
  }

  function abrirAjudaNoEditor(materialId: number) {
    if (!medicoSelecionadoId || medicoSelecionadoId < 0) return;
    void navigate({
      to: "/laudo-editor",
      search: { medicoId: medicoSelecionadoId, materialId },
    });
  }

  function abrirAutotextoNoEditor(autotextoId: number) {
    if (!medicoSelecionadoId || medicoSelecionadoId < 0) return;
    void navigate({
      to: "/laudo-editor",
      search: { medicoId: medicoSelecionadoId, autotextoId },
    });
  }

  async function excluirMaterial(material: MaterialLaudo) {
    if (!podeEditarConteudo || !window.confirm(`Excluir a ajuda “${material.titulo}”?`)) return;
    const { error } = await db.from("laudos_materiais").delete().eq("id", material.id);
    if (error) {
      toast.error(`Não foi possível excluir a ajuda: ${error.message}`);
      return;
    }
    toast.success("Ajuda excluída.");
    void queryClient.invalidateQueries({
      queryKey: ["laudos-materiais", medicoSelecionadoId, "ajuda"],
    });
  }

  async function salvarNovoTituloMaterial() {
    if (!materialRenomear || !podeEditarConteudo) return;
    const titulo = novoTituloMaterial.trim();
    if (!titulo) {
      toast.error("Informe um nome para o arquivo.");
      return;
    }
    if (titulo.length > 160) {
      toast.error("O nome deve ter no máximo 160 caracteres.");
      return;
    }
    const duplicado = (materiais.data ?? []).some(
      (material) =>
        material.id !== materialRenomear.id && chaveNome(material.titulo) === chaveNome(titulo),
    );
    if (duplicado) {
      toast.error("Já existe uma ajuda com esse nome nesta pasta.");
      return;
    }
    setSalvandoTituloMaterial(true);
    const { error } = await db
      .from("laudos_materiais")
      .update({ titulo })
      .eq("id", materialRenomear.id);
    setSalvandoTituloMaterial(false);
    if (error) {
      toast.error(`Não foi possível renomear a ajuda: ${error.message}`);
      return;
    }
    toast.success("Ajuda renomeada.");
    setMaterialRenomear(null);
    void queryClient.invalidateQueries({
      queryKey: ["laudos-materiais", medicoSelecionadoId, "ajuda"],
    });
  }

  async function importarAjudas(arquivos: File[]) {
    if (
      !arquivos.length ||
      !medicoSelecionadoId ||
      medicoSelecionadoId < 0 ||
      !sessao ||
      !podeEditarConteudo
    ) {
      return;
    }
    setImportandoAjuda(true);
    try {
      if (arquivos.length > LIMITE_ARQUIVOS_AJUDA) {
        throw new Error(`Selecione no máximo ${LIMITE_ARQUIVOS_AJUDA} arquivos por vez.`);
      }
      const tamanhoTotal = arquivos.reduce((total, arquivo) => total + arquivo.size, 0);
      if (tamanhoTotal > LIMITE_TOTAL_AJUDA) {
        throw new Error("O tamanho total dos arquivos excede o limite de 50 MB.");
      }
      const existentes = new Set(
        (materiais.data ?? []).map((material) => chaveNome(material.titulo)),
      );
      const selecionados = new Set<string>();
      const registros: Array<Record<string, unknown>> = [];
      const falhas: string[] = [];
      for (const arquivo of arquivos) {
        const extensao = arquivo.name.split(".").pop()?.toLowerCase() ?? "";
        if (!EXTENSOES_AJUDA.includes(extensao)) {
          falhas.push(`${arquivo.name}: extensão não permitida.`);
          continue;
        }
        if (arquivo.size === 0) {
          falhas.push(`${arquivo.name}: arquivo vazio.`);
          continue;
        }
        if (arquivo.size > 20 * 1024 * 1024) {
          falhas.push(`${arquivo.name}: excede o limite de 20 MB.`);
          continue;
        }
        try {
          const titulo = arquivo.name.replace(/\.[^.]+$/, "").trim() || arquivo.name;
          if (titulo.length > 160) {
            falhas.push(`${arquivo.name}: o nome é muito longo (máximo de 160 caracteres).`);
            continue;
          }
          const chave = chaveNome(titulo);
          if (existentes.has(chave) || selecionados.has(chave)) {
            falhas.push(`${arquivo.name}: já existe na pasta Ajuda e não foi duplicado.`);
            continue;
          }
          const conteudo = await extrairTextoAjuda(arquivo);
          if (!conteudo) {
            falhas.push(`${arquivo.name}: o arquivo não contém texto legível.`);
            continue;
          }
          registros.push({
            medico_id: medicoSelecionadoId,
            categoria: "ajuda",
            titulo,
            conteudo_texto: conteudo,
            origem_arquivo: arquivo.name,
            caminho_origem: `Importado pela pasta Ajuda · ${arquivo.name}`,
            criado_por: sessao.userId,
          });
          existentes.add(chave);
          selecionados.add(chave);
        } catch (error) {
          falhas.push(`${arquivo.name}: ${(error as Error).message}`);
        }
      }
      if (registros.length) {
        const { error } = await db.from("laudos_materiais").insert(registros);
        if (error) throw error;
      }
      void queryClient.invalidateQueries({
        queryKey: ["laudos-materiais", medicoSelecionadoId, "ajuda"],
      });
      const resumo = `${registros.length} arquivo(s) importado(s)${falhas.length ? `; ${falhas.length} não importado(s).` : "."}`;
      const detalhesFalhas =
        falhas.length > 5
          ? `${falhas.slice(0, 5).join(" ")} E mais ${falhas.length - 5} arquivo(s) com problema.`
          : falhas.join(" ");
      toast[registros.length ? "success" : "warning"](
        falhas.length ? `${resumo} ${detalhesFalhas}` : resumo,
      );
    } catch (error) {
      toast.error(`Não foi possível importar as ajudas: ${(error as Error).message}`);
    } finally {
      setImportandoAjuda(false);
      if (arquivoAjudaRef.current) arquivoAjudaRef.current.value = "";
    }
  }

  const salvarAutotexto = useMutation({
    mutationFn: async () => {
      if (!podeEditarConteudo || !medicoSelecionadoId || !sessao) {
        throw new Error("Você não tem permissão para cadastrar autotextos.");
      }
      if (!autotextoNome.trim() || !autotextoAbreviacao.trim() || !autotextoConteudo.trim()) {
        throw new Error("Preencha nome, abreviação e conteúdo do autotexto.");
      }
      const { error } = await db.from("laudos_autotextos").insert({
        medico_id: medicoSelecionadoId,
        nome: autotextoNome.trim(),
        abreviacao: autotextoAbreviacao.trim(),
        conteudo_html: textoParaHtml(autotextoConteudo),
        conteudo_texto: autotextoConteudo,
        criado_por: sessao.userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Autotexto salvo para este médico.");
      setAutotextoDialogo(false);
      setAutotextoNome("");
      setAutotextoAbreviacao("");
      setAutotextoConteudo("");
      void queryClient.invalidateQueries({ queryKey: ["laudos-autotextos", medicoSelecionadoId] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  async function importarArquivoWord(file?: File) {
    if (!file || !medicoSelecionadoId || !sessao || !podeEditarConteudo) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("O arquivo excede o limite de 20 MB.");
      const resultado = await importarAutoTextosWord(file);
      const falhas = [...resultado.falhas];
      let importados = 0;
      if (resultado.entradas.length) {
        const existentes = autotextos.data ?? [];
        const chavesExistentes = new Set(existentes.map((item) => chaveNome(item.abreviacao)));
        const novos = resultado.entradas.filter((entrada) => {
          const chave = chaveNome(entrada.abreviacao);
          if (chavesExistentes.has(chave)) {
            falhas.push(`${entrada.nome}: já existe para este médico e não foi sobrescrito.`);
            return false;
          }
          chavesExistentes.add(chave);
          return true;
        });
        if (novos.length) {
          const { error } = await db.from("laudos_autotextos").insert(
            novos.map((entrada) => ({
              medico_id: medicoSelecionadoId,
              nome: entrada.nome,
              abreviacao: entrada.abreviacao,
              conteudo_html: entrada.conteudoHtml,
              conteudo_texto: entrada.conteudoTexto,
              origem_arquivo: file.name,
              criado_por: sessao.userId,
            })),
          );
          if (error) {
            falhas.push(`Falha ao salvar as entradas recuperadas: ${error.message}`);
          } else {
            importados = novos.length;
          }
        }
      }

      const status = importados > 0 ? (falhas.length ? "parcial" : "concluida") : resultado.status;
      const resumo =
        importados > 0
          ? `${importados} autotexto(s) importado(s); ${falhas.length} entrada(s) não importada(s) ou para revisão.`
          : resultado.resumo;
      const totalNaoImportados = Math.max(falhas.length, resultado.entradas.length - importados);
      const { error: relatorioError } = await db.from("laudos_importacoes").insert({
        medico_id: medicoSelecionadoId,
        arquivo_nome: file.name,
        formato: resultado.formato,
        status,
        resumo,
        detalhes: { falhas },
        total_importados: importados,
        total_nao_importados: totalNaoImportados,
        criado_por: sessao.userId,
      });
      if (relatorioError) throw relatorioError;

      void queryClient.invalidateQueries({ queryKey: ["laudos-autotextos", medicoSelecionadoId] });
      void queryClient.invalidateQueries({ queryKey: ["laudos-importacoes", medicoSelecionadoId] });
      toast[importados ? "success" : "warning"](resumo);
    } catch (error) {
      toast.error(`Não foi possível concluir a importação: ${(error as Error).message}`);
    } finally {
      if (arquivoImportacaoRef.current) arquivoImportacaoRef.current.value = "";
    }
  }

  const lista = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return (medicos.data ?? []).filter(
      (medico) =>
        !termo ||
        [medico.nome, medico.apelido, medico.crm, medico.especialidade_principal]
          .filter(Boolean)
          .some((valor) => valor!.toLocaleLowerCase("pt-BR").includes(termo)),
    );
  }, [medicos.data, busca]);

  const medicoSelecionado =
    medicoSelecionadoId === -1
      ? ({
          id: -1,
          nome: "Outros",
          apelido: null,
          crm: null,
          especialidade_principal: null,
          especialidades: null,
          procedimentos: null,
          observacoes: "Materiais sem médico identificado.",
          ativo: true,
        } satisfies MedicoLaudos)
      : lista.find((medico) => medico.id === medicoSelecionadoId);

  function abrirMedico(medico: MedicoLaudos) {
    setMedicoSelecionadoId(medico.id);
    setPastaAberta("inicio");
    setBuscaMaterial("");
  }

  function abrirPasta(medico: MedicoLaudos, pasta: Exclude<PastaMedico, "inicio">) {
    setMedicoSelecionadoId(medico.id);
    setPastaAberta(pasta);
    setBuscaMaterial("");
  }

  function abrirCriacaoAutotexto(medico: MedicoLaudos) {
    abrirPasta(medico, "autotexto");
    setAutotextoNome("");
    setAutotextoAbreviacao("");
    setAutotextoConteudo("");
    setAutotextoDialogo(true);
  }

  if (!carregandoSessao && !temModulo("salas")) {
    return (
      <AppShell titulo="Laudos">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso à área de laudos.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Laudos"
      descricao="Uma pasta por médico, com Ajuda, Atestado, Outros e Autotexto"
    >
      <div className="grid min-h-[600px] gap-4 lg:min-h-[calc(100vh-220px)] xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.7fr)]">
        <section className="card-superficie flex min-h-0 flex-col overflow-hidden lg:h-[calc(100vh-220px)]">
          <div className="border-b border-border/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Médicos</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {medicos.data?.length ?? 0} médico(s) sem duplicatas
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">{lista.length} exibido(s)</Badge>
                {podeGerenciarMedicos && (
                  <Button size="sm" onClick={() => setAdicionarAberto(true)}>
                    <Plus className="mr-1.5 size-4" /> Adicionar
                  </Button>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome, CRM ou especialidade"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                aria-label="Buscar médicos"
              />
            </div>
          </div>

          <div className="laudos-lista-medicos min-h-0 flex-1 space-y-1 overflow-y-scroll p-2">
            {medicos.isLoading || carregandoSessao ? (
              <div className="space-y-2 p-2" aria-label="Carregando médicos">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-[70px] w-full" />
                ))}
              </div>
            ) : medicos.isError ? (
              <div className="p-4 text-sm text-destructive" role="alert">
                Não foi possível carregar os médicos. Atualize a página e tente novamente.
              </div>
            ) : lista.length ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  className={`h-auto w-full justify-start whitespace-normal p-3 text-left ${
                    medicoSelecionadoId === -1
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/60"
                  }`}
                  aria-pressed={medicoSelecionadoId === -1}
                  onClick={() => {
                    setMedicoSelecionadoId(-1);
                    setPastaAberta("inicio");
                  }}
                >
                  <span className="mr-3 flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Folder className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">Outros</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      Materiais sem médico identificado
                    </span>
                  </span>
                  <Folder className="ml-2 size-4 shrink-0 text-muted-foreground" />
                </Button>
                {lista.map((medico) => {
                  const selecionado = medicoSelecionado?.id === medico.id;
                  return (
                    <ContextMenu key={medico.id}>
                      <ContextMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          className={`h-auto w-full justify-start whitespace-normal p-3 text-left ${
                            selecionado ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                          }`}
                          aria-pressed={selecionado}
                          onClick={() => abrirMedico(medico)}
                        >
                          <span className="mr-3 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Stethoscope className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {medico.nome}
                            </span>
                            <span className="mt-1 block truncate text-xs text-muted-foreground">
                              {medico.especialidade_principal ||
                                medico.crm ||
                                "Abrir pasta do médico"}
                            </span>
                          </span>
                          <Folder className="ml-2 size-4 shrink-0 text-muted-foreground" />
                        </Button>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem asChild>
                          <Link
                            to="/laudo-editor"
                            search={{ medicoId: medico.id }}
                            className="flex cursor-default items-center"
                          >
                            <FileText className="mr-2 size-4" /> Abrir Laudo
                          </Link>
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => abrirPasta(medico, "ajuda")}>
                          <BookOpenText className="mr-2 size-4" /> Ajuda
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => abrirPasta(medico, "autotexto")}>
                          <Type className="mr-2 size-4" /> Autotexto
                        </ContextMenuItem>
                        {podeEditarConteudo && (
                          <ContextMenuItem onSelect={() => abrirCriacaoAutotexto(medico)}>
                            <Plus className="mr-2 size-4" /> Criar autotextos
                          </ContextMenuItem>
                        )}
                        {podeGerenciarMedicos && (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => {
                                if (
                                  window.confirm(
                                    `Remover ${medico.nome} da biblioteca de Laudos? O cadastro mestre e os vínculos históricos serão preservados.`,
                                  )
                                ) {
                                  removerMedico.mutate(medico);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 size-4" /> Remover da biblioteca
                            </ContextMenuItem>
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {medicos.data?.length
                  ? "Nenhum médico corresponde à busca."
                  : "Nenhum médico cadastrado."}
              </div>
            )}
          </div>
        </section>

        <section className="card-superficie min-w-0 overflow-hidden">
          {medicoSelecionado ? (
            <div className="flex h-full flex-col">
              <header className="flex flex-wrap items-start gap-4 border-b border-border/70 p-5 sm:p-6">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FolderOpen className="size-7" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold tracking-tight">{medicoSelecionado.nome}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[
                      medicoSelecionado.apelido,
                      medicoSelecionado.crm && `CRM ${medicoSelecionado.crm}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Pasta do médico"}
                  </p>
                </div>
                {medicoSelecionado.id !== -1 && (
                  <Button asChild size="sm">
                    <Link to="/laudo-editor" search={{ medicoId: medicoSelecionado.id }}>
                      <FileText className="mr-2 size-4" /> Abrir Laudo
                    </Link>
                  </Button>
                )}
              </header>

              {pastaAberta === "inicio" ? (
                <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                  <div className="mb-5">
                    <h3 className="font-semibold">Pastas do médico</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Selecione uma pasta ou clique com o botão direito no nome do médico.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className="group flex min-h-28 items-center gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                      onClick={() => setPastaAberta("ajuda")}
                    >
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <BookOpenText className="size-6" />
                      </span>
                      <span>
                        <span className="block font-medium">Ajuda</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          Orientações e materiais de apoio
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="group flex min-h-28 items-center gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                      onClick={() => setPastaAberta("atestado")}
                    >
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <ClipboardCheck className="size-6" />
                      </span>
                      <span>
                        <span className="block font-medium">Atestado</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          Modelos e declarações
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="group flex min-h-28 items-center gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                      onClick={() => setPastaAberta("outros")}
                    >
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Folder className="size-6" />
                      </span>
                      <span>
                        <span className="block font-medium">Outros</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          Materiais complementares
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="group flex min-h-28 items-center gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                      onClick={() => setPastaAberta("autotexto")}
                    >
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Type className="size-6" />
                      </span>
                      <span>
                        <span className="block font-medium">Autotexto</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          Textos prontos para usar nos laudos
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="group flex min-h-28 items-center gap-4 rounded-xl border border-amber-300/60 bg-amber-50/40 p-4 text-left transition-colors hover:border-amber-400 hover:bg-amber-50"
                      onClick={() => setPastaAberta("temporarios")}
                    >
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <Cloud className="size-6" />
                      </span>
                      <span>
                        <span className="block font-medium">Temporários</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          Rascunhos automáticos por 5 dias
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mb-5 -ml-2"
                    onClick={() => setPastaAberta("inicio")}
                  >
                    <ArrowLeft className="mr-2 size-4" /> Voltar às pastas
                  </Button>
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {pastaAberta === "ajuda" ? (
                        <BookOpenText className="size-5" />
                      ) : pastaAberta === "atestado" ? (
                        <ClipboardCheck className="size-5" />
                      ) : pastaAberta === "outros" ? (
                        <Folder className="size-5" />
                      ) : pastaAberta === "temporarios" ? (
                        <Cloud className="size-5" />
                      ) : (
                        <FileText className="size-5" />
                      )}
                    </span>
                    <div>
                      <h3 className="font-semibold">
                        {pastaAberta === "ajuda"
                          ? "Ajuda"
                          : pastaAberta === "atestado"
                            ? "Atestado"
                            : pastaAberta === "outros"
                              ? "Outros"
                              : pastaAberta === "temporarios"
                                ? "Temporários"
                                : "Autotexto"}
                      </h3>
                      <p className="text-sm text-muted-foreground">{medicoSelecionado.nome}</p>
                    </div>
                  </div>
                  {pastaAberta === "temporarios" ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-amber-300/60 bg-amber-50/50 p-4 text-sm text-amber-950">
                        <p className="font-medium">Salvamento automático ativo por 5 dias</p>
                        <p className="mt-1 text-amber-900/80">
                          Os rascunhos são renovados enquanto você trabalha e removidos após cinco
                          dias.
                        </p>
                      </div>
                      {temporarios.isLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-24 w-full" />
                          <Skeleton className="h-24 w-full" />
                        </div>
                      ) : temporarios.isError ? (
                        <p className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
                          Não foi possível carregar os rascunhos temporários.
                        </p>
                      ) : temporarios.data?.length ? (
                        temporarios.data.map((item) => (
                          <ContextMenu key={item.id}>
                            <ContextMenuTrigger asChild>
                              <article className="cursor-default rounded-xl border border-border/70 p-4 hover:border-primary/40 hover:bg-accent/30">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h4 className="font-medium">{item.titulo}</h4>
                                  <Badge variant="outline">
                                    {item.origem_tipo === "autotexto"
                                      ? "Autotexto"
                                      : item.origem_tipo === "ajuda"
                                        ? "Ajuda"
                                        : "Laudo"}
                                  </Badge>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                  {item.conteudo_texto.slice(0, 500)}
                                  {item.conteudo_texto.length > 500 ? "…" : ""}
                                </p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Atualizado em{" "}
                                  {new Date(item.atualizado_em).toLocaleString("pt-BR")} · expira em{" "}
                                  {new Date(item.expira_em).toLocaleDateString("pt-BR")}
                                </p>
                              </article>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem
                                onSelect={() => baixarTexto(item.titulo, item.conteudo_texto)}
                              >
                                <Download className="mr-2 size-4" /> Baixar rascunho
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        ))
                      ) : (
                        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                          <Cloud className="mx-auto mb-3 size-7 text-muted-foreground" />
                          <h4 className="font-medium">Nenhum temporário salvo</h4>
                          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                            Depois de digitar por até um minuto com o autosave ligado, o rascunho
                            aparecerá aqui.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : pastaAberta === "ajuda" ||
                    pastaAberta === "atestado" ||
                    pastaAberta === "outros" ? (
                    <>
                      {pastaAberta === "ajuda" &&
                        medicoSelecionado.id !== -1 &&
                        podeEditarConteudo && (
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                            <div>
                              <h4 className="font-medium">Adicionar ajudas</h4>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Até 30 arquivos por vez, 50 MB no total e 20 MB por arquivo.
                              </p>
                            </div>
                            <div>
                              <input
                                ref={arquivoAjudaRef}
                                type="file"
                                multiple
                                accept=".docx,.rtf,.txt,.md"
                                className="hidden"
                                aria-label="Selecionar um ou mais arquivos de ajuda"
                                onChange={(event) =>
                                  void importarAjudas(Array.from(event.target.files ?? []))
                                }
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => arquivoAjudaRef.current?.click()}
                                disabled={importandoAjuda}
                              >
                                <FileInput className="mr-2 size-4" />
                                {importandoAjuda ? "Importando…" : "Importar ajuda"}
                              </Button>
                            </div>
                          </div>
                        )}
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[220px] flex-1">
                          <Filter className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            placeholder="Filtrar por título ou conteúdo"
                            value={buscaMaterial}
                            onChange={(event) => setBuscaMaterial(event.target.value)}
                            aria-label="Filtrar materiais da pasta"
                          />
                        </div>
                        {!materiais.isLoading && !materiais.isError && (
                          <Badge variant="secondary">
                            {materiaisVisiveis.length}/{materiais.data?.length ?? 0}
                          </Badge>
                        )}
                      </div>
                      {materiais.isLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-24 w-full" />
                          <Skeleton className="h-24 w-full" />
                        </div>
                      ) : materiais.isError ? (
                        <p className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
                          Não foi possível carregar os materiais desta pasta.
                        </p>
                      ) : materiaisVisiveis.length ? (
                        <div className="space-y-3">
                          {materiaisVisiveis.map((item) => (
                            <ContextMenu key={item.id}>
                              <ContextMenuTrigger asChild>
                                <article
                                  className="cursor-default rounded-xl border border-border/70 p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
                                  title="Clique duas vezes para abrir no editor Word"
                                  onDoubleClick={() => abrirAjudaNoEditor(item.id)}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <FileText className="size-5 shrink-0 text-primary" />
                                      <h4 className="truncate font-medium">{item.titulo}</h4>
                                    </div>
                                    {item.origem_arquivo && (
                                      <Badge variant="outline">{item.origem_arquivo}</Badge>
                                    )}
                                  </div>
                                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                    <FileText className="size-3.5" /> Duplo clique para abrir no
                                    Word · botão direito para opções
                                  </p>
                                </article>
                              </ContextMenuTrigger>
                              {podeEditarConteudo && (
                                <ContextMenuContent>
                                  <ContextMenuItem onSelect={() => abrirAjudaNoEditor(item.id)}>
                                    <FileText className="mr-2 size-4" /> Abrir no Word
                                  </ContextMenuItem>
                                  <ContextMenuItem onSelect={() => baixarMaterial(item)}>
                                    <Download className="mr-2 size-4" /> Baixar
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onSelect={() => {
                                      setMaterialRenomear(item);
                                      setNovoTituloMaterial(item.titulo);
                                    }}
                                  >
                                    <Pencil className="mr-2 size-4" /> Renomear
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onSelect={() => void excluirMaterial(item)}
                                  >
                                    <Trash2 className="mr-2 size-4" /> Excluir
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              )}
                            </ContextMenu>
                          ))}
                        </div>
                      ) : (
                        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                          <Folder className="mx-auto mb-3 size-7 text-muted-foreground" />
                          <h4 className="font-medium">
                            {buscaMaterial.trim()
                              ? "Nenhum material encontrado"
                              : "Nenhum material nesta pasta"}
                          </h4>
                          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                            Os conteúdos recebidos serão organizados aqui por médico e categoria.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                        <div>
                          <h4 className="font-medium">Biblioteca de autotextos</h4>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Digite a abreviação no editor e pressione F3. Cada biblioteca pertence
                            somente a este médico.
                          </p>
                        </div>
                        {podeEditarConteudo && (
                          <div className="flex flex-wrap gap-2">
                            <input
                              ref={arquivoImportacaoRef}
                              type="file"
                              accept=".dot,.dotx,.dotm,.docx,.docm"
                              className="hidden"
                              aria-label="Selecionar modelo do Word para importar autotextos"
                              onChange={(event) =>
                                void importarArquivoWord(event.target.files?.[0])
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => arquivoImportacaoRef.current?.click()}
                            >
                              <FileInput className="mr-2 size-4" /> Importar Word
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setAutotextoDialogo(true)}
                            >
                              <Plus className="mr-2 size-4" /> Novo autotexto
                            </Button>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl border border-amber-300/70 bg-amber-50/60 p-4 text-left transition-colors hover:border-amber-400 hover:bg-amber-50"
                        onClick={() => setPastaAberta("temporarios")}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                          <Cloud className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">
                            Pasta BKP — salvamento automático
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            Consulte os laudos digitados e salvos a cada 1 minuto. Os backups ficam
                            disponíveis por 5 dias.
                          </span>
                        </span>
                        <FolderOpen className="size-5 shrink-0 text-amber-700" />
                      </button>

                      {autotextos.isLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      ) : autotextos.isError ? (
                        <p className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
                          Não foi possível carregar os autotextos deste médico.
                        </p>
                      ) : autotextos.data?.length ? (
                        <div className="space-y-2">
                          {autotextos.data.map((item) => (
                            <ContextMenu key={item.id}>
                              <ContextMenuTrigger asChild>
                                <article
                                  className="cursor-default rounded-xl border border-border/70 p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
                                  title="Clique duas vezes para abrir no editor Word"
                                  onDoubleClick={() => abrirAutotextoNoEditor(item.id)}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-medium">{item.nome}</h4>
                                    <Badge variant="secondary">{item.abreviacao}</Badge>
                                  </div>
                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                    {item.conteudo_texto.slice(0, 360)}
                                    {item.conteudo_texto.length > 360 ? "…" : ""}
                                  </p>
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    Duplo clique para abrir no Word · botão direito para opções
                                  </p>
                                </article>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem onSelect={() => abrirAutotextoNoEditor(item.id)}>
                                  <FileText className="mr-2 size-4" /> Abrir no Word
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onSelect={() => baixarTexto(item.nome, item.conteudo_texto)}
                                >
                                  <Download className="mr-2 size-4" /> Baixar
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center">
                          <FileText className="mx-auto mb-3 size-6 text-muted-foreground" />
                          <p className="font-medium">Nenhum autotexto cadastrado</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Cadastre o conteúdo recebido ou importe um modelo Word compatível. Nada
                            será sobrescrito.
                          </p>
                        </div>
                      )}

                      {!!relatoriosImportacao.data?.length && (
                        <section className="space-y-2 border-t border-border/70 pt-4">
                          <h4 className="text-sm font-semibold">Relatórios de importação</h4>
                          {relatoriosImportacao.data.map((relatorio) => (
                            <button
                              type="button"
                              key={relatorio.id}
                              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-3 text-left transition-colors hover:bg-accent/40"
                              onClick={() => setRelatorioAberto(relatorio)}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {relatorio.arquivo_nome}
                                </span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {relatorio.resumo}
                                </span>
                              </span>
                              <Badge variant={relatorio.total_importados ? "secondary" : "outline"}>
                                {relatorio.total_importados} importado(s) ·{" "}
                                {relatorio.total_nao_importados} pendente(s)
                              </Badge>
                            </button>
                          ))}
                        </section>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
              <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Stethoscope className="size-7" />
              </span>
              <h2 className="text-lg font-semibold">Selecione um médico</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Clique em um profissional para abrir suas pastas ou use o botão direito para ir
                diretamente a Ajuda ou Autotexto.
              </p>
            </div>
          )}
        </section>
      </div>
      <Dialog open={adicionarAberto} onOpenChange={setAdicionarAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar médico à biblioteca</DialogTitle>
            <DialogDescription>
              O médico ficará disponível em Laudos, sem associação a setor ou sala. Se já existir no
              cadastro mestre, esse registro será reaproveitado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="laudos-medico-nome" className="text-sm font-medium">
                Nome do médico <span className="text-destructive">*</span>
              </label>
              <Input
                id="laudos-medico-nome"
                autoFocus
                maxLength={160}
                value={nomeNovo}
                onChange={(event) => setNomeNovo(event.target.value)}
                placeholder="Ex.: Dr. Vinicius"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="laudos-medico-crm" className="text-sm font-medium">
                  CRM (opcional)
                </label>
                <Input
                  id="laudos-medico-crm"
                  maxLength={32}
                  value={crmNovo}
                  onChange={(event) => setCrmNovo(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="laudos-medico-especialidade" className="text-sm font-medium">
                  Especialidade (opcional)
                </label>
                <Input
                  id="laudos-medico-especialidade"
                  maxLength={120}
                  value={especialidadeNova}
                  onChange={(event) => setEspecialidadeNova(event.target.value)}
                />
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Remover posteriormente da biblioteca não apagará o médico do cadastro principal nem
              afetará escalas, salas ou documentos existentes.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdicionarAberto(false)}
              disabled={adicionarMedico.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => adicionarMedico.mutate()}
              disabled={!nomeNovo.trim() || adicionarMedico.isPending}
            >
              <Plus className="mr-2 size-4" />
              {adicionarMedico.isPending ? "Adicionando…" : "Adicionar médico"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={autotextoDialogo} onOpenChange={setAutotextoDialogo}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo autotexto · {medicoSelecionado?.nome}</DialogTitle>
            <DialogDescription>
              O conteúdo será salvo somente na biblioteca deste médico e expandido no editor ao
              pressionar F3.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="laudo-autotexto-nome" className="text-sm font-medium">
                  Nome
                </label>
                <Input
                  id="laudo-autotexto-nome"
                  maxLength={120}
                  value={autotextoNome}
                  onChange={(event) => setAutotextoNome(event.target.value)}
                  placeholder="Ex.: Nódulo"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="laudo-autotexto-abreviacao" className="text-sm font-medium">
                  Abreviação para F3
                </label>
                <Input
                  id="laudo-autotexto-abreviacao"
                  maxLength={80}
                  value={autotextoAbreviacao}
                  onChange={(event) => setAutotextoAbreviacao(event.target.value)}
                  placeholder="Ex.: nodulo"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="laudo-autotexto-conteudo" className="text-sm font-medium">
                Conteúdo integral
              </label>
              <Textarea
                id="laudo-autotexto-conteudo"
                className="min-h-56 resize-y"
                maxLength={50000}
                value={autotextoConteudo}
                onChange={(event) => setAutotextoConteudo(event.target.value)}
                placeholder="Cole o texto original. As quebras de linha serão preservadas."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAutotextoDialogo(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => salvarAutotexto.mutate()}
              disabled={
                salvarAutotexto.isPending ||
                !autotextoNome.trim() ||
                !autotextoAbreviacao.trim() ||
                !autotextoConteudo.trim()
              }
            >
              {salvarAutotexto.isPending ? "Salvando…" : "Salvar autotexto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!materialRenomear}
        onOpenChange={(open) => {
          if (!open && !salvandoTituloMaterial) setMaterialRenomear(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear ajuda</DialogTitle>
            <DialogDescription>
              O novo nome será usado na lista e no arquivo baixado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="laudo-ajuda-novo-nome" className="text-sm font-medium">
              Nome do arquivo
            </label>
            <Input
              id="laudo-ajuda-novo-nome"
              autoFocus
              maxLength={160}
              value={novoTituloMaterial}
              onChange={(event) => setNovoTituloMaterial(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void salvarNovoTituloMaterial();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMaterialRenomear(null)}
              disabled={salvandoTituloMaterial}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void salvarNovoTituloMaterial()}
              disabled={!novoTituloMaterial.trim() || salvandoTituloMaterial}
            >
              <Pencil className="mr-2 size-4" />
              {salvandoTituloMaterial ? "Salvando…" : "Renomear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!relatorioAberto} onOpenChange={(open) => !open && setRelatorioAberto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Relatório de importação</DialogTitle>
            <DialogDescription>{relatorioAberto?.arquivo_nome}</DialogDescription>
          </DialogHeader>
          {relatorioAberto && (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto">
              <div className="rounded-lg bg-muted p-4 text-sm">
                <p className="font-medium">{relatorioAberto.resumo}</p>
                <p className="mt-2 text-muted-foreground">
                  Importados: {relatorioAberto.total_importados} · Não importados/para revisão:{" "}
                  {relatorioAberto.total_nao_importados}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(relatorioAberto.criado_em).toLocaleString("pt-BR")}
                </p>
              </div>
              {relatorioAberto.detalhes?.falhas?.length ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">
                    Entradas não importadas e observações
                  </h4>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    {relatorioAberto.detalhes.falhas.map((falha, index) => (
                      <li key={`${index}-${falha}`}>{falha}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Todas as entradas recuperáveis foram importadas.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRelatorioAberto(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
