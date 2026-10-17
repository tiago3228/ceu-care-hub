import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const entradaSchema = z.object({
  medicoId: z.number().int().positive(),
  documentoId: z.string().uuid().nullable(),
  conteudo: z.string().trim().min(1, "Digite o conteúdo do laudo antes de analisar.").max(20_000),
});

const resultadoSchema = z.object({
  resumo: z.string().min(1).max(8_000),
  pontosAtencao: z.array(z.string().min(1).max(2_000)).max(20),
  possibilidades: z
    .array(
      z.object({
        descricao: z.string().min(1).max(1_000),
        justificativa: z.string().min(1).max(2_000),
        nivelIncerteza: z.enum(["baixo", "moderado", "alto"]),
      }),
    )
    .max(20),
  limitacoes: z.array(z.string().min(1).max(2_000)).max(20),
  perguntasParaRevisao: z.array(z.string().min(1).max(2_000)).max(20),
});

export type AnaliseLaudoIA = z.infer<typeof resultadoSchema>;

type ContextoAutenticado = {
  supabase: {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>;
    // As tabelas de Laudos foram adicionadas por migrations e ainda não constam dos tipos gerados.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
  };
  userId: string;
};

const PROMPT_SISTEMA = `Você é um assistente de apoio à leitura de laudos médicos, para uso exclusivo por um médico.
Analise somente o texto fornecido. Não invente achados, medidas, sintomas, histórico, exames ou dados ausentes. Não trate a análise como diagnóstico definitivo nem substitua o julgamento clínico do médico.
Retorne somente um objeto JSON válido com as chaves: resumo (string), pontosAtencao (array de strings), possibilidades (array de objetos com descricao, justificativa e nivelIncerteza), limitacoes (array de strings), perguntasParaRevisao (array de strings).
Em nivelIncerteza use somente baixo, moderado ou alto. Inclua possibilidades/diagnósticos diferenciais somente se houver suporte explícito no texto e explique a incerteza. Se não houver suporte suficiente, diga isso claramente. Não recomende tratamento, medicação, procedimento ou conduta como ordem. Não dê instruções ao paciente. Nunca declare doença confirmada.
Finalize o campo resumo com: “Esta análise é apenas uma ferramenta de apoio. O diagnóstico e a decisão clínica final devem ser feitos pelo médico responsável após revisar o laudo completo e o contexto clínico.”`;

export const analisarLaudoComIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => entradaSchema.parse(input))
  .handler(async ({ data, context }): Promise<AnaliseLaudoIA> => {
    const ctx = context as unknown as ContextoAutenticado;

    const { data: temAcesso, error: permissaoError } = await ctx.supabase.rpc("tem_modulo", {
      _user_id: ctx.userId,
      _modulo: "salas",
    });
    if (permissaoError || temAcesso !== true) {
      throw new Error("Você não tem permissão para analisar laudos.");
    }

    const { data: vinculo, error: vinculoError } = await ctx.supabase
      .from("laudos_medicos")
      .select("medico_id")
      .eq("medico_id", data.medicoId)
      .maybeSingle();
    if (vinculoError || !vinculo) {
      throw new Error("Médico não encontrado na biblioteca de Laudos.");
    }

    if (data.documentoId) {
      const { data: documento, error: documentoError } = await ctx.supabase
        .from("laudos_documentos")
        .select("id,medico_id")
        .eq("id", data.documentoId)
        .eq("medico_id", data.medicoId)
        .maybeSingle();
      if (documentoError || !documento) {
        throw new Error("Laudo não encontrado para o médico selecionado.");
      }
    }

    // Secrets and the endpoint stay server-only. If no key is configured, never send report text anywhere.
    const apiKey = process.env.LAUDOS_IA_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Análise por IA indisponível: o provedor ainda não foi configurado no servidor.",
      );
    }

    const model = process.env.LAUDOS_IA_MODEL || "gpt-4o-mini";
    const endpoint = process.env.LAUDOS_IA_API_URL || "https://api.openai.com/v1/chat/completions";
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: PROMPT_SISTEMA },
            { role: "user", content: `Laudo para análise:\n---\n${data.conteudo}\n---` },
          ],
        }),
      });
    } catch {
      throw new Error(
        "Não foi possível concluir a análise por IA. Verifique a conexão e tente novamente.",
      );
    }

    if (!response.ok) {
      throw new Error(
        "O provedor de IA não conseguiu processar a solicitação. Tente novamente mais tarde.",
      );
    }

    let respostaBruta: unknown;
    try {
      const payload: unknown = await response.json();
      const texto = (payload as { choices?: Array<{ message?: { content?: unknown } }> })
        ?.choices?.[0]?.message?.content;
      if (typeof texto !== "string") throw new Error("Invalid provider response");
      respostaBruta = JSON.parse(texto);
    } catch {
      throw new Error("A resposta do provedor de IA veio incompleta ou em formato inválido.");
    }

    const validacao = resultadoSchema.safeParse(respostaBruta);
    if (!validacao.success) {
      throw new Error("A resposta do provedor de IA não passou pela validação de segurança.");
    }

    return validacao.data;
  });
