/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const texto = z.string().trim().max(500).optional().nullable();
const tarefaSchema = z.object({
  medicoId: z.string().trim().min(1).max(160),
  medicoNome: z.string().trim().min(2).max(240),
  exame: texto,
  convenio: texto,
  idade: z.number().int().min(0).max(130).nullable().optional(),
  turno: texto,
  solicitante: texto,
  dadosValidacao: z.record(z.unknown()),
});
const idSchema = z.object({ tarefaId: z.string().uuid() });
const aprovacaoSchema = z.object({
  tarefaId: z.string().uuid(),
  horario: z.record(z.unknown()),
});

type Ctx = { supabase: any; userId: string };
async function perm(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("tem_modulo", {
    _user_id: ctx.userId,
    _modulo: "agendamento_marcacao_automacao",
  });
  if (error || !data) throw new Error("Você não tem permissão para usar a fila de automação.");
}
async function registrarLog(
  ctx: Ctx,
  tarefaId: string,
  evento: string,
  status: string,
  detalhes: any = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("agendamento_automacao_logs").insert({
    tarefa_id: tarefaId,
    evento,
    status,
    detalhes,
    criado_por: ctx.userId,
  });
}

export const criarTarefaAutomacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tarefaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await perm(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      status: "aguardando_robo",
      medico_id: data.medicoId,
      medico_nome: data.medicoNome,
      exame: data.exame || null,
      convenio: data.convenio || null,
      idade: data.idade ?? null,
      turno: data.turno || null,
      solicitante: data.solicitante || null,
      dados_validacao: data.dadosValidacao,
      criado_por: ctx.userId,
    };
    const { data: tarefa, error } = await supabaseAdmin
      .from("agendamento_automacao_tarefas")
      .insert(payload)
      .select("*")
      .single();
    if (error || !tarefa) throw new Error(error?.message ?? "Não foi possível criar a tarefa.");
    await registrarLog(ctx, tarefa.id, "TAREFA_CRIADA", "aguardando_robo", {
      origem: "ceu-care-hub",
    });

    const webhook = process.env.AUTOMACAO_AGENDAMENTO_WEBHOOK_URL;
    if (webhook) {
      try {
        const response = await fetch(webhook, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-ceucare-event": "agendamento.tarefa.criada",
          },
          body: JSON.stringify({ tarefaId: tarefa.id, ...payload }),
        });
        if (!response.ok) throw new Error(`Webhook respondeu ${response.status}`);
        await registrarLog(ctx, tarefa.id, "WEBHOOK_ENVIADO", "aguardando_robo");
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : "Falha ao enviar webhook";
        await supabaseAdmin
          .from("agendamento_automacao_tarefas")
          .update({ status: "falhou", erro: mensagem })
          .eq("id", tarefa.id);
        await registrarLog(ctx, tarefa.id, "WEBHOOK_FALHOU", "falhou", { erro: mensagem });
        throw new Error(`Tarefa criada, mas o webhook não foi enviado: ${mensagem}`);
      }
    }
    return { tarefa };
  });

export const aprovarTarefaAutomacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => aprovacaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await perm(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tarefa, error } = await supabaseAdmin
      .from("agendamento_automacao_tarefas")
      .update({
        status: "confirmacao_solicitada",
        horario_escolhido: data.horario,
        aprovado_por: ctx.userId,
        aprovado_em: new Date().toISOString(),
      })
      .eq("id", data.tarefaId)
      .in("status", ["opcoes_disponiveis", "aguardando_aprovacao"])
      .select("*")
      .maybeSingle();
    if (error || !tarefa)
      throw new Error("A tarefa não está pronta para aprovação ou não foi encontrada.");
    await registrarLog(ctx, tarefa.id, "APROVACAO_HUMANA", "confirmacao_solicitada", {
      horario: data.horario,
    });
    const webhook =
      process.env.AUTOMACAO_AGENDAMENTO_CONFIRMAR_WEBHOOK_URL ||
      process.env.AUTOMACAO_AGENDAMENTO_WEBHOOK_URL;
    if (webhook) {
      const response = await fetch(webhook, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ceucare-event": "agendamento.tarefa.confirmar",
        },
        body: JSON.stringify({
          evento: "agendamento.tarefa.confirmar",
          tarefaId: tarefa.id,
          horario: data.horario,
          medico: { id: tarefa.medico_id, nome: tarefa.medico_nome },
          exame: tarefa.exame,
          convenio: tarefa.convenio,
        }),
      });
      if (!response.ok) {
        const mensagem = `Webhook de confirmação respondeu ${response.status}`;
        await supabaseAdmin
          .from("agendamento_automacao_tarefas")
          .update({ status: "falhou", erro: mensagem })
          .eq("id", tarefa.id);
        await registrarLog(ctx, tarefa.id, "CONFIRMACAO_WEBHOOK_FALHOU", "falhou", {
          erro: mensagem,
        });
        throw new Error(mensagem);
      }
      await registrarLog(ctx, tarefa.id, "CONFIRMACAO_ENVIADA_AO_ROBO", "confirmacao_solicitada");
    }
    return { tarefa };
  });

export const cancelarTarefaAutomacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await perm(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tarefa, error } = await supabaseAdmin
      .from("agendamento_automacao_tarefas")
      .update({ status: "cancelada" })
      .eq("id", data.tarefaId)
      .in("status", ["aguardando_robo", "opcoes_disponiveis", "aguardando_aprovacao"])
      .select("*")
      .maybeSingle();
    if (error || !tarefa) throw new Error("A tarefa não pode mais ser cancelada.");
    await registrarLog(ctx, tarefa.id, "TAREFA_CANCELADA", "cancelada");
    return { tarefa };
  });
