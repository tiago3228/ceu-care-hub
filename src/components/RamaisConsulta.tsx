import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { combina, ordenar, SITUACOES, SITUACOES_LIVRES, tomSituacao, type Ramal } from "@/lib/ramais";

const TODOS = "__todos__";

export function useRamais() {
  return useQuery({
    queryKey: ["ramais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ramais")
        .select("id, numero, setor, responsavel, localizacao, categoria, situacao, observacoes");
      if (error) throw error;
      return ((data ?? []) as Ramal[]).sort(ordenar);
    },
  });
}

/** Área somente de consulta: sem adicionar, editar ou excluir. */
export function RamaisConsulta({ className }: { className?: string }) {
  const ramais = useRamais();
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<string>(TODOS);
  const [categoria, setCategoria] = useState<string>(TODOS);

  const categorias = useMemo(
    () =>
      Array.from(new Set((ramais.data ?? []).map((r) => r.categoria).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [ramais.data],
  );

  const lista = useMemo(
    () =>
      (ramais.data ?? [])
        .filter((r) => combina(r, busca))
        .filter((r) => situacao === TODOS || r.situacao === situacao)
        .filter((r) => categoria === TODOS || r.categoria === categoria),
    [ramais.data, busca, situacao, categoria],
  );

  const livres = lista.filter((r) => SITUACOES_LIVRES.includes(r.situacao));

  return (
    <section className={cn("card-superficie p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Phone className="size-4" /> Ramais
        </h2>
        <p className="text-xs text-muted-foreground">
          {lista.length} ramal(is) · {livres.length} livre(s)
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por número, setor, responsável ou local"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar ramal"
          />
        </div>
        <Select value={situacao} onValueChange={setSituacao}>
          <SelectTrigger className="w-[170px]" aria-label="Filtrar por situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as situações</SelectItem>
            {SITUACOES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-[190px]" aria-label="Filtrar por setor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os setores</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ramais.isLoading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nenhum ramal encontrado.</p>
      ) : (
        <div className="mt-4 max-h-[420px] overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-secondary/70 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Ramal</th>
                <th className="px-3 py-2">Setor</th>
                <th className="hidden px-3 py-2 sm:table-cell">Responsável</th>
                <th className="hidden px-3 py-2 md:table-cell">Localização</th>
                <th className="px-3 py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold text-foreground">{r.numero ?? "—"}</td>
                  <td className="px-3 py-2">{r.setor ?? "—"}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">{r.responsavel ?? "—"}</td>
                  <td className="hidden px-3 py-2 md:table-cell">{r.localizacao ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        tomSituacao(r.situacao),
                      )}
                    >
                      {r.situacao}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
