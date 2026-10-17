import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  BrainCircuit,
  Bold,
  Calculator,
  Clipboard,
  ClipboardCheck,
  Copy,
  Cloud,
  CircleAlert,
  FileDown,
  FilePlus2,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Printer,
  Pilcrow,
  Redo2,
  Save,
  Scissors,
  Trash2,
  Underline,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSessao } from "@/hooks/use-sessao";
import { supabase } from "@/integrations/supabase/client";
import { baixarBlob, gerarDocxLaudo, sanitizarHtmlLaudo } from "@/lib/laudos-documento";
import { analisarLaudoComIA, type AnaliseLaudoIA } from "@/lib/laudos-ia.functions";
import { toast } from "sonner";

// Tables created by the Laudos migrations are not yet present in the generated client type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/laudo-editor")({
  validateSearch: z.object({
    medicoId: z.coerce.number().int().positive(),
    documentoId: z.string().uuid().optional(),
    materialId: z.coerce.number().int().positive().optional(),
    autotextoId: z.coerce.number().int().positive().optional(),
  }),
  head: () => ({
    meta: [{ title: "Abrir Laudo | Clínica CEU" }, { name: "robots", content: "noindex" }],
  }),
  component: EditorLaudo,
});

interface MedicoEditor {
  id: number;
  nome: string;
  crm: string | null;
  especialidade_principal: string | null;
}

interface DocumentoSalvo {
  id: string;
  medico_id: number;
  titulo: string;
  conteudo_html: string;
  conteudo_texto: string;
  atualizado_em: string;
  criado_em: string;
}

interface AutoTexto {
  id: number;
  nome: string;
  abreviacao: string;
  conteudo_html: string;
}

interface MaterialEditor {
  id: number;
  medico_id: number;
  titulo: string;
  conteudo_texto: string;
}

interface FontePersonalizada {
  id: string;
  familia: string;
  caminho_storage: string;
}

const FONTES_PADRAO = [
  "Garamond",
  "Aptos",
  "Arial",
  "Calibri",
  "Georgia",
  "Times New Roman",
  "Verdana",
];
const TAMANHOS = [
  "8pt",
  "9pt",
  "10pt",
  "11pt",
  "12pt",
  "14pt",
  "16pt",
  "18pt",
  "20pt",
  "24pt",
  "28pt",
  "36pt",
];

