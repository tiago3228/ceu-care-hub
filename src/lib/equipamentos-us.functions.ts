/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  id: z.number().int().positive().nullable().optional(),
  nome: z.string().trim().min(2).max(160),
  localizacao: z.string().trim().min(2).max(160),
  modelo: z.string().trim().min(1).max(160),
  fabricante: z.string().trim().max(160).optional().nullable(),
  ano_fabricacao: z.number().int().min(1900).max(2200).nullable().optional(),
  patrimonio: z.string().trim().min(1).max(100),
  serial: z.string().trim().min(1).max(160),
  numero_anvisa: z.string().trim().max(160).optional().nullable(),
  versao_software: z.string().trim().max(160).optional().nullable(),
  ip: z.string().trim().max(80).optional().nullable(),
  porta: z.string().trim().max(30).optional().nullable(),
  gateway: z.string().trim().max(80).optional().nullable(),
  mascara: z.string().trim().max(80).optional().nullable(),
  dns: z.string().trim().max(160).optional().nullable(),
  mac: z.string().trim().max(80).optional().nullable(),
  aetitle: z.string().trim().max(160).optional().nullable(),
  worklist: z.string().trim().max(300).optional().nullable(),
  storage_scp: z.string().trim().max(300).optional().nullable(),
  storage_scu: z.string().trim().max(300).optional().nullable(),
  servidor_dicom: z.string().trim().max(160).optional().nullable(),
  porta_dicom: z.string().trim().max(30).optional().nullable(),
  observacoes_dicom: z.string().trim().max(5000).optional().nullable(),
  usuario: z.string().trim().max(160).optional().nullable(),
  senha: z.string().max(500).optional().nullable(),
  ultima_manutencao: z.string().nullable().optional(),
  proxima_manutencao: z.string().nullable().optional(),
  empresa_responsavel: z.string().trim().max(200).optional().nullable(),
  contato_tecnico: z.string().trim().max(200).optional().nullable(),
  telefone_tecnico: z.string().trim().max(80).optional().nullable(),
  contrato_vigente: z.boolean().default(false),
  alerta_manutencao: z.boolean().default(true),
  dias_alerta_manutencao: z.number().int().min(1).max(365).default(30),
  observacoes: z.string().max(10000).optional().nullable(),
  status: z
    .enum(["operacional", "atencao", "manutencao_vencida", "inativo"])
    .default("operacional"),
});
type Contexto = { supabase: any; userId: string };
async function permissao(ctx: Contexto, chave: string) {
  const { data, error } = await ctx.supabase.rpc("tem_modulo", {
    _user_id: ctx.userId,
    _modulo: chave,
  });
  if (error || !data) throw new Error("Você não tem permissão para esta ação.");
}
async function admin(ctx: Contexto) {
  const { data } = await ctx.supabase.rpc("is_admin", { _user_id: ctx.userId });
  return !!data;
}
async function auditar(ctx: Contexto, operacao: string, id: number, dados: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("nome")
    .eq("id", ctx.userId)
    .maybeSingle();
  await supabaseAdmin.from("audit_logs").insert({
    user_id: ctx.userId,
    usuario_nome: p?.nome ?? "Usuário",
    tabela: "equipamentos_us",
    operacao,
    registro_id: String(id),
    dados_novos: dados,
    observacoes: operacao.includes("SENHA") ? "Ação de credencial; senha não registrada." : null,
  });
}

export const salvarEquipamentoUs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Contexto;
    await permissao(ctx, data.id ? "equipamentos_us_editar" : "equipamentos_us_adicionar");
    const adminUser = await admin(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { cifrar } = await import("@/lib/senhas.server");
    const { senha, id, ...rest } = data;
    const payload: any = { ...rest, atualizado_por: ctx.userId };
    if (senha) {
      payload.senha_cifrada = cifrar(senha);
      payload.senha_cadastrada = true;
    }
    if (id) {
      let q = supabaseAdmin.from("equipamentos_us").update(payload).eq("id", id);
      if (!adminUser) q = q.eq("criado_por", ctx.userId);
      const { data: registro, error } = await q.select("id").maybeSingle();
      if (error || !registro) throw new Error("Equipamento não encontrado ou sem permissão.");
      await supabaseAdmin.from("equipamentos_us_historico").insert({
        equipamento_id: id,
        operacao: "ALTERACAO",
        dados_novos: { ...payload, senha_cifrada: undefined },
        criado_por: ctx.userId,
      });
      await auditar(ctx, senha ? "ALTERACAO_SENHA" : "UPDATE", id, {
        ...payload,
        senha: undefined,
      });
      return { id };
    }
    const { data: criado, error } = await supabaseAdmin
      .from("equipamentos_us")
      .insert({ ...payload, criado_por: ctx.userId })
      .select("id")
      .single();
    if (error || !criado) throw new Error("Não foi possível cadastrar o equipamento.");
    await supabaseAdmin.from("equipamentos_us_historico").insert({
      equipamento_id: criado.id,
      operacao: "CRIACAO",
      dados_novos: { ...payload, senha_cifrada: undefined },
      criado_por: ctx.userId,
    });
    await auditar(ctx, "INSERT", criado.id, payload);
    return { id: criado.id };
  });

export const excluirEquipamentoUs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Contexto;
    await permissao(ctx, "equipamentos_us_excluir");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("equipamentos_us").delete().eq("id", data.id);
    if (!(await admin(ctx))) q = q.eq("criado_por", ctx.userId);
    const { data: removido, error } = await q.select("id").maybeSingle();
    if (error || !removido) throw new Error("Equipamento não encontrado ou sem permissão.");
    await auditar(ctx, "DELETE", data.id, null);
    return { ok: true };
  });

export const revelarSenhaEquipamentoUs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ id: z.number().int().positive(), motivo: z.enum(["revelar", "copiar"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Contexto;
    await permissao(ctx, "equipamentos_us_visualizar_senhas");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: registro, error } = await supabaseAdmin
      .from("equipamentos_us")
      .select("nome,senha_cifrada")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !registro?.senha_cifrada) throw new Error("Senha não cadastrada.");
    const { decifrar } = await import("@/lib/senhas.server");
    await auditar(ctx, data.motivo === "copiar" ? "COPIA_SENHA" : "REVELACAO_SENHA", data.id, {
      nome: registro.nome,
    });
    return { senha: decifrar(registro.senha_cifrada) };
  });
