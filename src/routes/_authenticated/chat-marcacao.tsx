/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { MessageCircle, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { usePresenca } from "@/hooks/use-presenca";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const db = supabase as any;
type Perfil = { id: string; nome: string; setor: string | null; ativo: boolean };
type Mensagem = {
  id: number;
  remetente_id: string;
  destinatario_id: string;
  mensagem: string;
  criado_em: string;
  lida_em: string | null;
};
export const Route = createFileRoute("/_authenticated/chat-marcacao")({
  head: () => ({ meta: [{ title: "Falar com Geisi | Clínica CEU" }] }),
  component: PaginaChatMarcacao,
});
function PaginaChatMarcacao() {
  const { sessao, temModulo, isAdmin, isLoading: carregandoSessao } = useSessao();
  const souGeisi =
    sessao?.email?.toLowerCase() === "marcacao@clinicaceu.com.br" ||
    sessao?.nome?.toLowerCase() === "geisiane taise gomes moraes";
  const acesso = isAdmin || temModulo("chat_marcacao") || souGeisi;
  const queryClient = useQueryClient();
  const presenca = usePresenca(sessao?.userId, acesso);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const geisi = useQuery({
    queryKey: ["chat-marcacao-geisi"],
    enabled: acesso,
    queryFn: async () => {
      const { data, error } = await db.rpc("obter_chat_marcacao_supervisora");
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as Perfil | null;
    },
  });
  const perfis = useQuery({
    queryKey: ["chat-marcacao-perfis"],
    enabled: acesso && souGeisi,
    queryFn: async () => {
      const { data, error } = await db
        .from("profiles")
        .select("id,nome,setor,ativo")
        .eq("ativo", true)
        .in("setor", ["marcacao", "Marcação", "marcação"])
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Perfil[];
    },
  });
  const mensagens = useQuery({
    queryKey: ["chat-marcacao-mensagens"],
    enabled: acesso,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await db
        .from("chat_salas_mensagens")
        .select("id,remetente_id,destinatario_id,mensagem,criado_em,lida_em")
        .eq("canal", "marcacao")
        .order("criado_em");
      if (error) throw error;
      return (data ?? []) as Mensagem[];
    },
  });
  const contatos = useMemo(
    () =>
      souGeisi
        ? (perfis.data ?? []).filter((p) => p.id !== sessao?.userId)
        : geisi.data
          ? [geisi.data]
          : [],
    [geisi.data, perfis.data, sessao?.userId, souGeisi],
  );
  useEffect(() => {
    if (!selecionado || !contatos.some((p) => p.id === selecionado))
      setSelecionado(contatos[0]?.id ?? null);
  }, [contatos, selecionado]);
  const conversa = (mensagens.data ?? []).filter(
    (m) =>
      selecionado &&
      ((m.remetente_id === sessao?.userId && m.destinatario_id === selecionado) ||
        (m.remetente_id === selecionado && m.destinatario_id === sessao?.userId)),
  );
  useEffect(() => {
    if (
      !sessao?.userId ||
      !selecionado ||
      !conversa.some((m) => m.destinatario_id === sessao.userId && !m.lida_em)
    )
      return;
    void db
      .from("chat_salas_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("canal", "marcacao")
      .eq("remetente_id", selecionado)
      .eq("destinatario_id", sessao.userId)
      .is("lida_em", null);
  }, [conversa, selecionado, sessao?.userId]);
  const enviar = useMutation({
    mutationFn: async () => {
      const mensagem = texto.trim();
      if (!mensagem || !sessao?.userId || !selecionado) return;
      const { error } = await db.from("chat_salas_mensagens").insert({
        canal: "marcacao",
        remetente_id: sessao.userId,
        destinatario_id: selecionado,
        mensagem,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTexto("");
      void queryClient.invalidateQueries({ queryKey: ["chat-marcacao-mensagens"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem."),
  });
  if (!carregandoSessao && !acesso)
    return (
      <AppShell titulo="Falar com Geisi">
        <div className="card-superficie max-w-md p-6 text-sm">
          Você não tem acesso ao chat da Marcação.
        </div>
      </AppShell>
    );
  const contato = contatos.find((p) => p.id === selecionado);
  return (
    <AppShell
      titulo="Falar com Geisi"
      descricao={
        souGeisi
          ? "Responda individualmente aos colaboradores da Marcação."
          : "Conversa privada com a supervisora da Marcação."
      }
    >
      <div className="grid min-h-[560px] overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[260px_1fr]">
        <aside className="border-b border-border bg-secondary/20 md:border-r md:border-b-0">
          <div className="border-b border-border p-4">
            <p className="text-sm font-semibold">{souGeisi ? "Colaboradores" : "Supervisora"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Conversas individuais e privadas</p>
          </div>
          <div className="p-2">
            {contatos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelecionado(p.id)}
                className={`flex w-full items-center gap-2 rounded-lg p-3 text-left ${p.id === selecionado ? "bg-primary/10" : "hover:bg-accent"}`}
              >
                <UserRound className="size-4" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {presenca.estaOnline(p.id) ? "Online" : "Offline"}
                  </span>
                </span>
              </button>
            ))}
            {!contatos.length && (
              <p className="p-3 text-xs text-muted-foreground">
                Supervisora Geisi não foi localizada.
              </p>
            )}
          </div>
        </aside>
        <main className="flex min-h-0 flex-col">
          <header className="flex items-center gap-2 border-b border-border p-4">
            <MessageCircle className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">{contato?.nome ?? "Selecione uma conversa"}</p>
              <p className="text-xs text-muted-foreground">
                {contato && (presenca.estaOnline(contato.id) ? "Online" : "Offline")}
              </p>
            </div>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {conversa.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.remetente_id === sessao?.userId ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.remetente_id === sessao?.userId ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                >
                  <p className="whitespace-pre-wrap">{m.mensagem}</p>
                  <p className="mt-1 text-[10px] opacity-70">
                    {new Date(m.criado_em).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
            {!conversa.length && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma mensagem nesta conversa.
              </p>
            )}
          </div>
          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              enviar.mutate();
            }}
          >
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Digite sua mensagem..."
              disabled={!selecionado}
            />
            <Button type="submit" disabled={!selecionado || !texto.trim() || enviar.isPending}>
              <Send className="size-4" />
            </Button>
          </form>
        </main>
      </div>
    </AppShell>
  );
}
