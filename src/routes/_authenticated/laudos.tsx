import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  BookOpenText,
  CircleHelp,
  ClipboardList,
  Search,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// O campo setor foi introduzido por migration e ainda não consta nos tipos gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/laudos")({
  head: () => ({
    meta: [
      { title: "Laudos | Clínica CEU" },
      {
        name: "description",
        content: "Área de laudos organizada por médico, com espaço para orientações de ajuda.",
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
  setor: string | null;
}

function nomeSetor(setor: string | null) {
  if (setor === "enfermagem") return "Enfermagem";
  if (setor === "operacao") return "Salas";
  return setor
    ? setor.charAt(0).toLocaleUpperCase("pt-BR") + setor.slice(1)
    : "Setor não informado";
}

function PaginaLaudos() {
  const { temModulo, isLoading: carregandoSessao } = useSessao();
  const [busca, setBusca] = useState("");
  const [medicoSelecionadoId, setMedicoSelecionadoId] = useState<number | null>(null);

  const medicos = useQuery({
    queryKey: ["laudos-medicos"],
    enabled: !carregandoSessao && temModulo("salas"),
    retry: 1,
    queryFn: async () => {
      const { data, error } = await db
        .from("medicos")
        .select(
          "id,nome,apelido,crm,especialidade_principal,especialidades,procedimentos,observacoes,ativo,setor",
        )
        .order("nome");
      if (error) throw error;
      return (data ?? []) as MedicoLaudos[];
    },
  });

  const lista = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return (medicos.data ?? []).filter(
      (medico) =>
        !termo ||
        [medico.nome, medico.apelido, medico.crm, medico.especialidade_principal, medico.setor]
          .filter(Boolean)
          .some((valor) => valor!.toLocaleLowerCase("pt-BR").includes(termo)),
    );
  }, [medicos.data, busca]);

  const medicoSelecionado =
    lista.find((medico) => medico.id === medicoSelecionadoId) ??
    (medicoSelecionadoId === null ? lista[0] : undefined);

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
    <AppShell titulo="Laudos" descricao="Organize os laudos e orientações por médico">
      <div className="grid min-h-[560px] gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.7fr)]">
        <section className="card-superficie flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-border/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Médicos</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {medicos.data?.length ?? 0} profissional(is) no sistema
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
                placeholder="Buscar médico, CRM ou especialidade"
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
                  <Button
                    key={medico.id}
                    type="button"
                    variant="ghost"
                    className={`h-auto w-full justify-start whitespace-normal p-3 text-left ${
                      selecionado ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                    }`}
                    aria-pressed={selecionado}
                    onClick={() => setMedicoSelecionadoId(medico.id)}
                  >
                    <span className="mr-3 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Stethoscope className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{medico.nome}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{nomeSetor(medico.setor)}</span>
                        {medico.especialidade_principal && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{medico.especialidade_principal}</span>
                          </>
                        )}
                      </span>
                    </span>
                    <Badge
                      variant={medico.ativo ? "outline" : "secondary"}
                      className="ml-2 shrink-0 text-[10px]"
                    >
                      {medico.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </Button>
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
                  <UserRound className="size-7" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">
                      {medicoSelecionado.nome}
                    </h2>
                    {medicoSelecionado.ativo ? (
                      <Badge variant="outline" className="gap-1">
                        <BadgeCheck className="size-3.5" /> Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[
                      medicoSelecionado.apelido,
                      medicoSelecionado.crm && `CRM ${medicoSelecionado.crm}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Cadastro médico"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{nomeSetor(medicoSelecionado.setor)}</Badge>
                    {medicoSelecionado.especialidade_principal && (
                      <Badge variant="outline">{medicoSelecionado.especialidade_principal}</Badge>
                    )}
                  </div>
                </div>
              </header>

              <Tabs defaultValue="resumo" className="flex min-h-0 flex-1 flex-col">
                <div className="border-b border-border/70 px-4 sm:px-6">
                  <TabsList className="h-auto justify-start gap-1 rounded-none bg-transparent p-0">
                    <TabsTrigger
                      value="resumo"
                      className="gap-2 rounded-none border-b-2 border-transparent px-3 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent"
                    >
                      <BookOpenText className="size-4" /> Resumo
                    </TabsTrigger>
                    <TabsTrigger
                      value="ajuda"
                      className="gap-2 rounded-none border-b-2 border-transparent px-3 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent"
                    >
                      <CircleHelp className="size-4" /> AJUDA
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="resumo" className="m-0 flex-1 overflow-y-auto p-5 sm:p-6">
                  <div className="mb-5 flex items-center gap-2">
                    <ClipboardList className="size-5 text-primary" />
                    <h3 className="font-semibold">Resumo do médico</h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Especialidade principal
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {medicoSelecionado.especialidade_principal || "Não informada"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Setor
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {nomeSetor(medicoSelecionado.setor)}
                      </p>
                    </div>
                  </div>
                  {medicoSelecionado.especialidades && (
                    <div className="mt-4 rounded-xl border border-border/70 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Especialidades
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                        {medicoSelecionado.especialidades}
                      </p>
                    </div>
                  )}
                  {medicoSelecionado.procedimentos && (
                    <div className="mt-4 rounded-xl border border-border/70 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Procedimentos
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                        {medicoSelecionado.procedimentos}
                      </p>
                    </div>
                  )}
                  {medicoSelecionado.observacoes && (
                    <div className="mt-4 rounded-xl border border-border/70 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Observações cadastradas
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                        {medicoSelecionado.observacoes}
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="ajuda" className="m-0 flex-1 overflow-y-auto p-5 sm:p-6">
                  <div className="mb-5 flex items-center gap-2">
                    <CircleHelp className="size-5 text-primary" />
                    <div>
                      <h3 className="font-semibold">AJUDA · {medicoSelecionado.nome}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Orientações e materiais de apoio deste médico.
                      </p>
                    </div>
                  </div>
                  <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                    <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <BookOpenText className="size-5" />
                    </span>
                    <h4 className="font-medium">Espaço de ajuda preparado</h4>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      As orientações para este médico serão organizadas aqui. A área está pronta
                      para receber os conteúdos que você vai enviar.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
              <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Stethoscope className="size-7" />
              </span>
              <h2 className="text-lg font-semibold">
                {busca ? "Nenhum médico encontrado" : "Selecione um médico"}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {busca
                  ? "Tente outro nome, CRM ou especialidade."
                  : "Escolha um profissional na lista para visualizar o resumo e a aba AJUDA."}
              </p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
