import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { VERSAO_SISTEMA } from "@/lib/modulos";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre o sistema | Clínica CEU" },
      {
        name: "description",
        content: "Versão, parâmetros e volume de dados migrados do sistema de gestão da Clínica CEU.",
      },
      { property: "og:title", content: "Sobre o sistema | Clínica CEU" },
      {
        property: "og:description",
        content: "Versão e parâmetros do sistema de gestão da Clínica CEU.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaSobre,
});

const TABELAS = [
  ["medicos", "Médicos"],
  ["colaboradoras", "Colaboradoras"],
  ["salas", "Salas"],
  ["escalas", "Escalas"],
  ["escala_base", "Escala base"],
  ["itens", "Itens"],
  ["versiculos", "Versículos"],
] as const;

function PaginaSobre() {
  const contagens = useQuery({
    queryKey: ["contagens-sobre"],
    queryFn: async () => {
      const res = await Promise.all(
        TABELAS.map(async ([tabela]) => {
          const { count } = await supabase
            .from(tabela)
            .select("id", { count: "exact", head: true });
          return [tabela, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(res) as Record<string, number>;
    },
  });

  const config = useQuery({
    queryKey: ["configuracoes-sistema"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes_sistema").select("chave, valor");
      return data ?? [];
    },
  });

  return (
    <AppShell titulo="Sobre o sistema" descricao="Versão web da gestão da Clínica CEU">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-superficie p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Versão
          </h2>
          <p className="mt-3 font-display text-2xl font-semibold">v{VERSAO_SISTEMA}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Migrado do sistema desktop v6.29 (Python/SQLite) preservando os IDs originais dos
            cadastros, escalas e itens.
          </p>
        </section>

        <section className="card-superficie p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Dados migrados
          </h2>
          {contagens.isLoading ? (
            <Skeleton className="mt-4 h-32 w-full" />
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {TABELAS.map(([tabela, rotulo]) => (
                <li key={tabela} className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">{rotulo}</span>
                  <span className="font-medium">{contagens.data?.[tabela] ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-superficie p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Parâmetros do sistema
          </h2>
          {config.isLoading ? (
            <Skeleton className="mt-4 h-20 w-full" />
          ) : config.data?.length ? (
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {config.data.map((c) => (
                <li key={c.chave} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{c.chave}</span>
                  <span className="font-medium">{c.valor ?? "—"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum parâmetro cadastrado ainda (ex.: dias de alerta de validade, horário do
              alerta).
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
