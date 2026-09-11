/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const campo = z.string().trim().max(500).optional().nullable();
const schema = z.object({
  id: z.number().int().positive().nullable().optional(),
  nome: z.string().trim().min(2).max(160),
  modelo: z.string().trim().min(1).max(160),
  fabricante: campo,
  tipo: z.string().trim().min(1).max(80),
  serial: z.string().trim().min(1).max(160),
  patrimonio: campo,
  ano_fabricacao: z.number().int().min(1900).max(2200).nullable().optional(),
  frequencia: campo,
  numero_anvisa: campo,
  localizacao: z.string().trim().min(1).max(160),
  sala: campo,
  setor: campo,
  data_aquisicao: z.string().nullable().optional(),
  garantia: campo,
  status: z.enum(["em_uso", "reserva", "manutencao", "inativa", "baixada"]),
  ultima_manutencao: z.string().nullable().optional(),
  proxima_manutencao: z.string().nullable().optional(),
  empresa_responsavel: campo,
  contato_tecnico: campo,
  telefone_tecnico: campo,
  observacoes_manutencao: z.string().max(5000).optional().nullable(),
  observacoes: z.string().max(10000).optional().nullable(),
  equipamento_ids: z.array(z.number().int().positive()).default([]),
});
type Ctx = { supabase: any; userId: string };
async function perm(ctx: Ctx, key: string) {
  const { data, error } = await ctx.supabase.rpc("tem_modulo", {
    _user_id: ctx.userId,
    _modulo: key,
  });
  if (error || !data) throw new Error("Você não tem permissão para esta ação.");
}
async function isAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("is_admin", { _user_id: ctx.userId });
  return !!data;
}
async function audit(ctx: Ctx, operation: string, id: number, data: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_logs").insert({
    user_id: ctx.userId,
    tabela: "sondas",
    operacao: operation,
    registro_id: String(id),
    dados_novos: data,
  });
}

export const salvarSonda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await perm(ctx, data.id ? "sondas_editar" : "sondas_adicionar");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { equipamento_ids, id, ...rest } = data;
    const payload = { ...rest, atualizado_por: ctx.userId };
    let sondaId = id;
    if (id) {
      let q = supabaseAdmin.from("sondas").update(payload).eq("id", id);
      if (!(await isAdmin(ctx))) q = q.eq("criado_por", ctx.userId);
      const { data: row, error } = await q.select("id").maybeSingle();
      if (error || !row) throw new Error("Sonda não encontrada ou sem permissão.");
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("sondas")
        .insert({ ...payload, criado_por: ctx.userId })
        .select("id")
        .single();
      if (error || !row) throw new Error(error?.message ?? "Não foi possível cadastrar a sonda.");
      sondaId = row.id;
    }
    await supabaseAdmin.from("sondas_equipamentos").delete().eq("sonda_id", sondaId);
    if (equipamento_ids.length)
      await supabaseAdmin.from("sondas_equipamentos").insert(
        equipamento_ids.map((equipamento_id) => ({
          sonda_id: sondaId,
          equipamento_id,
          criado_por: ctx.userId,
        })),
      );
    await audit(ctx, id ? "UPDATE" : "INSERT", sondaId!, { ...payload, equipamento_ids });
    return { id: sondaId };
  });

export const excluirSonda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await perm(ctx, "sondas_excluir");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("sondas").delete().eq("id", data.id);
    if (!(await isAdmin(ctx))) q = q.eq("criado_por", ctx.userId);
    const { data: row, error } = await q.select("id").maybeSingle();
    if (error || !row) throw new Error("Sonda não encontrada ou sem permissão.");
    await audit(ctx, "DELETE", data.id, null);
    return { ok: true };
  });

export const salvarOcorrenciaSonda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        sonda_id: z.number().int().positive(),
        data: z.string(),
        tipo: z.string().trim().min(1).max(80),
        descricao: z.string().trim().min(2).max(5000),
        anexo_nome: campo,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await perm(ctx, "sondas_manutencao");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sondas_ocorrencias")
      .insert({ ...data, criado_por: ctx.userId });
    if (error) throw new Error(error.message);
    await audit(ctx, "OCORRENCIA", data.sonda_id, data);
    return { ok: true };
  });
