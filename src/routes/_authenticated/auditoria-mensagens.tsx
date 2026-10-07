/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClipboardList, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/auditoria-mensagens")({
  head: () => ({ meta: [{ title: "Auditoria de mensagens | Clínica CEU" }] }),
  component: PaginaAuditoriaMensagens,
});

type Registro = {
  id: string;
  canal: string;
  remetente_id: string;
  destinatario_id: string;
  mensagem: string | null;
  anexo_nome?: string | null;
  criado_em: string;
};
type Perfil = { id: string; nome: string };

function dataHora(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(valor),
  );
}

function PaginaAuditoriaMensagens() {
  const { sessao, isMaster, isLoading } = useSessao();
  const [busca, setBusca] = useState("");
  const [canal, setCanal] = useState("todos");

  const registros = useQuery({
    queryKey: ["auditoria-mensagens"],
    enabled: !!sessao?.userId && isMaster,
    queryFn: async () => {
      const [salas, enfermagem, admin] = await Promise.all([
        (supabase as any)
          .from("chat_salas_mensagens")
          .select("id, remetente_id, destinatario_id, mensagem, anexo_nome, criado_em")
          .eq("canal", "salas")
          .order("criado_em", { ascending: false }),
        (supabase as any)
          .from("chat_salas_mensagens")
          .select("id, remetente_id, destinatario_id, mensagem, anexo_nome, criado_em")
          .eq("canal", "enfermagem")
          .order("criado_em", { ascending: false }),
        (supabase as any)
          .from("chat_admin_mensagens")
          .select("id, remetente_id, destinatario_id, mensagem, criado_em")
          .order("criado_em", { ascending: false }),
      ]);
      for (const result of [salas, enfermagem, admin]) if (result.error) throw result.error;
      return [
        ...(salas.data ?? []).map((m: any) => ({ ...m, id: `salas-${m.id}`, canal: "Salas" })),
        ...(enfermagem.data ?? []).map((m: any) => ({
          ...m,
          id: `enfermagem-${m.id}`,
          canal: "Enfermagem",
        })),
        ...(admin.data ?? []).map((m: any) => ({
          ...m,
          id: `admin-${m.id}`,
          canal: "Administrativo",
        })),
      ] as Registro[];
    },
  });

  const perfis = useQuery({
    queryKey: ["auditoria-perfis"],
    enabled: !!sessao?.userId && isMaster,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Perfil[];
    },
  });
  const nomes = useMemo(
    () => new Map((perfis.data ?? []).map((p) => [p.id, p.nome])),
    [perfis.data],
  );
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (registros.data ?? []).filter(
      (m) =>
        (canal === "todos" || m.canal === canal) &&
        (!termo ||
          `${m.mensagem} ${nomes.get(m.remetente_id)} ${nomes.get(m.destinatario_id)}`
            .toLowerCase()
            .includes(termo)),
    );
  }, [busca, canal, nomes, registros.data]);

  if (!isLoading && !isMaster)
    return (
      <AppShell titulo="Auditoria de mensagens">
        <div className="card-superficie max-w-lg p-6 text-sm">
          A auditoria de mensagens é exclusiva do Administrador Master.
        </div>
      </AppShell>
    );

  return (
    <AppShell
      titulo="Auditoria de mensagens"
      descricao="Histórico dos chats de Salas, Enfermagem e mensagens administrativas."
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por mensagem ou usuário..."
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
          >
            <option value="todos">Todos os canais</option>
            <option value="Salas">Salas</option>
            <option value="Enfermagem">Enfermagem</option>
            <option value="Administrativo">Administrativo</option>
          </select>
        </div>
        {registros.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : filtrados.length ? (
          <div className="space-y-3">
            {filtrados.map((m) => (
              <article key={m.id} className="card-superficie p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="size-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">
                      {nomes.get(m.remetente_id) ?? "Usuário"}
                    </span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="text-sm">{nomes.get(m.destinatario_id) ?? "Usuário"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{m.canal}</Badge>
                    <time className="text-xs text-muted-foreground">{dataHora(m.criado_em)}</time>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                  {m.mensagem || (m.anexo_nome ? `Anexo: ${m.anexo_nome}` : "Mensagem sem texto")}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="card-superficie p-8 text-center text-sm text-muted-foreground">
            Nenhuma mensagem encontrada.
          </div>
        )}
      </div>
    </AppShell>
  );
}
