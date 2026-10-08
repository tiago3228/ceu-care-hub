/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BellRing, FileImage, MessageCircle, Paperclip, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { MarcacaoLayout } from "@/components/marcacao/MarcacaoLayout";
import { useSessao } from "@/hooks/use-sessao";
import { usePresenca } from "@/hooks/use-presenca";
import { useNotificacaoMensagens } from "@/hooks/use-notificacao-mensagens";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Contato = {
  id: string;
  nome: string;
  setor: string | null;
  ativo: boolean;
  tipo: string;
};
type Mensagem = {
  id: number;
  remetente_id: string;
  destinatario_id: string;
  mensagem: string | null;
  criado_em: string;
  lida_em: string | null;
  anexo_path: string | null;
  anexo_nome: string | null;
  anexo_tipo: string | null;
  anexo_tamanho: number | null;
};

const BUCKET_ANEXOS = "marcacao-chat-anexos";
const TIPOS_ANEXO_PERMITIDOS = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function horario(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(valor),
  );
}

function AnexoMensagem({ mensagem }: { mensagem: Mensagem }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelado = false;
    if (!mensagem.anexo_path) return;
    void supabase.storage
      .from(BUCKET_ANEXOS)
      .createSignedUrl(mensagem.anexo_path, 60 * 60)
      .then(({ data, error }) => {
        if (!cancelado && !error) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelado = true;
    };
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

export const Route = createFileRoute("/_authenticated/chat-marcacao")({
  head: () => ({ meta: [{ title: "Chat da Marcação | Clínica CEU" }] }),
  component: PaginaChatMarcacao,
});

function PaginaChatMarcacao() {
  const { sessao, temModulo, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const souCoordenadora = !!sessao?.modulos.includes("marcacao_coordenacao");
  const acesso = temModulo("chat_marcacao") || souCoordenadora;
  const presenca = usePresenca(sessao?.userId, !!sessao && acesso);
  const [contatoSelecionado, setContatoSelecionado] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const contatos = useQuery({
    queryKey: ["chat-marcacao-contatos", sessao?.userId],
    enabled: !!sessao?.userId && acesso,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("obter_chat_marcacao_contatos");
      if (error) throw error;
      return (data ?? []) as Contato[];
    },
  });

  const mensagens = useQuery({
    queryKey: ["chat-marcacao-mensagens", sessao?.userId],
    enabled: !!sessao?.userId && acesso,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("chat_marcacao_mensagens")
        .select(
          "id,remetente_id,destinatario_id,mensagem,criado_em,lida_em,anexo_path,anexo_nome,anexo_tipo,anexo_tamanho",
        )
        .or(`remetente_id.eq.${sessao!.userId},destinatario_id.eq.${sessao!.userId}`)
        .order("criado_em", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Mensagem[];
    },
  });

  const notificacao = useNotificacaoMensagens(
    mensagens.data,
    sessao?.userId,
    "a coordenação da Marcação",
  );
  const listaContatos = useMemo(() => contatos.data ?? [], [contatos.data]);
  const conversaSelecionada = useMemo(
    () =>
      (mensagens.data ?? []).filter(
        (mensagem) =>
          contatoSelecionado &&
          ((mensagem.remetente_id === sessao?.userId &&
            mensagem.destinatario_id === contatoSelecionado) ||
            (mensagem.remetente_id === contatoSelecionado &&
              mensagem.destinatario_id === sessao?.userId)),
      ),
    [contatoSelecionado, mensagens.data, sessao?.userId],
  );

  useEffect(() => {
    if (
      !contatoSelecionado ||
      !listaContatos.some((contato) => contato.id === contatoSelecionado)
    ) {
      setContatoSelecionado(listaContatos[0]?.id ?? null);
    }
  }, [contatoSelecionado, listaContatos]);

  const contato = listaContatos.find((item) => item.id === contatoSelecionado) ?? null;

  useEffect(() => {
    if (
      !sessao?.userId ||
      !contatoSelecionado ||
      !conversaSelecionada.some(
        (mensagem) => mensagem.destinatario_id === sessao.userId && !mensagem.lida_em,
      )
    ) {
      return;
    }
    void (supabase as any)
      .from("chat_marcacao_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("remetente_id", contatoSelecionado)
      .eq("destinatario_id", sessao.userId)
      .is("lida_em", null);
    void queryClient.invalidateQueries({ queryKey: ["chat-marcacao-mensagens", sessao.userId] });
  }, [contatoSelecionado, conversaSelecionada, queryClient, sessao?.userId]);

  const enviar = useMutation({
    mutationFn: async () => {
      const mensagem = texto.trim();
      if (!sessao?.userId || !contatoSelecionado || (!mensagem && !arquivo)) return;
      let anexo_path: string | null = null;
      if (arquivo) {
        if (arquivo.size > 10 * 1024 * 1024) throw new Error("O anexo deve ter no máximo 10 MB.");
        if (!TIPOS_ANEXO_PERMITIDOS.has(arquivo.type)) {
          throw new Error("Formato não permitido. Use imagem, PDF, Word, Excel ou texto simples.");
        }
        const nomeSeguro = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        anexo_path = `${sessao.userId}/${contatoSelecionado}/${crypto.randomUUID()}-${nomeSeguro}`;
        const upload = await supabase.storage.from(BUCKET_ANEXOS).upload(anexo_path, arquivo, {
          contentType: arquivo.type,
          upsert: false,
        });
        if (upload.error) throw upload.error;
      }
      const { error } = await (supabase as any).from("chat_marcacao_mensagens").insert({
        remetente_id: sessao.userId,
        destinatario_id: contatoSelecionado,
        mensagem: mensagem || null,
        anexo_path,
        anexo_nome: arquivo?.name ?? null,
        anexo_tipo: arquivo?.type ?? null,
        anexo_tamanho: arquivo?.size ?? null,
      });
      if (error) {
        if (anexo_path) void supabase.storage.from(BUCKET_ANEXOS).remove([anexo_path]);
        throw error;
      }
    },
    onSuccess: () => {
      setTexto("");
      setArquivo(null);
      void queryClient.invalidateQueries({ queryKey: ["chat-marcacao-mensagens", sessao?.userId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem."),
  });

  if (!carregandoSessao && !acesso) {
    return (
      <MarcacaoLayout aba="chat">
        <div className="card-superficie max-w-lg p-6 text-sm">
          Você não tem permissão para acessar o chat da Marcação.
        </div>
      </MarcacaoLayout>
    );
  }

  return (
    <MarcacaoLayout aba="chat">
      {notificacao.novaMensagem && (
        <button
          type="button"
          onClick={notificacao.dispensar}
          className="fixed right-5 top-5 z-50 flex animate-pulse items-center gap-2 rounded-xl border border-primary/30 bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg"
        >
          <BellRing className="size-4" /> Nova mensagem no chat da Marcação
        </button>
      )}
      <div className="grid min-h-[600px] overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[280px_1fr]">
        <aside className="border-b border-border bg-secondary/20 md:border-r md:border-b-0">
          <div className="border-b border-border p-4">
            <p className="text-sm font-semibold">{souCoordenadora ? "Conversas" : "Coordenação"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Mensagens individuais e privadas</p>
          </div>
          <div className="p-2">
            {contatos.isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : listaContatos.length ? (
              listaContatos.map((pessoa) => {
                const naoLidas = (mensagens.data ?? []).filter(
                  (mensagem) =>
                    mensagem.remetente_id === pessoa.id &&
                    mensagem.destinatario_id === sessao?.userId &&
                    !mensagem.lida_em,
                ).length;
                return (
                  <button
                    key={pessoa.id}
                    type="button"
                    onClick={() => setContatoSelecionado(pessoa.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${contatoSelecionado === pessoa.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}
                  >
                    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <UserRound className="size-4" />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card ${presenca.estaOnline(pessoa.id) ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                        title={presenca.estaOnline(pessoa.id) ? "Online" : "Offline"}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{pessoa.nome}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {pessoa.tipo} · {presenca.estaOnline(pessoa.id) ? "Online" : "Offline"}
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
                {souCoordenadora
                  ? "Nenhuma conversa autorizada foi localizada. Confira se a conta da Geise está ativa e com o perfil correto."
                  : "A coordenação da Marcação ainda não está disponível para conversa."}
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
                  <p className="text-xs text-muted-foreground">{contato.tipo} · conversa privada</p>
                </div>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-background/50 p-4">
                {mensagens.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : conversaSelecionada.length ? (
                  conversaSelecionada.map((mensagem) => {
                    const minha = mensagem.remetente_id === sessao?.userId;
                    return (
                      <div
                        key={mensagem.id}
                        className={`flex ${minha ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${minha ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-secondary text-foreground"}`}
                        >
                          {mensagem.mensagem && (
                            <p className="whitespace-pre-wrap break-words">{mensagem.mensagem}</p>
                          )}
                          <AnexoMensagem mensagem={mensagem} />
                          <p
                            className={`mt-1 text-[10px] ${minha ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                          >
                            {horario(mensagem.criado_em)}
                            {minha && mensagem.lida_em ? " · lida" : ""}
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
                onSubmit={(event) => {
                  event.preventDefault();
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
                    accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={(event) => setArquivo(event.target.files?.[0] ?? null)}
                    disabled={enviar.isPending}
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <Input
                    value={texto}
                    onChange={(event) => setTexto(event.target.value)}
                    placeholder={arquivo ? `Anexo: ${arquivo.name}` : "Digite sua mensagem…"}
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
              <p className="mt-1 max-w-md text-sm">
                Colaboradores da Marcação conversam somente com Geise. A coordenadora pode falar com
                a equipe, outras coordenações e o Administrador Master.
              </p>
            </div>
          )}
        </section>
      </div>
    </MarcacaoLayout>
  );
}
