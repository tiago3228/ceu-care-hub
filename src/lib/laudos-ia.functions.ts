import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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

function segredoServidor(...nomes: string[]) {
  let bindings: Record<string, unknown> = {};
  try {
    const request = getRequest() as Request & {
      runtime?: { cloudflare?: { env?: Record<string, unknown> } };
    };
    bindings = request.runtime?.cloudflare?.env ?? {};
  } catch {
    // During local SSR there may be no request context; process.env is enough there.
  }
  const processo = process.env as Record<string, string | undefined>;
  const globalEnv =
    (globalThis as typeof globalThis & { __env__?: Record<string, unknown> }).__env__ ?? {};
  return nomes.map((nome) => bindings[nome] ?? globalEnv[nome] ?? processo[nome]).find(Boolean) as
    string | undefined;
}

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
    const apiKey = segredoServidor(
      "LAUDOS_IA_API_KEY",
      "GEMINI_API_KEY",
      "GOOGLE_AI_STUDIO_API_KEY",
      "GOOGLE_GEMINI_API_KEY",
      "OPENAI_API_KEY",
    );
    if (!apiKey) {
      throw new Error(
        "Análise por IA indisponível: o provedor ainda não foi configurado no servidor.",
      );
    }

    const model = segredoServidor("LAUDOS_IA_MODEL") || "gemini-3.8-flash";
    const endpoint = segredoServidor("LAUDOS_IA_API_URL");
    const usaGeminiNativo = !endpoint;
    const url =
      endpoint ||
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const corpo = usaGeminiNativo
      ? {
          systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
          contents: [
            {
              role: "user",
              parts: [{ text: `Laudo para análise:\n---\n${data.conteudo}\n---` }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                resumo: { type: "STRING" },
                pontosAtencao: { type: "ARRAY", items: { type: "STRING" } },
                possibilidades: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      descricao: { type: "STRING" },
                      justificativa: { type: "STRING" },
                      nivelIncerteza: {
                        type: "STRING",
                        enum: ["baixo", "moderado", "alto"],
                      },
                    },
                    required: ["descricao", "justificativa", "nivelIncerteza"],
                  },
                },
                limitacoes: { type: "ARRAY", items: { type: "STRING" } },
                perguntasParaRevisao: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: [
                "resumo",
                "pontosAtencao",
                "possibilidades",
                "limitacoes",
                "perguntasParaRevisao",
              ],
            },
          },
        }
      : {
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: PROMPT_SISTEMA },
            { role: "user", content: `Laudo para análise:\n---\n${data.conteudo}\n---` },
          ],
        };
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          ...(usaGeminiNativo
            ? { "x-goog-api-key": apiKey }
            : { Authorization: `Bearer ${apiKey}` }),
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify(corpo),
      });
    } catch {
      throw new Error(
        "Não foi possível concluir a análise por IA. Verifique a conexão e tente novamente.",
      );
    }

    if (!response.ok) {
      let detalhe = `HTTP ${response.status}: resposta recusada pelo provedor`;
      try {
        const erro = (await response.clone().json()) as {
          error?: { message?: string };
          message?: string;
        };
        const mensagem = erro.error?.message || erro.message;
        if (mensagem) detalhe = mensagem.slice(0, 300);
      } catch {
        // Keep a safe generic message when the provider does not return JSON.
      }
      throw new Error(`A API de IA recusou a solicitação: ${detalhe}`);
    }

    let respostaBruta: unknown;
    try {
      const payload: unknown = await response.json();
      const texto = usaGeminiNativo
        ? (
            payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }
          )?.candidates?.[0]?.content?.parts
            ?.map((part) => part.text)
            .filter((part): part is string => typeof part === "string")
            .join("")
        : (payload as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]
            ?.message?.content;
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