function normalizarAtalho(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function textoParaEditorHtml(texto: string) {
  return texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(
      (linha) =>
        `<p>${linha.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") || "<br>"}</p>`,
    )
    .join("");
}

function EditorLaudo() {
  const { medicoId, documentoId: documentoInicial, materialId, autotextoId } = Route.useSearch();
  const { temModulo, somenteLeitura, isAdmin, sessao, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const ultimaSelecao = useRef<Range | null>(null);
  const ultimoDocumentoCarregado = useRef<string | null>(null);
  const inputFonteRef = useRef<HTMLInputElement>(null);

  const [titulo, setTitulo] = useState("");
  const [html, setHtml] = useState("");
  const [documentoId, setDocumentoId] = useState<string | null>(documentoInicial ?? null);
  const [alterado, setAlterado] = useState(false);
  const [fonteAtual, setFonteAtual] = useState("Garamond");
  const [tamanhoAtual, setTamanhoAtual] = useState("12pt");
  const [mostrarMarcas, setMostrarMarcas] = useState(false);
  const [analiseDialogAberto, setAnaliseDialogAberto] = useState(false);
  const [resultadoAnalise, setResultadoAnalise] = useState<AnaliseLaudoIA | null>(null);
  const [erroAnalise, setErroAnalise] = useState<string | null>(null);
  const [autosaveAtivo, setAutosaveAtivo] = useState(true);
  const [statusSalvamento, setStatusSalvamento] = useState<
    "salvo" | "temporario" | "alterado" | "salvando" | "erro"
  >("salvo");
  const [ultimoSalvamento, setUltimoSalvamento] = useState<Date | null>(null);
  const [clinuxPulsando, setClinuxPulsando] = useState(true);
  const [emprestimoDialogAberto, setEmprestimoDialogAberto] = useState(false);
  const [medicoAutotextoEmprestadoId, setMedicoAutotextoEmprestadoId] = useState<number | null>(
    null,
  );
  const [calculadoraAberta, setCalculadoraAberta] = useState(false);
  const [calculadoraJanela, setCalculadoraJanela] = useState({
    x: 24,
    y: 24,
    width: 760,
    height: 720,
    minimizada: false,
    maximizada: false,
  });
  const acaoJanelaCalculadora = useRef<{
    tipo: "arrastar" | "redimensionar";
    inicioX: number;
    inicioY: number;
    janela: typeof calculadoraJanela;
  } | null>(null);
  const podeEditar = temModulo("laudos") && !somenteLeitura;
  const podeGerenciarFontes = isAdmin && !!sessao?.modulos.includes("laudos_medicos_gerenciar");
  const modoBiblioteca = materialId !== undefined || autotextoId !== undefined;

  useEffect(() => {
    function moverJanela(event: PointerEvent) {
      const acao = acaoJanelaCalculadora.current;
      if (!acao) return;
      const dx = event.clientX - acao.inicioX;
      const dy = event.clientY - acao.inicioY;
      if (acao.tipo === "arrastar") {
        setCalculadoraJanela((atual) => ({
          ...atual,
          x: Math.max(8, Math.min(window.innerWidth - 180, acao.janela.x + dx)),
          y: Math.max(8, Math.min(window.innerHeight - 80, acao.janela.y + dy)),
        }));
      } else {
        setCalculadoraJanela((atual) => ({
          ...atual,
          width: Math.max(380, Math.min(window.innerWidth - atual.x - 8, acao.janela.width + dx)),
          height: Math.max(
            300,
            Math.min(window.innerHeight - atual.y - 8, acao.janela.height + dy),
          ),
        }));
      }
    }
    function terminarAcao() {
      acaoJanelaCalculadora.current = null;
    }
    window.addEventListener("pointermove", moverJanela);
    window.addEventListener("pointerup", terminarAcao);
    return () => {
      window.removeEventListener("pointermove", moverJanela);
      window.removeEventListener("pointerup", terminarAcao);
    };
  }, []);

  function iniciarArrasteCalculadora(event: React.PointerEvent<HTMLElement>) {
    if (calculadoraJanela.maximizada) return;
    event.preventDefault();
    acaoJanelaCalculadora.current = {
      tipo: "arrastar",
      inicioX: event.clientX,
      inicioY: event.clientY,
      janela: calculadoraJanela,
    };
  }

  function iniciarRedimensionamentoCalculadora(event: React.PointerEvent<HTMLDivElement>) {
    if (calculadoraJanela.maximizada || calculadoraJanela.minimizada) return;
    event.preventDefault();
    event.stopPropagation();
    acaoJanelaCalculadora.current = {
      tipo: "redimensionar",
      inicioX: event.clientX,
      inicioY: event.clientY,
      janela: calculadoraJanela,
    };
  }

  const medico = useQuery({
    queryKey: ["laudo-editor-medico", medicoId],
    enabled: !carregandoSessao && temModulo("laudos"),
    queryFn: async () => {
      const { data, error } = await db
        .from("medicos")
        .select("id,nome,crm,especialidade_principal")
        .eq("id", medicoId)
        .maybeSingle();
      if (error) throw error;
      return data as MedicoEditor | null;
    },
  });

  const documentos = useQuery({
    queryKey: ["laudos-documentos", medicoId],
    enabled: !carregandoSessao && temModulo("laudos"),
    queryFn: async () => {
      const { data, error } = await db
        .from("laudos_documentos")
        .select("id,medico_id,titulo,conteudo_html,conteudo_texto,atualizado_em,criado_em")
        .eq("medico_id", medicoId)
        .order("atualizado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocumentoSalvo[];
    },
  });

  const autotextos = useQuery({
    queryKey: ["laudos-autotextos", medicoId],
    enabled: !carregandoSessao && temModulo("laudos"),
    queryFn: async () => {
      const { data, error } = await db
        .from("laudos_autotextos")
        .select("id,nome,abreviacao,conteudo_html")
        .eq("medico_id", medicoId)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as AutoTexto[];
    },
  });

  const medicosComAutotexto = useQuery({
    queryKey: ["laudos-medicos-com-autotexto", medicoId],
    enabled: !carregandoSessao && temModulo("laudos"),
    queryFn: async () => {
      const { data: entradas, error: entradasError } = await db
        .from("laudos_autotextos")
        .select("medico_id")
        .neq("medico_id", medicoId);
      if (entradasError) throw entradasError;
      const ids = [
        ...new Set((entradas ?? []).map((item: { medico_id: number }) => item.medico_id)),
      ];
      if (!ids.length) return [] as Array<{ id: number; nome: string; quantidade: number }>;
      const { data: medicos, error: medicosError } = await db
        .from("medicos")
        .select("id,nome")
        .in("id", ids)
        .order("nome");
      if (medicosError) throw medicosError;
      const quantidades = new Map<number, number>();
      for (const entrada of entradas ?? []) {
        quantidades.set(entrada.medico_id, (quantidades.get(entrada.medico_id) ?? 0) + 1);
      }
      return (medicos ?? []).map((item: { id: number; nome: string }) => ({
        ...item,
        quantidade: quantidades.get(item.id) ?? 0,
      }));
    },
  });

  const autotextosEmprestados = useQuery({
    queryKey: ["laudos-autotextos-emprestados", medicoAutotextoEmprestadoId],
    enabled: medicoAutotextoEmprestadoId !== null && !carregandoSessao && temModulo("laudos"),
    queryFn: async () => {
      const { data, error } = await db
        .from("laudos_autotextos")
        .select("id,nome,abreviacao,conteudo_html")
        .eq("medico_id", medicoAutotextoEmprestadoId)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as AutoTexto[];
    },
  });

  const autotextosDisponiveis = useMemo(
    () => [...(autotextos.data ?? []), ...(autotextosEmprestados.data ?? [])],
    [autotextos.data, autotextosEmprestados.data],
  );

  const material = useQuery({
    queryKey: ["laudo-editor-material", medicoId, materialId],
    enabled: materialId !== undefined && !carregandoSessao && temModulo("laudos"),
    queryFn: async () => {
      const { data, error } = await db
        .from("laudos_materiais")
        .select("id,medico_id,titulo,conteudo_texto")
        .eq("id", materialId)
        .eq("medico_id", medicoId)
        .maybeSingle();
      if (error) throw error;
      return data as MaterialEditor | null;
    },
  });

  const fontes = useQuery({
    queryKey: ["laudos-fontes"],
    enabled: !carregandoSessao && temModulo("laudos"),
    queryFn: async () => {
      const { data, error } = await db
        .from("laudos_fontes")
        .select("id,familia,caminho_storage")
        .order("familia");
      if (error) throw error;
      return (data ?? []) as FontePersonalizada[];
    },
  });

  const familiasFonte = useMemo(
    () => [...new Set([...FONTES_PADRAO, ...(fontes.data ?? []).map((item) => item.familia)])],
    [fontes.data],
  );

  useEffect(() => {
    const styleId = "laudos-fontes-dinamicas";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.append(style);
    }
    style.textContent = (fontes.data ?? [])
      .map((fonte) => {
        const family = fonte.familia.replaceAll(/["'\\]/g, "");
        const url = supabase.storage.from("laudos-fontes").getPublicUrl(fonte.caminho_storage)
          .data.publicUrl;
        return `@font-face{font-family:"${family}";src:url("${url}") format("truetype");font-display:swap}`;
      })
      .join("\n");
  }, [fontes.data]);

  useEffect(() => {
    if (materialId !== undefined) {
      const chave = `material:${materialId}`;
      if (!material.data || ultimoDocumentoCarregado.current === chave) return;
      setTitulo(material.data.titulo);
      const safeHtml = textoParaEditorHtml(material.data.conteudo_texto);
      setHtml(safeHtml);
      setDocumentoId(null);
      setAlterado(false);
      if (editorRef.current) editorRef.current.innerHTML = safeHtml || "<p><br></p>";
      ultimoDocumentoCarregado.current = chave;
      return;
    }
    if (autotextoId !== undefined) {
      const chave = `autotexto:${autotextoId}`;
      const autotexto = autotextos.data?.find((item) => item.id === autotextoId);
      if (!autotexto || ultimoDocumentoCarregado.current === chave) return;
      setTitulo(autotexto.nome);
      const safeHtml = sanitizarHtmlLaudo(autotexto.conteudo_html);
      setHtml(safeHtml);
      setDocumentoId(null);
      setAlterado(false);
      if (editorRef.current) editorRef.current.innerHTML = safeHtml || "<p><br></p>";
      ultimoDocumentoCarregado.current = chave;
      return;
    }
    if (!documentoId || !documentos.data || ultimoDocumentoCarregado.current === documentoId)
      return;
    const documento = documentos.data.find((item) => item.id === documentoId);
    if (!documento) {
      if (!documentos.isLoading)
        toast.error("Não foi possível localizar esse laudo para este médico.");
      ultimoDocumentoCarregado.current = documentoId;
      return;
    }
    setTitulo(documento.titulo);
    const safeHtml = sanitizarHtmlLaudo(documento.conteudo_html);
    setHtml(safeHtml);
    setAlterado(false);
    if (editorRef.current) editorRef.current.innerHTML = safeHtml || "<p><br></p>";
    ultimoDocumentoCarregado.current = documentoId;
  }, [
    autotextoId,
    autotextos.data,
    documentoId,
    documentos.data,
    documentos.isLoading,
    material.data,
    materialId,
  ]);

  useEffect(() => {
    if (!alterado) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [alterado]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!podeEditar || !sessao) throw new Error("Você não tem permissão para salvar laudos.");
      const nomeDocumento = titulo.trim();
      if (!nomeDocumento) throw new Error("Informe um nome para o laudo.");
      const conteudoHtml = sanitizarHtmlLaudo(editorRef.current?.innerHTML ?? html);
      const conteudoTexto = editorRef.current?.innerText ?? "";
      if (materialId !== undefined) {
        const { error } = await db
          .from("laudos_materiais")
          .update({ titulo: nomeDocumento, conteudo_texto: conteudoTexto })
          .eq("id", materialId)
          .eq("medico_id", medicoId);
        if (error) throw error;
        return null;
      }
      if (autotextoId !== undefined) {
        const { error } = await db
          .from("laudos_autotextos")
          .update({
            nome: nomeDocumento,
            conteudo_html: conteudoHtml,
            conteudo_texto: conteudoTexto,
          })
          .eq("id", autotextoId)
          .eq("medico_id", medicoId);
        if (error) throw error;
        return null;
      }
      const payload = {
        medico_id: medicoId,
        titulo: nomeDocumento,
        conteudo_html: conteudoHtml,
        conteudo_texto: conteudoTexto,
        atualizado_em: new Date().toISOString(),
      };
      if (documentoId) {
        const { data, error } = await db
          .from("laudos_documentos")
          .update(payload)
          .eq("id", documentoId)
          .select("id")
          .single();
        if (error) throw error;
        return String(data.id);
      }
      const { data, error } = await db
        .from("laudos_documentos")
        .insert({ ...payload, criado_por: sessao.userId })
        .select("id")
        .single();
      if (error) throw error;
      return String(data.id);
    },
    onSuccess: (id) => {
      if (id) {
        setDocumentoId(id);
        ultimoDocumentoCarregado.current = id;
      }
      setAlterado(false);
      setStatusSalvamento("salvo");
      setUltimoSalvamento(new Date());
      toast.success(
        modoBiblioteca
          ? "Conteúdo salvo na biblioteca."
          : "Laudo salvo. Você poderá reabri-lo nesta pasta.",
      );
      void queryClient.invalidateQueries({ queryKey: ["laudos-documentos", medicoId] });
      void queryClient.invalidateQueries({ queryKey: ["laudos-autotextos", medicoId] });
      void queryClient.invalidateQueries({ queryKey: ["laudos-materiais", medicoId, "ajuda"] });
    },
    onError: (error) => {
      setStatusSalvamento("erro");
      toast.error((error as Error).message);
    },
  });

  const salvarTemporario = useMutation({
    mutationFn: async () => {
      if (!podeEditar || !sessao)
        throw new Error("Você não tem permissão para salvar temporários.");
      const conteudoHtml = sanitizarHtmlLaudo(editorRef.current?.innerHTML ?? html);
      const conteudoTexto = editorRef.current?.innerText ?? "";
      const origemTipo =
        materialId !== undefined ? "ajuda" : autotextoId !== undefined ? "autotexto" : "laudo";
      const origemId = materialId ?? autotextoId ?? documentoId ?? null;
      const chave = `${medicoId}:${origemTipo}:${origemId ?? "novo"}`;
      const { error } = await db.from("laudos_temporarios").upsert(
        {
          medico_id: medicoId,
          usuario_id: sessao.userId,
          titulo: titulo.trim() || "Laudo sem título",
          conteudo_html: conteudoHtml,
          conteudo_texto: conteudoTexto,
          origem_tipo: origemTipo,
          origem_id: origemId ? String(origemId) : null,
          chave,
          atualizado_em: new Date().toISOString(),
          expira_em: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "usuario_id,chave" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setStatusSalvamento("temporario");
      setUltimoSalvamento(new Date());
      void queryClient.invalidateQueries({ queryKey: ["laudos-temporarios", medicoId] });
    },
    onError: (error) => {
      setStatusSalvamento("erro");
      toast.error(`Não foi possível salvar o temporário: ${(error as Error).message}`);
    },
  });

  useEffect(() => {
    if (alterado) setStatusSalvamento("alterado");
  }, [alterado]);

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (!podeEditar || salvar.isPending) return;
      if (!alterado) {
        setStatusSalvamento("salvo");
        return;
      }
      setStatusSalvamento("salvando");
      salvar.mutate();
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [alterado, podeEditar, salvar]);

  useEffect(() => {
    if (!autosaveAtivo || !alterado || !podeEditar || salvarTemporario.isPending) return;
    const timer = window.setTimeout(() => {
      setStatusSalvamento("salvando");
      salvarTemporario.mutate();
    }, 60_000);
    return () => window.clearTimeout(timer);
  }, [alterado, autosaveAtivo, podeEditar, salvarTemporario]);

  const analisarLaudo = useMutation({
    mutationFn: async () => {
      const conteudo = editorRef.current?.innerText.trim() ?? "";
      if (!conteudo) throw new Error("Não há laudo para analisar.");
      if (conteudo.length > 20_000) {
        throw new Error("O laudo excede o limite de 20.000 caracteres para análise.");
      }
      return analisarLaudoComIA({ data: { medicoId, documentoId, conteudo } });
    },
    onSuccess: (resultado) => {
      setResultadoAnalise(resultado);
      setErroAnalise(null);
    },
    onError: (error) => setErroAnalise((error as Error).message),
  });

  const aplicarComando = useCallback((comando: string, valor?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (ultimaSelecao.current && selection) {
      selection.removeAllRanges();
      selection.addRange(ultimaSelecao.current);
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(comando, false, valor);
    const conteudo = sanitizarHtmlLaudo(editor.innerHTML);
    setHtml(conteudo);
    setAlterado(true);
    const current = window.getSelection();
    if (current?.rangeCount && editor.contains(current.anchorNode)) {
      ultimaSelecao.current = current.getRangeAt(0).cloneRange();
    }
  }, []);

  const guardarSelecao = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (editor && selection?.rangeCount && editor.contains(selection.anchorNode)) {
      ultimaSelecao.current = selection.getRangeAt(0).cloneRange();
    }
  }, []);

  const atualizarConteudo = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    setHtml(sanitizarHtmlLaudo(editor.innerHTML));
    setAlterado(true);
    guardarSelecao();
  }, [guardarSelecao]);

  function abrirDocumento(id: string) {
    if (alterado && !window.confirm("Há alterações sem salvar. Descartar e abrir outro laudo?"))
      return;
    const documento = documentos.data?.find((item) => item.id === id);
    if (!documento) return;
    setDocumentoId(id);
    ultimoDocumentoCarregado.current = id;
    setTitulo(documento.titulo);
    const safeHtml = sanitizarHtmlLaudo(documento.conteudo_html);
    setHtml(safeHtml);
    if (editorRef.current) editorRef.current.innerHTML = safeHtml || "<p><br></p>";
    setAlterado(false);
  }

  function novoDocumento() {
    if (alterado && !window.confirm("Há alterações sem salvar. Descartar e criar um laudo novo?"))
      return;
    setDocumentoId(null);
    ultimoDocumentoCarregado.current = null;
    setTitulo("");
    setHtml("");
    setAlterado(false);
    ultimaSelecao.current = null;
    if (editorRef.current) editorRef.current.innerHTML = "<p><br></p>";
  }

  function expandirAutoTexto(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "F3") return;
    event.preventDefault();
    event.stopPropagation();
    const selection = window.getSelection();
    const editor = editorRef.current;
    if (!selection?.rangeCount || !editor || !selection.isCollapsed) {
      toast.info("Posicione o cursor depois da abreviação do autotexto.");
      return;
    }
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE || !editor.contains(node)) {
      toast.info("Digite a abreviação e pressione F3.");
      return;
    }
    const texto = node.textContent ?? "";
    const antes = texto.slice(0, range.startOffset);
    const match = antes.match(/([\p{L}\p{N}_-]+)$/u);
    if (!match) {
      toast.info("Digite a abreviação do autotexto imediatamente antes do cursor.");
      return;
    }
    const abreviacao = match[1];
    const autotexto = autotextosDisponiveis.find(
      (item) => normalizarAtalho(item.abreviacao) === normalizarAtalho(abreviacao),
    );
    if (!autotexto) {
      toast.info(`Nenhum autotexto disponível corresponde a “${abreviacao}”.`);
      return;
    }

    const substituicao = document.createRange();
    substituicao.setStart(node, range.startOffset - abreviacao.length);
    substituicao.setEnd(node, range.startOffset);
    selection.removeAllRanges();
    selection.addRange(substituicao);
    const htmlSeguro = sanitizarHtmlLaudo(autotexto.conteudo_html);
    document.execCommand("insertHTML", false, htmlSeguro);
    editor.focus();
    atualizarConteudo();
  }

  async function adicionarFonte(file?: File) {
    if (!file) return;
    try {
      if (!podeGerenciarFontes || !sessao)
        throw new Error("Somente administradores autorizados podem adicionar fontes.");
      if (!file.name.toLowerCase().endsWith(".ttf")) throw new Error("Selecione um arquivo .ttf.");
      if (file.size > 3 * 1024 * 1024) throw new Error("A fonte excede o limite de 3 MB.");
      const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      const valid =
        (signature[0] === 0 && signature[1] === 1 && signature[2] === 0 && signature[3] === 0) ||
        new TextDecoder().decode(signature) === "true" ||
        new TextDecoder().decode(signature) === "typ1";
      if (!valid) throw new Error("O conteúdo do arquivo não tem uma assinatura TTF reconhecida.");
      const familia = file.name
        .replace(/\.ttf$/i, "")
        .replaceAll(/[-_]+/g, " ")
        .trim();
      if (!familia || !/^[\p{L}\p{N} _-]{1,80}$/u.test(familia)) {
        throw new Error("O nome do arquivo não permite criar uma família de fonte segura.");
      }
      if (
        (fontes.data ?? []).some((fonte) => fonte.familia.toLowerCase() === familia.toLowerCase())
      ) {
        throw new Error(`A fonte “${familia}” já está cadastrada.`);
      }
      const caminho = `${crypto.randomUUID()}-${file.name.replaceAll(/[^\p{L}\p{N}._-]/gu, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("laudos-fontes")
        .upload(caminho, file, { contentType: "font/ttf", upsert: false });
      if (uploadError) throw uploadError;
      const { error: metadataError } = await db.from("laudos_fontes").insert({
        familia,
        caminho_storage: caminho,
        formato: "ttf",
        criado_por: sessao.userId,
      });
      if (metadataError) {
        await supabase.storage.from("laudos-fontes").remove([caminho]);
        throw metadataError;
      }
      toast.success(`Fonte ${familia} adicionada ao editor.`);
      void queryClient.invalidateQueries({ queryKey: ["laudos-fontes"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      if (inputFonteRef.current) inputFonteRef.current.value = "";
    }
  }

  async function exportarDocx() {
    try {
      const safeHtml = sanitizarHtmlLaudo(editorRef.current?.innerHTML ?? html);
      if (!safeHtml.trim()) throw new Error("O laudo está vazio.");
      const blob = await gerarDocxLaudo(titulo || "Laudo", safeHtml, fonteAtual);
      const nome = (titulo || "laudo").replaceAll(/[\\/:*?"<>|]+/g, "-").trim();
      baixarBlob(blob, `${nome || "laudo"}.docx`);
      toast.success("Arquivo DOCX gerado.");
    } catch (error) {
      toast.error(`Não foi possível gerar o DOCX: ${(error as Error).message}`);
    }
  }

  async function copiarParaClinux() {
    const editor = editorRef.current;
    if (!editor || !editor.innerText.trim()) {
      toast.info("Digite o conteúdo do laudo antes de copiar para o Clinux.");
      return;
    }
    const safeHtml = sanitizarHtmlLaudo(editor.innerHTML);
    const texto = editor.innerText;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([safeHtml], { type: "text/html" }),
            "text/plain": new Blob([texto], { type: "text/plain" }),
          }),
        ]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const copiado = document.execCommand("copy");
        if (!copiado) throw new Error("A cópia foi bloqueada pelo navegador.");
      }
      toast.success("Laudo copiado com formatação. Agora cole no Clinux.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o conteúdo e use Ctrl+C ou ⌘C.");
    }
  }

  function abrirAnaliseAssistiva() {
    const conteudo = editorRef.current?.innerText.trim() ?? "";
    if (!conteudo) {
      toast.info("Não há laudo para analisar.");
      return;
    }
    setResultadoAnalise(null);
    setErroAnalise(null);
    analisarLaudo.reset();
    setAnaliseDialogAberto(true);
  }

  async function copiarAnalise() {
    if (!resultadoAnalise) return;
    const texto = [
      `Resumo: ${resultadoAnalise.resumo}`,
      "Pontos de atenção:",
      ...resultadoAnalise.pontosAtencao.map((item) => `- ${item}`),
      "Possibilidades (não conclusivas):",
      ...resultadoAnalise.possibilidades.map(
        (item) => `- ${item.descricao} (${item.nivelIncerteza}): ${item.justificativa}`,
      ),
      "Limitações:",
      ...resultadoAnalise.limitacoes.map((item) => `- ${item}`),
      "Perguntas para revisão médica:",
      ...resultadoAnalise.perguntasParaRevisao.map((item) => `- ${item}`),
      "Atenção: análise auxiliar por IA; não representa diagnóstico definitivo nem substitui a avaliação médica.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Sugestão consultiva copiada.");
    } catch {
      toast.error("Não foi possível copiar a sugestão.");
    }
  }

  function limparTextoLaudo() {
    const editor = editorRef.current;
    if (!editor || !editor.innerText.trim()) {
      toast.info("O texto do laudo já está vazio.");
      return;
    }
    if (
      !window.confirm("Limpar todo o texto digitado neste laudo? Esta ação não pode ser desfeita.")
    )
      return;
    editor.innerHTML = "<p><br></p>";
    setHtml("");
    setAlterado(true);
    ultimaSelecao.current = null;
    editor.focus();
    toast.success("Texto do laudo limpo.");
  }

  function inserirQuebraDePagina() {
    aplicarComando("insertHTML", '<p style="break-before:page;page-break-before:always"><br></p>');
  }

  function toolbarButton(label: string, icon: React.ReactNode, action: () => void) {
    return (
      <Button
        key={label}
        type="button"
        variant="outline"
        size="icon"
        className="size-9 shrink-0"
        title={label}
        aria-label={label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={action}
      >
        {icon}
      </Button>
    );
  }

  if (!carregandoSessao && !temModulo("laudos")) {
    return (
      <AppShell titulo="Abrir Laudo">
        <div className="card-superficie max-w-md p-6 text-sm">Você não tem acesso a esta área.</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo={modoBiblioteca ? "Abrir conteúdo" : "Abrir Laudo"}
      descricao={
        modoBiblioteca
          ? "Editor Word interno da biblioteca do médico"
          : "Editor vinculado à pasta do médico selecionado"
      }
    >
      <div className="laudos-editor-screen space-y-4">
        <div className="laudos-editor-controls flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild type="button" variant="outline" size="sm">
              <Link to="/laudos">
                <ArrowLeft className="mr-2 size-4" /> Voltar à biblioteca
              </Link>
            </Button>
            <Badge variant="secondary" className="h-8 px-3">
              {medico.isLoading
                ? "Carregando médico…"
                : (medico.data?.nome ?? "Médico indisponível")}
            </Badge>
            {medico.data?.crm && (
              <span className="text-xs text-muted-foreground">CRM {medico.data.crm}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!modoBiblioteca && (
              <>
                <select
                  aria-label="Abrir laudo salvo"
                  className="h-9 max-w-[250px] rounded-md border border-input bg-background px-2 text-sm"
                  value={documentoId ?? "novo"}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "novo") novoDocumento();
                    else abrirDocumento(value);
                  }}
                >
                  <option value="novo">Novo laudo</option>
                  {(documentos.data ?? []).map((documento) => (
                    <option key={documento.id} value={documento.id}>
                      {documento.titulo}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={novoDocumento}>
                  <FilePlus2 className="mr-1.5 size-4" /> Novo
                </Button>
              </>
            )}
            {modoBiblioteca && <Badge variant="secondary">Biblioteca</Badge>}
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setStatusSalvamento("salvando");
                salvar.mutate();
              }}
              disabled={!podeEditar || salvar.isPending}
            >
              <Save className="mr-1.5 size-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={abrirAnaliseAssistiva}
              disabled={!medico.data || analisarLaudo.isPending}
            >
              <BrainCircuit className="mr-1.5 size-4" /> Analisar com IA
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCalculadoraAberta(true)}
            >
              <Calculator className="mr-1.5 size-4" /> Calculadora
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportarDocx}>
              <FileDown className="mr-1.5 size-4" /> DOCX
            </Button>
            <Button
              type="button"
              variant={clinuxPulsando ? "default" : "outline"}
              size="sm"
              className={
                clinuxPulsando
                  ? "animate-pulse bg-blue-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-300/70 hover:bg-blue-700"
                  : ""
              }
              style={clinuxPulsando ? { animationDuration: "850ms" } : undefined}
              onClick={() => {
                setClinuxPulsando(false);
                void copiarParaClinux();
              }}
            >
              <ClipboardCheck className="mr-1.5 size-4" /> Copiar Para Clinux
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={limparTextoLaudo}>
              <Trash2 className="mr-1.5 size-4" /> Limpar texto
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-4" /> PDF / Imprimir
            </Button>
          </div>
        </div>

        {medico.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !medico.data ? (
          <div className="card-superficie p-6 text-sm text-destructive">
            O médico não foi encontrado ou não está incluído na biblioteca de Laudos.
          </div>
        ) : (
          <>
            <section className="laudos-editor-controls card-superficie space-y-3 p-3">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/70 pb-3">
                <label className="sr-only" htmlFor="laudo-titulo">
                  Nome do laudo
                </label>
                <Input
                  id="laudo-titulo"
                  className="max-w-md"
                  value={titulo}
                  onChange={(event) => {
                    setTitulo(event.target.value);
                    setAlterado(true);
                  }}
                  placeholder="Nome do laudo/documento"
                  disabled={!podeEditar}
                />
                <span className="text-xs text-muted-foreground">
                  {statusSalvamento === "salvando" && "Salvando…"}
                  {statusSalvamento === "alterado" && "Alterações não salvas"}
                  {statusSalvamento === "erro" && "Erro ao salvar"}
                  {statusSalvamento === "temporario" && "Rascunho temporário salvo"}
                  {statusSalvamento === "salvo" &&
                    `Salvo${ultimoSalvamento ? ` às ${ultimoSalvamento.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}`}
                </span>
                <Button
                  type="button"
                  variant={autosaveAtivo ? "secondary" : "outline"}
                  size="sm"
                  className="h-7"
                  onClick={() => setAutosaveAtivo((ativo) => !ativo)}
                  title="Salvar rascunho temporário automaticamente a cada 1 minuto. Retenção: 5 dias."
                >
                  <Cloud className="mr-1.5 size-3.5" />
                  Temporário: {autosaveAtivo ? "1 min" : "desligado"}
                </Button>
                {(statusSalvamento === "salvo" || statusSalvamento === "temporario") && (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                )}
                {statusSalvamento === "erro" && <CircleAlert className="size-4 text-destructive" />}
                {autotextosDisponiveis.length ? (
                  <Badge variant="outline">{autotextosDisponiveis.length} autotexto(s) · F3</Badge>
                ) : (
                  <Badge variant="outline">Sem autotextos cadastrados</Badge>
                )}
                {!modoBiblioteca && (
                  <Button
                    type="button"
                    variant={medicoAutotextoEmprestadoId ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setEmprestimoDialogAberto(true)}
                  >
                    <UserRound className="mr-1.5 size-4" />
                    {medicoAutotextoEmprestadoId
                      ? "Autotexto emprestado"
                      : "Usar autotexto emprestado"}
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Fonte"
                  className="h-9 w-40 rounded-md border border-input bg-background px-2 text-sm"
                  value={fonteAtual}
                  onMouseDown={guardarSelecao}
                  onChange={(event) => {
                    setFonteAtual(event.target.value);
                    aplicarComando("fontName", event.target.value);
                  }}
                >
                  {familiasFonte.map((family) => (
                    <option key={family} value={family} style={{ fontFamily: family }}>
                      {family}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Tamanho da fonte"
                  className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
                  value={tamanhoAtual}
                  onMouseDown={guardarSelecao}
                  onChange={(event) => {
                    const size = event.target.value;
                    setTamanhoAtual(size);
                    const editor = editorRef.current;
                    if (!editor) return;
                    editor.focus();
                    const selection = window.getSelection();
                    if (ultimaSelecao.current && selection) {
                      selection.removeAllRanges();
                      selection.addRange(ultimaSelecao.current);
                    }
                    document.execCommand("styleWithCSS", false, "false");
                    document.execCommand("fontSize", false, "7");
                    editor.querySelectorAll('font[size="7"]').forEach((element) => {
                      element.removeAttribute("size");
                      (element as HTMLElement).style.fontSize = size;
                    });
                    atualizarConteudo();
                  }}
                >
                  {TAMANHOS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Cor do texto"
                  type="color"
                  className="size-9 cursor-pointer rounded border border-input bg-background p-1"
                  title="Cor do texto"
                  onMouseDown={guardarSelecao}
                  onChange={(event) => aplicarComando("foreColor", event.target.value)}
                />
                <Button
                  type="button"
                  variant={mostrarMarcas ? "secondary" : "outline"}
                  size="icon"
                  className="size-9 shrink-0"
                  title={
                    mostrarMarcas ? "Ocultar marcas de formatação" : "Mostrar marcas de formatação"
                  }
                  aria-label={
                    mostrarMarcas ? "Ocultar marcas de formatação" : "Mostrar marcas de formatação"
                  }
                  aria-pressed={mostrarMarcas}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setMostrarMarcas((visible) => !visible)}
                >
                  <Pilcrow className="size-4" />
                </Button>
                <div className="mx-1 h-7 border-l border-border" />
                {toolbarButton("Negrito", <Bold className="size-4" />, () =>
                  aplicarComando("bold"),
                )}
                {toolbarButton("Itálico", <Italic className="size-4" />, () =>
                  aplicarComando("italic"),
                )}
                {toolbarButton("Sublinhado", <Underline className="size-4" />, () =>
                  aplicarComando("underline"),
                )}
                <div className="mx-1 h-7 border-l border-border" />
                {toolbarButton("Alinhar à esquerda", <AlignLeft className="size-4" />, () =>
                  aplicarComando("justifyLeft"),
                )}
                {toolbarButton("Centralizar", <AlignCenter className="size-4" />, () =>
                  aplicarComando("justifyCenter"),
                )}
                {toolbarButton("Alinhar à direita", <AlignRight className="size-4" />, () =>
                  aplicarComando("justifyRight"),
                )}
                {toolbarButton("Justificar", <AlignJustify className="size-4" />, () =>
                  aplicarComando("justifyFull"),
                )}
                {toolbarButton("Lista com marcadores", <List className="size-4" />, () =>
                  aplicarComando("insertUnorderedList"),
                )}
                {toolbarButton("Lista numerada", <ListOrdered className="size-4" />, () =>
                  aplicarComando("insertOrderedList"),
                )}
                <select
                  aria-label="Espaçamento entre linhas"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  defaultValue="1.5"
                  onMouseDown={guardarSelecao}
                  onChange={(event) => {
                    const editor = editorRef.current;
                    const selection = window.getSelection();
                    const node = selection?.anchorNode;
                    const block =
                      node instanceof HTMLElement
                        ? node.closest("p,div,li")
                        : node?.parentElement?.closest("p,div,li");
                    if (block && editor?.contains(block)) {
                      (block as HTMLElement).style.lineHeight = event.target.value;
                      atualizarConteudo();
                    }
                  }}
                >
                  <option value="1">Espaço simples</option>
                  <option value="1.15">1,15</option>
                  <option value="1.5">1,5</option>
                  <option value="2">Duplo</option>
                </select>
                {toolbarButton("Diminuir recuo", <span aria-hidden="true">⇤</span>, () =>
                  aplicarComando("outdent"),
                )}
                {toolbarButton("Aumentar recuo", <span aria-hidden="true">⇥</span>, () =>
                  aplicarComando("indent"),
                )}
                {toolbarButton("Desfazer", <Undo2 className="size-4" />, () =>
                  aplicarComando("undo"),
                )}
                {toolbarButton("Refazer", <Redo2 className="size-4" />, () =>
                  aplicarComando("redo"),
                )}
                {toolbarButton("Copiar", <Copy className="size-4" />, () => aplicarComando("copy"))}
                {toolbarButton("Recortar", <Scissors className="size-4" />, () =>
                  aplicarComando("cut"),
                )}
                {toolbarButton("Colar texto", <Clipboard className="size-4" />, async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    aplicarComando("insertText", text);
                  } catch {
                    toast.info("Use Ctrl+V ou ⌘V para colar do clipboard.");
                  }
                })}
                {toolbarButton("Selecionar tudo", <span aria-hidden="true">☷</span>, () =>
                  aplicarComando("selectAll"),
                )}
                {toolbarButton(
                  "Quebra de página",
                  <span aria-hidden="true">↵</span>,
                  inserirQuebraDePagina,
                )}
                {podeGerenciarFontes && (
                  <>
                    <input
                      ref={inputFonteRef}
                      type="file"
                      accept=".ttf,font/ttf"
                      className="hidden"
                      aria-label="Selecionar arquivo de fonte TTF"
                      onChange={(event) => void adicionarFonte(event.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => inputFonteRef.current?.click()}
                    >
                      Adicionar fonte
                    </Button>
                  </>
                )}
              </div>
            </section>

            <section className="laudos-printable card-superficie mx-auto min-h-[820px] max-w-[900px] p-6 sm:p-10 lg:p-14">
              <header className="mb-6 border-b border-border/60 pb-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Clínica CEU · Laudos
                </p>
                <h1 className="mt-2 text-xl font-semibold">{medico.data.nome}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[
                    medico.data.especialidade_principal,
                    medico.data.crm && `CRM ${medico.data.crm}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {titulo.trim() && <h2 className="mt-3 text-lg font-semibold">{titulo}</h2>}
              </header>
              <div
                ref={editorRef}
                className={`laudo-rich-editor min-h-[600px] outline-none${mostrarMarcas ? " laudo-rich-editor--show-marks" : ""}`}
                contentEditable={podeEditar}
                suppressContentEditableWarning
                role="textbox"
                aria-label="Conteúdo do laudo"
                aria-multiline="true"
                spellCheck
                onInput={atualizarConteudo}
                onKeyUp={guardarSelecao}
                onMouseUp={guardarSelecao}
                onKeyDown={expandirAutoTexto}
                onPaste={(event) => {
                  event.preventDefault();
                  const pastedHtml = event.clipboardData.getData("text/html");
                  const plain = event.clipboardData.getData("text/plain");
                  const safe = pastedHtml
                    ? sanitizarHtmlLaudo(pastedHtml)
                    : plain.replaceAll("\n", "<br>");
                  aplicarComando("insertHTML", safe);
                }}
                data-placeholder="Digite o laudo. Digite uma abreviação de autotexto e pressione F3 para expandi-la."
              />
              {!podeEditar && (
                <p className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  Sua sessão está em modo de leitura. Não é possível editar ou salvar este laudo.
                </p>
              )}
            </section>
          </>
        )}
      </div>
      {calculadoraAberta && (
        <div className="pointer-events-none fixed inset-0 z-40">
          <section
            className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
            style={
              calculadoraJanela.maximizada
                ? { left: 12, top: 12, width: "calc(100vw - 24px)", height: "calc(100vh - 24px)" }
                : {
                    left: calculadoraJanela.x,
                    top: calculadoraJanela.y,
                    width: `min(${calculadoraJanela.width}px, calc(100vw - 16px))`,
                    height: calculadoraJanela.minimizada ? 58 : calculadoraJanela.height,
                  }
            }
          >
            <header
              className="flex shrink-0 cursor-move select-none items-center justify-between gap-3 border-b bg-background px-4 py-3"
              onPointerDown={iniciarArrasteCalculadora}
            >
              <div>
                <h2 className="font-semibold">Calculadora</h2>
                {!calculadoraJanela.minimizada && (
                  <p className="text-xs text-muted-foreground">
                    O laudo continua acessível ao lado. Faça o cálculo e clique no laudo para
                    digitar.
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Minimizar"
                  aria-label="Minimizar calculadora"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() =>
                    setCalculadoraJanela((atual) => ({ ...atual, minimizada: !atual.minimizada }))
                  }
                >
                  <Minimize2 className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title={calculadoraJanela.maximizada ? "Restaurar" : "Maximizar"}
                  aria-label={
                    calculadoraJanela.maximizada ? "Restaurar calculadora" : "Maximizar calculadora"
                  }
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() =>
                    setCalculadoraJanela((atual) => ({
                      ...atual,
                      maximizada: !atual.maximizada,
                      minimizada: false,
                    }))
                  }
                >
                  <Maximize2 className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Fechar"
                  aria-label="Fechar calculadora"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setCalculadoraAberta(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </header>
            {!calculadoraJanela.minimizada && (
              <iframe
                title="Calculadora fetal, Hadlock e Doppler"
                src="/calculadora-gestacional?dentroDoLaudo=1"
                className="min-h-0 flex-1 border-0"
              />
            )}
            {!calculadoraJanela.maximizada && !calculadoraJanela.minimizada && (
              <div
                className="absolute bottom-0 right-0 size-5 cursor-se-resize"
                onPointerDown={iniciarRedimensionamentoCalculadora}
                aria-label="Redimensionar calculadora"
              />
            )}
          </section>
        </div>
      )}
      <Dialog open={emprestimoDialogAberto} onOpenChange={setEmprestimoDialogAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Usar autotexto emprestado</DialogTitle>
            <DialogDescription>
              Escolha um médico para disponibilizar os autotextos dele somente neste laudo. Eles não
              serão copiados nem alterados na biblioteca do médico atual.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {medicosComAutotexto.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : medicosComAutotexto.data?.length ? (
              medicosComAutotexto.data.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40 ${
                    medicoAutotextoEmprestadoId === item.id ? "border-primary bg-accent/50" : ""
                  }`}
                  onClick={() => {
                    setMedicoAutotextoEmprestadoId(item.id);
                    setEmprestimoDialogAberto(false);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.quantidade} autotexto(s) disponível(is)
                    </span>
                  </span>
                  <UserRound className="ml-3 size-4 shrink-0 text-primary" />
                </button>
              ))
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhum outro médico possui autotextos cadastrados.
              </p>
            )}
          </div>
          <DialogFooter>
            {medicoAutotextoEmprestadoId !== null && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMedicoAutotextoEmprestadoId(null);
                  setEmprestimoDialogAberto(false);
                }}
              >
                Remover empréstimo
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmprestimoDialogAberto(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={analiseDialogAberto}
        onOpenChange={(aberto) => {
          if (analisarLaudo.isPending) return;
          setAnaliseDialogAberto(aberto);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Análise assistiva do laudo</DialogTitle>
            <DialogDescription>
              Médico selecionado: {medico.data?.nome ?? "—"}. A análise só começará após sua
              confirmação explícita abaixo.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Atenção — uso exclusivamente consultivo</AlertTitle>
            <AlertDescription>
              Esta é uma análise auxiliar gerada por inteligência artificial. Ela pode conter erros,
              omissões ou interpretações inadequadas. Não representa diagnóstico definitivo, não
              substitui a avaliação médica e não deve ser usada isoladamente para decidir condutas.
              O médico responsável deve revisar o laudo completo, confirmar os achados e definir o
              diagnóstico final.
            </AlertDescription>
          </Alert>

          <p className="text-sm text-muted-foreground">
            Se você confirmar, somente o texto deste laudo será enviado à API da OpenAI configurada
            no servidor para processamento. A resposta será exibida aqui e não será inserida nem
            salva no laudo.
          </p>

          {analisarLaudo.isPending && (
            <div className="rounded-md border p-4 text-sm" role="status" aria-live="polite">
              Analisando o laudo… aguarde. O texto original permanece inalterado.
            </div>
          )}

          {erroAnalise && (
            <div
              className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive"
              role="alert"
            >
              {erroAnalise}
            </div>
          )}

          {resultadoAnalise && (
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold">Resumo objetivo dos achados</h3>
                <p className="mt-1 whitespace-pre-wrap">{resultadoAnalise.resumo}</p>
              </section>
              <section>
                <h3 className="font-semibold">Pontos que merecem atenção ou correlação clínica</h3>
                {resultadoAnalise.pontosAtencao.length ? (
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {resultadoAnalise.pontosAtencao.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-muted-foreground">Nenhum ponto adicional apontado.</p>
                )}
              </section>
              <section>
                <h3 className="font-semibold">Possíveis interpretações / diferenciais</h3>
                {resultadoAnalise.possibilidades.length ? (
                  <ul className="mt-1 space-y-2">
                    {resultadoAnalise.possibilidades.map((item, index) => (
                      <li key={index} className="rounded-md border p-3">
                        <p className="font-medium">
                          {item.descricao} · incerteza {item.nivelIncerteza}
                        </p>
                        <p className="mt-1 text-muted-foreground">{item.justificativa}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    O texto não oferece suporte suficiente para sugerir hipóteses.
                  </p>
                )}
              </section>
              <section>
                <h3 className="font-semibold">Limitações</h3>
                {resultadoAnalise.limitacoes.length ? (
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {resultadoAnalise.limitacoes.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    Nenhuma limitação adicional apontada.
                  </p>
                )}
              </section>
              <section>
                <h3 className="font-semibold">Perguntas ou verificações para revisão médica</h3>
                {resultadoAnalise.perguntasParaRevisao.length ? (
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {resultadoAnalise.perguntasParaRevisao.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-muted-foreground">Nenhuma pergunta adicional apontada.</p>
                )}
              </section>
            </div>
          )}

          <DialogFooter>
            {resultadoAnalise ? (
              <Button type="button" variant="outline" onClick={() => void copiarAnalise()}>
                <Copy className="mr-1.5 size-4" /> Copiar sugestão
              </Button>
            ) : !analisarLaudo.isPending ? (
              <Button type="button" onClick={() => analisarLaudo.mutate()}>
                <BrainCircuit className="mr-1.5 size-4" /> Confirmar e analisar
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={analisarLaudo.isPending}
              onClick={() => setAnaliseDialogAberto(false)}
            >
              {resultadoAnalise ? "Fechar" : "Cancelar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
