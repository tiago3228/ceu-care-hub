import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/lixeira")({
  head: () => ({
    meta: [
      { title: "Lixeira | Clínica CEU" },
      {
        name: "description",
        content: "Registros excluídos, disponíveis para restauração por 7 dias.",
      },
      { property: "og:title", content: "Lixeira | Clínica CEU" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaLixeira,
});

type RegistroLixeira = {
  id: string;
  tabela: string;
  registro_id: string;
  dados: Record<string, unknown>;
  excluido_em: string;
  expira_em: string;
  restaurado_em: string | null;
};

const NOMES_TABELAS: Record<string, string> = {
  itens: "Itens e materiais",
  lotes: "Lotes",
  movimentacoes_estoque: "Movimentações de estoque",
  colaboradoras: "Colaboradoras",
  medicos: "Médicos",
  salas: "Salas de exame",
  escalas: "Escalas",
  pacientes: "Pacientes",
  atendimentos_enfermagem: "Atendimentos de enfermagem",
  notas: "Notas",
  solicitacoes: "Solicitações",
};

function dataHora(valor: string) {
  return new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function resumo(dados: Record<string, unknown>) {
  const nome = dados.nome ?? dados.descricao ?? dados.titulo ?? dados.codigo;
  if (nome) return String(nome);
  return Object.entries(dados)
    .filter(([chave]) => !["id", "created_at", "updated_at"].includes(chave))
    .slice(0, 2)
    .map(([chave, valor]) => `${chave}: ${String(valor ?? "—")}`)
    .join(" • ");
}

function PaginaLixeira() {
  const { temModulo, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");

  const registros = useQuery({
    queryKey: ["lixeira"],
    queryFn: async () => {
      // A tabela e a função são criadas pela migration e ainda não aparecem nos tipos gerados.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("lixeira_registros")
        .select("id, tabela, registro_id, dados, excluido_em, expira_em, restaurado_em")
        .is("restaurado_em", null)
        .order("excluido_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RegistroLixeira[];
    },
  });

  const restaurar = useMutation({
    mutationFn: async (id: string) => {
      // A função é criada pela migration e ainda não aparece nos tipos gerados.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("restaurar_lixeira", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro restaurado.");
      queryClient.invalidateQueries({ queryKey: ["lixeira"] });
      queryClient.invalidateQueries({ queryKey: ["itens"] });
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const lista = (registros.data ?? []).filter((registro) => {
    const termo = busca.trim().toLowerCase();
    return (
      !termo ||
      (NOMES_TABELAS[registro.tabela] ?? registro.tabela).toLowerCase().includes(termo) ||
      resumo(registro.dados).toLowerCase().includes(termo)
    );
  });

  if (!carregandoSessao && !temModulo("lixeira")) {
    return (
      <AppShell titulo="Lixeira">
        <div className="card-superficie max-w-md p-6 text-sm">Você não tem acesso à lixeira.</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Lixeira"
      descricao="Os registros permanecem disponíveis para restauração por 7 dias."
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar na lixeira"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Badge variant="outline">{lista.length} registro(s)</Badge>
      </div>

      {registros.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((registro) => (
            <article
              key={registro.id}
              className="card-superficie flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-foreground">
                    {NOMES_TABELAS[registro.tabela] ?? registro.tabela}
                  </h2>
                  <Badge variant="destructive" className="text-[10px]">
                    Excluído
                  </Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">{resumo(registro.dados)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Excluído em {dataHora(registro.excluido_em)} · expira em{" "}
                  {dataHora(registro.expira_em)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={restaurar.isPending}
                onClick={() => restaurar.mutate(registro.id)}
              >
                <RotateCcw className="mr-1.5 size-4" /> Restaurar
              </Button>
            </article>
          ))}
          {!lista.length && (
            <div className="card-superficie flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <Trash2 className="size-8" />A lixeira está vazia.
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
