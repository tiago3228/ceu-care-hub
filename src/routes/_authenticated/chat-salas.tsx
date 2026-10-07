/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FileImage, MessageCircle, Paperclip, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/chat-salas")({
  head: () => ({ meta: [{ title: "Chat das Salas | Clínica CEU" }] }),
  component: PaginaChatSalas,
});

type Perfil = { id: string; nome: string; setor: string | null; ativo: boolean };
type Mensagem = {
  id: number;
  remetente_id: string;
  destinatario_id: string;
  mensagem: string;
  criado_em: string;
  lida_em: string | null;
  anexo_path: string | null;
  anexo_nome: string | null;
  anexo_tipo: string | null;
};

function semAcentos(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function horario(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(valor),
  );
}

function AnexoMensagem({ mensagem }: { mensagem: Mensagem }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!mensagem.anexo_path) return;
    void supabase.storage
      .from("chat-anexos")
      .createSignedUrl(mensagem.anexo_path, 60 * 60)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [mensagem.anexo_path]);
  if (!mensagem.anexo_path) return null;
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center gap-2 rounded-lg border border-current/20 px-3 py-2 text-xs underline"
    >
      {mensagem.anexo_tipo?.startsWith("image/") ? (
        <FileImage className="size-4 shrink-0" />
      ) : (
        <Paperclip className="size-4 shrink-0" />
      )}
      <span className="max-w-[220px] truncate">{mensagem.anexo_nome ?? "Anexo"}</span>
    </a>
  );
}

