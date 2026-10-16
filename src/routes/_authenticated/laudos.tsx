import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpenText,
  FileText,
  Folder,
  FolderOpen,
  Search,
  Stethoscope,
  Type,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

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

type PastaMedico = "inicio" | "ajuda" | "autotexto";

function chaveNome(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\b(dra?\.?|dr\.?|medico|medica)\b/g, " ")
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

function PaginaLaudos() {
  const { temModulo, isLoading: carregandoSessao } = useSessao();
  const [busca, setBusca] = useState("");
  const [medicoSelecionadoId, setMedicoSelecionadoId] = useState<number | null>(null);
  const [pastaAberta, setPastaAberta] = useState<PastaMedico>("inicio");

  const medicos = useQuery({
    queryKey: ["laudos-medicos"],
    enabled: !carregandoSessao && temModulo("salas"),
    retry: 1,
    queryFn: async () => {
      const { data, error } = await db
        .from("medicos")
        .select(
          "id,nome,apelido,crm,especialidade_principal,especialidades,procedimentos,observacoes,ativo",
        )
        .order("nome");
      if (error) throw error;
      return deduplicarMedicos((data ?? []) as MedicoLaudos[]);
    },
  });

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

  const medicoSelecionado = lista.find((medico) => medico.id === medicoSelecionadoId);

  function abrirMedico(medico: MedicoLaudos) {
    setMedicoSelecionadoId(medico.id);
    setPastaAberta("inicio");
  }

  function abrirPasta(medico: MedicoLaudos, pasta: Exclude<PastaMedico, "inicio">) {
    setMedicoSelecionadoId(medico.id);
    setPastaAberta(pasta);
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
    <AppShell titulo="Laudos" descricao="Uma pasta por médico, com Ajuda e Autotexto">
      <div className="grid min-h-[560px] gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.7fr)]">
        <section className="card-superficie flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-border/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Médicos</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {medicos.data?.length ?? 0} médico(s) sem duplicatas
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {lista.length} exibido(s)
              </Badge>
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

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
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
              lista.map((medico) => {
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
                          <span className="block truncate text-sm font-medium">{medico.nome}</span>
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
                      <ContextMenuItem onSelect={() => abrirPasta(medico, "ajuda")}>
                        <BookOpenText className="mr-2 size-4" /> Ajuda
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => abrirPasta(medico, "autotexto")}>
                        <Type className="mr-2 size-4" /> Autotexto
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })
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
                      ) : (
                        <FileText className="size-5" />
                      )}
                    </span>
                    <div>
                      <h3 className="font-semibold">
                        {pastaAberta === "ajuda" ? "Ajuda" : "Autotexto"}
                      </h3>
                      <p className="text-sm text-muted-foreground">{medicoSelecionado.nome}</p>
                    </div>
                  </div>
                  <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                    <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {pastaAberta === "ajuda" ? (
                        <BookOpenText className="size-5" />
                      ) : (
                        <FileText className="size-5" />
                      )}
                    </span>
                    <h4 className="font-medium">
                      Pasta {pastaAberta === "ajuda" ? "Ajuda" : "Autotexto"} pronta
                    </h4>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      {pastaAberta === "ajuda"
                        ? "As ajudas deste médico serão organizadas aqui quando você enviar o conteúdo."
                        : "Os autotextos deste médico serão organizados aqui quando você enviar o conteúdo."}
                    </p>
                  </div>
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
    </AppShell>
  );
}
