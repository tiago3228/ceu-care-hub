import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const criarSchema = z.object({
  email: z.string().trim().email().max(255),
  senha: z.string().min(8).max(72),
  nome: z.string().trim().min(2).max(120),
  setor: z.string().trim().max(120).optional().nullable(),
  papel: z.enum([
    "admin_master",
    "administrador",
    "coordenacao",
    "enfermagem",
    "secretaria",
    "visualizacao",
  ]),
  modulos: z.array(z.string().trim().max(40)).max(40),
});

async function garantirAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (error) throw new Error("Não foi possível validar suas permissões.");
  if (!data) throw new Error("Apenas administradores podem gerenciar usuários.");
}

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => criarSchema.parse(input))
  .handler(async ({ data, context }) => {
    await garantirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const criado = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (criado.error || !criado.data.user) {
      throw new Error(criado.error?.message ?? "Falha ao criar o usuário.");
    }
    const id = criado.data.user.id;

    await supabaseAdmin
      .from("profiles")
      .upsert({ id, nome: data.nome, setor: data.setor ?? null, ativo: true });
    await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: data.papel });
    if (data.modulos.length) {
      await supabaseAdmin
        .from("usuario_permissoes")
        .upsert(data.modulos.map((modulo) => ({ user_id: id, modulo })));
    }
    return { id };
  });

export const definirSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), senha: z.string().min(8).max(72) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await garantirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.senha,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const existeAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true });
  return { existe: (count ?? 0) > 0 };
});

/**
 * Primeiro acesso do sistema: cria o administrador master.
 * Só funciona enquanto nenhum papel existir no banco (instalação virgem).
 */
export const criarPrimeiroAdmin = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        senha: z.string().min(8).max(72),
        nome: z.string().trim().min(2).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new Error("O sistema já possui administrador cadastrado.");

    const criado = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (criado.error || !criado.data.user) {
      throw new Error(criado.error?.message ?? "Falha ao criar o administrador.");
    }
    const id = criado.data.user.id;
    await supabaseAdmin.from("profiles").upsert({ id, nome: data.nome, ativo: true });
    await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: "admin_master" });
    return { ok: true };
  });