function PaginaChatSalas() {
  const { sessao, temModulo, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const acesso = temModulo("chat_salas");
  const souMarilia = sessao?.email?.toLowerCase() === "supervisaosalas@clinicaceu.com.br";
  const [contatoSelecionado, setContatoSelecionado] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const perfis = useQuery({
    queryKey: ["chat-salas-perfis"],
    enabled: !!sessao?.userId && acesso,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, nome, setor, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Perfil[];
    },
  });

  const marilia = useQuery({
    queryKey: ["chat-salas-coordenadora"],
    enabled: !!sessao?.userId && acesso,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("obter_chat_salas_coordenadora");
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as Perfil | null;
    },
  });

  const mensagens = useQuery({
    queryKey: ["chat-salas-mensagens"],
    enabled: !!sessao?.userId && acesso,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("chat_salas_mensagens")
        .select(
          "id, remetente_id, destinatario_id, mensagem, criado_em, lida_em, anexo_path, anexo_nome, anexo_tipo",
        )
        .eq("canal", "salas")
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Mensagem[];
    },
  });

  const contatos = useMemo(() => {
    const lista = perfis.data ?? [];
    const mensagensLista = mensagens.data ?? [];
    if (souMarilia) {
      const participantes = new Set(
        mensagensLista.flatMap((m) => [m.remetente_id, m.destinatario_id]),
      );
      return lista.filter(
        (p) =>
          p.id !== sessao?.userId &&
          p.id !== marilia.data?.id &&
          (p.setor === "operacao" || participantes.has(p.id)),
      );
    }
    return marilia.data ? [marilia.data] : [];
  }, [marilia.data, mensagens.data, perfis.data, sessao?.userId, souMarilia]);

  useEffect(() => {
    if (!contatoSelecionado || !contatos.some((c) => c.id === contatoSelecionado)) {
      setContatoSelecionado(contatos[0]?.id ?? null);
    }
  }, [contatos, contatoSelecionado]);

  const contato = contatos.find((p) => p.id === contatoSelecionado) ?? null;
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
      .from("chat_salas_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("canal", "salas")
      .eq("remetente_id", contatoSelecionado)
      .eq("destinatario_id", sessao.userId)
      .is("lida_em", null);
    void queryClient.invalidateQueries({ queryKey: ["chat-salas-mensagens"] });
  }, [contatoSelecionado, conversa, queryClient, sessao?.userId]);

  const enviar = useMutation({
    mutationFn: async () => {
      const mensagem = texto.trim();
      if (!sessao?.userId || !contatoSelecionado || (!mensagem && !arquivo)) return;
      let anexo_path: string | null = null;
      if (arquivo) {
        if (arquivo.size > 10 * 1024 * 1024) {
          throw new Error("O anexo deve ter no máximo 10 MB.");
        }
        const nomeSeguro = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        anexo_path =
          "salas/" +
          sessao.userId +
          "/" +
          contatoSelecionado +
          "/" +
          crypto.randomUUID() +
          "-" +
          nomeSeguro;
        const upload = await supabase.storage.from("chat-anexos").upload(anexo_path, arquivo, {
          contentType: arquivo.type || "application/octet-stream",
          upsert: false,
        });
        if (upload.error) throw upload.error;
      }
      const { error } = await (supabase as any).from("chat_salas_mensagens").insert({
        canal: "salas",
        remetente_id: sessao.userId,
        destinatario_id: contatoSelecionado,
        mensagem: mensagem || null,
        anexo_path,
        anexo_nome: arquivo?.name ?? null,
        anexo_tipo: arquivo?.type ?? null,
        anexo_tamanho: arquivo?.size ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTexto("");
      setArquivo(null);
      void queryClient.invalidateQueries({ queryKey: ["chat-salas-mensagens"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  if (!carregandoSessao && !acesso) {
    return (
      <AppShell titulo="Chat das Salas">
        <div className="card-superficie max-w-lg p-6 text-sm">
          Você não tem acesso ao chat das Salas. Solicite a permissão <strong>chat_salas</strong> ao
          administrador.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Falar com Marília"
      descricao={
        souMarilia
          ? "Responda individualmente às colaboradoras das Salas."
          : "Envie uma mensagem privada para a coordenadora das Salas."
      }
    >
      <div className="grid min-h-[600px] overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[260px_1fr]">
        <aside className="border-b border-border bg-secondary/20 md:border-r md:border-b-0">
          <div className="border-b border-border p-4">
            <p className="text-sm font-semibold">{souMarilia ? "Colaboradoras" : "Coordenação"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Conversas individuais e privadas</p>
          </div>
          <div className="p-2">
            {perfis.isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : contatos.length ? (
              contatos.map((p) => {
                const naoLidas = (mensagens.data ?? []).filter(
                  (m) =>
                    m.remetente_id === p.id && m.destinatario_id === sessao?.userId && !m.lida_em,
                ).length;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setContatoSelecionado(p.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${contatoSelecionado === p.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <UserRound className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.nome}</span>
                      <span className="block text-xs text-muted-foreground">
                        {souMarilia ? "Colaboradora de Salas" : "Coordenadora"}
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
              <p className="p-3 text-xs text-muted-foreground">
                {souMarilia
                  ? "Nenhuma colaboradora iniciou uma conversa ainda."
                  : "Coordenadora Marília não foi localizada. Verifique o nome cadastrado e a permissão chat_salas."}
              </p>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {contato ? (
            <>
              <header className="flex items-center gap-3 border-b border-border p-4">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageCircle className="size-5" />
                </span>
                <div>
                  <h2 className="font-semibold">{contato.nome}</h2>
                  <p className="text-xs text-muted-foreground">Chat individual das Salas</p>
                </div>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-background/50 p-4">
                {conversa.length ? (
                  conversa.map((m) => {
                    const minha = m.remetente_id === sessao?.userId;
                    return (
                      <div key={m.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${minha ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-secondary text-foreground"}`}
                        >
                          {m.mensagem && (
                            <p className="whitespace-pre-wrap break-words">{m.mensagem}</p>
                          )}
                          <AnexoMensagem mensagem={m} />
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
                <label
                  className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-input hover:bg-secondary"
                  title="Anexar imagem ou arquivo"
                >
                  <Paperclip className="size-4" />
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                    disabled={enviar.isPending}
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <Input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder={arquivo ? `Anexo: ${arquivo.name}` : "Digite sua mensagem..."}
                    maxLength={4000}
                    disabled={enviar.isPending}
                  />
                  {arquivo && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-muted-foreground underline"
                      onClick={() => setArquivo(null)}
                    >
                      Remover anexo
                    </button>
                  )}
                </div>
                <Button type="submit" disabled={(!texto.trim() && !arquivo) || enviar.isPending}>
                  <Send className="mr-1.5 size-4" />
                  Enviar
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <MessageCircle className="mb-3 size-10" />
              <p className="font-medium">Selecione uma conversa</p>
              <p className="mt-1 text-sm">
                O chat é restrito às colaboradoras de Salas e à coordenação.
              </p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
