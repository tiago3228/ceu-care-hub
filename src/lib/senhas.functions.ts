/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const urlValida = (v: string) => {
  try {
    const u = new URL(v.startsWith("http") ? v : `https://${v}`);
    return !!u.hostname && u.hostname.includes(".");
  } catch {
    return false;
  }
};

const schemaSenha = z
  .object({
    id: z.number().int().positive().nullable().optional(),
    nome: z.string().trim().min(2, "Informe o nome do sistema.").max(120),
    url: z
      .string()
      .trim()
      .max(300)
      .optional()
      .nullable()
      .refine((v) => !v || urlValida(v), "Informe um endereço válido."),
    login: z.string().trim().min(1, "Informe o login.").max(200),
    senha: z.string().max(500).optional().default(""),
    observacoes: z.string().trim().max(1000).optional().nullable(),
    categoria: z.string().trim().max(60).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.id && !data.senha) {
      ctx.addIssue({ code: "custom", path: ["senha"], message: "Informe a senha." });
    }
  });

type Contexto = { supabase: any; userId: string };
type Acao = "senhas_adicionar" | "senhas_editar" | "senhas_excluir";

async function temPermissao(context: Contexto, modulo: string) {
  const { data, error } = await context.supabase.rpc("tem_modulo", {
    _user_id: context.userId,
    _modulo: modulo,
  });
  if (error) throw new Error("Não foi possível validar suas permissões.");
  if (!data) throw new Error("Você não tem permissão para esta ação.");
}

async function ehAdmin(context: Contexto) {
  const { data, error } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (error) throw new Error("Não foi possível validar suas permissões.");
  return !!data;
}

async function podeVer(context: Contexto) {
  await temPermissao(context, "senhas");
}

async function podeAgir(context: Contexto, acao: Acao) {
  await podeVer(context);
  if (!(await ehAdmin(context))) await temPermissao(context, acao);
}

async function registrarAuditoria(
  context: Contexto,
  operacao: string,
  registroId: number,
  descricao: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const perfil = await supabaseAdmin
    .from("profiles")
    .select("nome")
    .eq("id", context.userId)
    .maybeSingle();
  await supabaseAdmin.from("audit_logs").insert({
    user_id: context.userId,
    usuario_nome: perfil.data?.nome ?? "Usuário",
    tabela: "senhas",
    operacao,
    registro_id: String(registroId),
    observacoes: descricao,
  });
}

function porProprietario(query: any, context: Contexto, admin: boolean) {
  return admin ? query : query.eq("owner_user_id", context.userId);
}

export const salvarSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schemaSenha.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Contexto;
    const admin = await ehAdmin(ctx);
    await podeAgir(ctx, data.id ? "senhas_editar" : "senhas_adicionar");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      nome: data.nome,
      url: data.url?.trim() ? data.url.trim() : null,
      login: data.login,
      observacoes: data.observacoes?.trim() || null,
      categoria: data.categoria?.trim() || null,
      atualizado_por: ctx.userId,
    };

    if (data.id) {
      const updatePayload = data.senha
        ? { ...payload, senha_cifrada: (await import("@/lib/senhas.server")).cifrar(data.senha) }
        : payload;
      let query = supabaseAdmin.from("senhas").update(updatePayload).eq("id", data.id);
      query = porProprietario(query, ctx, admin);
      const { data: atualizado, error } = await query.select("id").maybeSingle();
      if (error || !atualizado) throw new Error("Credencial não encontrada ou sem permissão.");
      return { id: data.id };
    }

    const { cifrar } = await import("@/lib/senhas.server");
    const { data: criado, error } = await supabaseAdmin
      .from("senhas")
      .insert({
        ...payload,
        senha_cifrada: cifrar(data.senha),
        criado_por: ctx.userId,
        owner_user_id: ctx.userId,
      })
      .select("id")
      .single();
    if (error || !criado) throw new Error("Não foi possível salvar a credencial.");
    return { id: criado.id };
  });

export const excluirSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Contexto;
    const admin = await ehAdmin(ctx);
    await podeAgir(ctx, "senhas_excluir");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("senhas").delete().eq("id", data.id);
    query = porProprietario(query, ctx, admin);
    const { data: removido, error } = await query.select("id").maybeSingle();
    if (error || !removido) throw new Error("Credencial não encontrada ou sem permissão.");
    return { ok: true };
  });

export const revelarSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ id: z.number().int().positive(), motivo: z.enum(["revelar", "copiar"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Contexto;
    try {
      await podeVer(ctx);
      await temPermissao(ctx, "senhas_revelar");
    } catch (e) {
      await registrarAuditoria(
        ctx,
        "ACESSO_NEGADO",
        data.id,
        "Tentativa de revelar a senha sem permissão",
      );
      throw e;
    }
    const admin = await ehAdmin(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("senhas").select("nome, senha_cifrada").eq("id", data.id);
    query = porProprietario(query, ctx, admin);
    const { data: registro, error } = await query.maybeSingle();
    if (error || !registro) throw new Error("Credencial não encontrada.");
    const { decifrar } = await import("@/lib/senhas.server");
    await registrarAuditoria(
      ctx,
      data.motivo === "copiar" ? "COPIA_SENHA" : "REVELACAO",
      data.id,
      data.motivo === "copiar"
        ? `Copiou a senha do sistema ${registro.nome}`
        : `Visualizou a senha do sistema ${registro.nome}`,
    );
    return { senha: decifrar(registro.senha_cifrada) };
  });

export const registrarCopiaLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Contexto;
    await podeVer(ctx);
    const { data: registro } = await ctx.supabase
      .from("senhas")
      .select("nome")
      .eq("id", data.id)
      .maybeSingle();
    if (!registro) throw new Error("Credencial não encontrada.");
    await registrarAuditoria(
      ctx,
      "COPIA_LOGIN",
      data.id,
      `Copiou o login do sistema ${registro.nome}`,
    );
    return { ok: true };
  });
