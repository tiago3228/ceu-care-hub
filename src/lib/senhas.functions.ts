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

const schemaSenha = z.object({
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
  senha: z.string().min(1, "Informe a senha.").max(500),
  observacoes: z.string().trim().max(1000).optional().nullable(),
  categoria: z.string().trim().max(60).optional().nullable(),
});

type Contexto = { supabase: any; userId: string };

async function podeVer(context: Contexto) {
  const { data, error } = await context.supabase.rpc("tem_modulo", {
    _user_id: context.userId,
    _modulo: "senhas",
  });
  if (error) throw new Error("Não foi possível validar suas permissões.");
  if (!data) throw new Error("Você não tem permissão para acessar o cofre de senhas.");
}

async function podeEditar(context: Contexto) {
  await podeVer(context);
  const { data, error } = await context.supabase.rpc("pode_editar", {
    _user_id: context.userId,
    _modulo: "senhas",
  });
  if (error) throw new Error("Não foi possível validar suas permissões.");
  if (!data) throw new Error("Você não tem permissão para alterar credenciais.");
}

async function podeRevelar(context: Contexto) {
  await podeVer(context);
  const { data, error } = await context.supabase.rpc("tem_modulo", {
    _user_id: context.userId,
    _modulo: "senhas_revelar",
  });
  if (error) throw new Error("Não foi possível validar suas permissões.");
  if (!data) throw new Error("Você não tem permissão para revelar senhas.");
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

export const salvarSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schemaSenha.parse(input))
  .handler(async ({ data, context }) => {
    await podeEditar(context as Contexto);
    const { cifrar } = await import("@/lib/senhas.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      nome: data.nome,
      url: data.url?.trim() ? data.url.trim() : null,
      login: data.login,
      senha_cifrada: cifrar(data.senha),
      observacoes: data.observacoes?.trim() || null,
      categoria: data.categoria?.trim() || null,
      atualizado_por: context.userId,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("senhas").update(payload).eq("id", data.id);
      if (error) throw new Error("Não foi possível salvar a credencial.");
      return { id: data.id };
    }

    const { data: criado, error } = await supabaseAdmin
      .from("senhas")
      .insert({ ...payload, criado_por: context.userId })
      .select("id")
      .single();
    if (error || !criado) throw new Error("Não foi possível salvar a credencial.");
    return { id: criado.id };
  });

export const excluirSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    await podeEditar(context as Contexto);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("senhas").delete().eq("id", data.id);
    if (error) throw new Error("Não foi possível excluir a credencial.");
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
      await podeRevelar(ctx);
    } catch (e) {
      await registrarAuditoria(
        ctx,
        "ACESSO_NEGADO",
        data.id,
        "Tentativa de revelar a senha sem permissão",
      );
      throw e;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: registro, error } = await supabaseAdmin
      .from("senhas")
      .select("nome, senha_cifrada")
      .eq("id", data.id)
      .maybeSingle();
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
    await registrarAuditoria(
      ctx,
      "COPIA_LOGIN",
      data.id,
      `Copiou o login do sistema ${registro?.nome ?? data.id}`,
    );
    return { ok: true };
  });
