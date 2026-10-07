/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { usePresenca } from "@/hooks/use-presenca";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/chat-admin")({
  head: () => ({ meta: [{ title: "Mensagens | Clínica CEU" }] }),
  component: PaginaChatAdmin,
});

type Perfil = { id: string; nome: string; setor: string | null; ativo: boolean };
type Mensagem = {
  id: number;
  remetente_id: string;
  destinatario_id: string;
  mensagem: string;
  criado_em: string;
  lida_em: string | null;
};

function horario(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(valor),
  );
}

function PaginaChatAdmin() {
  const { sessao, isMaster, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [contatoSelecionado, setContatoSelecionado] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const presenca = usePresenca(sessao?.userId, !!sessao);

  const usuarios = useQuery({
    queryKey: ["chat-admin-usuarios", isMaster],
    enabled: !!sessao?.userId,
    queryFn: async () => {
      if (isMaster) {
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("id, nome, setor, ativo")
          .eq("ativo", true)
          .order("nome");
        if (error) throw error;
        return (data ?? []) as Perfil[];
      }
      const { data, error } = await (supabase as any).rpc("obter_administradores_master");
      if (error) throw error;
      return (data ?? []) as Perfil[];
    },
  });

  const mensagens = useQuery({
    queryKey: ["chat-admin-mensagens"],
    enabled: !!sessao?.userId,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("chat_admin_mensagens")
        .select("id, remetente_id, destinatario_id, mensagem, criado_em, lida_em")
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Mensagem[];
    },
  });

  const contatos = useMemo(() => {
    const lista = usuarios.data ?? [];
    if (isMaster) return lista.filter((p) => p.id !== sessao?.userId);
    return lista;
  }, [isMaster, sessao?.userId, usuarios.data]);

  useEffect(() => {
    if (!contatoSelecionado || !contatos.some((p) => p.id === contatoSelecionado))
      setContatoSelecionado(contatos[0]?.id ?? null);
  }, [contatos, contatoSelecionado]);

  const conversa = (mensagens.data ?? []).filter(
    (m) =>
      contatoSelecionado &&
      ((m.remetente_id === sessao?.userId && m.destinatario_id === contatoSelecionado) ||
        (m.remetente_id === contatoSelecionado && m.destinatario_id === sessao?.userId)),
  );

  useEffect(() => {
    if (
      !sessao?.userId ||
      !contatoSelecionado ||
      !conversa.some((m) => m.destinatario_id === sessao.userId && !m.lida_em)
    )
      return;
    void (supabase as any)
      .from("chat_admin_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("remetente_id", contatoSelecionado)
      .eq("destinatario_id", sessao.userId)
      .is("lida_em", null);
    void queryClient.invalidateQueries({ queryKey: ["chat-admin-mensagens"] });
  }, [contatoSelecionado, conversa, queryClient, sessao?.userId]);

  const enviar = useMutation({
    mutationFn: async () => {
      const mensagem = texto.trim();
      if (!sessao?.userId || !contatoSelecionado || !mensagem) return;
      const { error } = await (supabase as any)
        .from("chat_admin_mensagens")
        .insert({ remetente_id: sessao.userId, destinatario_id: contatoSelecionado, mensagem });
      if (error) throw error;
    },
    onSuccess: () => {
      setTexto("");
      void queryClient.invalidateQueries({ queryKey: ["chat-admin-mensagens"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  if (!carregandoSessao && !sessao?.ativo)
    return (
      <AppShell titulo="Mensagens">
        <div className="card-superficie p-6 text-sm">Sua sessão não está disponível.</div>
      </AppShell>
    );

  return (
    <AppShell
      titulo="Mensagens"
      descricao={
        isMaster
          ? "Usuários ativos e mensagens diretas do sistema."
          : "Fale diretamente com o Administrador Master."
      }
    >
      <div className="grid min-h-[600px] overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[280px_1fr]">
        <aside className="border-b border-border bg-secondary/20 md:border-r md:border-b-0">
          <div className="border-b border-border p-4">
            <p className="text-sm font-semibold">
              {isMaster ? "Usuários ativos" : "Administrador Master"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sinal verde: online · vermelho: offline
            </p>
          </div>
          <div className="p-2">
            {usuarios.isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : contatos.length ? (
              contatos.map((p) => {
                const online = presenca.estaOnline(p.id);
                const naoLidas = (mensagens.data ?? []).filter(
                  (m) =>
                    m.remetente_id === p.id && m.destinatario_id === sessao?.userId && !m.lida_em,
                ).length;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setContatoSelecionado(p.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left ${contatoSelecionado === p.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}
                  >
                    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <UserRound className="size-4" />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card ${online ? "bg-emerald-500" : "bg-red-500"}`}
                        title={online ? "Online" : "Offline"}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.nome}</span>
                      <span className="block text-xs text-muted-foreground">
                        {online ? "Online" : "Offline"} · {p.setor ?? "Sem setor"}
                      </span>
                    </span>
                    {!!naoLidas && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {naoLidas}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="p-3 text-xs text-muted-foreground">Nenhum usuário disponível.</p>
            )}
          </div>
        </aside>
        <section className="flex min-h-0 flex-col">
          {contatoSelecionado ? (
            <>
              <header className="flex items-center gap-3 border-b border-border p-4">
                <MessageCircle className="size-5 text-primary" />
                <div>
                  <h2 className="font-semibold">
                    {contatos.find((p) => p.id === contatoSelecionado)?.nome}
                  </h2>
                  <p className="text-xs text-muted-foreground">Conversa direta e privada</p>
                </div>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-background/50 p-4">
                {conversa.length ? (
                  conversa.map((m) => {
                    const minha = m.remetente_id === sessao?.userId;
                    return (
                      <div key={m.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${minha ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-secondary"}`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.mensagem}</p>
                          <p
                            className={`mt-1 text-[10px] ${minha ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                          >
                            {horario(m.criado_em)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                    Nenhuma mensagem ainda.
                    <br />
                    Envie a primeira mensagem abaixo.
                  </div>
                )}
              </div>
              <form
                className="flex gap-2 border-t border-border p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  enviar.mutate();
                }}
              >
                <Input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  maxLength={4000}
                  disabled={enviar.isPending}
                />
                <Button type="submit" disabled={!texto.trim() || enviar.isPending}>
                  <Send className="mr-1.5 size-4" />
                  Enviar
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <MessageCircle className="mb-3 size-10" />
              <p className="font-medium">Selecione uma conversa</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
