import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const papéis = z.enum([
  "admin_master",
  "administrador",
  "coordenacao",
  "enfermagem",
  "secretaria",
  "recepcao",
  "marcacao",
  "comercial",
  "qualidade",
  "rh",
  "manutencao",
  "medicos",
  "diretoria",
  "sondas",
  "visualizacao",
]);
const criarSchema = z.object({
  email: z.string().trim().email().max(255),
  senha: z.string().min(8).max(72),
  nome: z.string().trim().min(2).max(120),
  setor: z.string().trim().max(120).optional().nullable(),
  papel: papéis,
  modulos: z.array(z.string().trim().max(80)).max(80),
});
const editarSchema = z.object({
  userId: z.string().uuid(),
  nome: z.string().trim().min(2).max(120),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._-]{2,39}$/),
  email: z.string().trim().email().max(255),
  setorId: z.number().int().positive().nullable(),
  setor: z.string().trim().max(120).nullable(),
  ativo: z.boolean(),
  papel: papéis,
  modulos: z.array(z.string().trim().max(80)).max(80),
  senha: z.string().min(8).max(72).optional().or(z.literal("")),
});

async function garantirAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (error) throw new Error("Não foi possível validar suas permissões.");
  if (!data) throw new Error("Apenas administradores podem gerenciar usuários.");
}

export const listarSetoresPublicos = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("setores")
    .select("id,nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error("Não foi possível carregar os setores.");
  return data ?? [];
});

export const editarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => editarSchema.parse(input))
  .handler(async ({ data, context }) => {
    await garantirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const usuario = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (usuario.error || !usuario.data.user) throw new Error("Usuário não encontrado.");
    const atualizado = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: data.email,
      email_confirm: true,
      password: data.senha || undefined,
      user_metadata: {
        ...usuario.data.user.user_metadata,
        nome: data.nome,
        username: data.username,
        setor: data.setor,
      },
    });
    if (atualizado.error) throw new Error(atualizado.error.message);
    const perfil = await supabaseAdmin
      .from("profiles")
      .update({
        nome: data.nome,
        username: data.username,
        login: data.email,
        setor_id: data.setorId,
        setor: data.setor,
        ativo: data.ativo,
      })
      .eq("id", data.userId);
    if (perfil.error) throw new Error(perfil.error.message);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const papel = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.papel });
    if (papel.error) throw new Error(papel.error.message);
    await supabaseAdmin.from("usuario_permissoes").delete().eq("user_id", data.userId);
    if (data.modulos.length) {
      const perms = await supabaseAdmin
        .from("usuario_permissoes")
        .insert(data.modulos.map((modulo) => ({ user_id: data.userId, modulo })));
      if (perms.error) throw new Error(perms.error.message);
    }
    await supabaseAdmin.from("auditoria_autenticacao").insert({
      user_id: data.userId,
      username: data.username,
      email: data.email,
      acao: "ALTERACAO_USUARIO",
      dados: {
        setor: data.setor,
        ativo: data.ativo,
        papel: data.papel,
        senha_alterada: !!data.senha,
      },
    });
    return { ok: true };
  });

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
    if (criado.error || !criado.data.user)
      throw new Error(criado.error?.message ?? "Falha ao criar o usuário.");
    const id = criado.data.user.id;
    await supabaseAdmin.auth.admin.updateUserById(id, { email_confirm: true });
    await supabaseAdmin
      .from("profiles")
      .upsert({ id, nome: data.nome, setor: data.setor ?? null, ativo: true });
    await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: data.papel });
    if (data.modulos.length)
      await supabaseAdmin
        .from("usuario_permissoes")
        .upsert(data.modulos.map((modulo) => ({ user_id: id, modulo })));
    await supabaseAdmin.from("auditoria_autenticacao").insert({
      user_id: id,
      email: data.email,
      acao: "CRIACAO_ADMINISTRATIVA",
      dados: { nome: data.nome, setor: data.setor, papel: data.papel },
    });
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
    await supabaseAdmin
      .from("auditoria_autenticacao")
      .insert({ user_id: data.userId, acao: "TROCA_SENHA", dados: { origem: "administrador" } });
    return { ok: true };
  });

export const excluirUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await garantirAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("Não é possível excluir o próprio usuário.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const usuario = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (usuario.error || !usuario.data.user) throw new Error("Usuário não encontrado.");
    const email = usuario.data.user.email ?? null;
    const roles = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId);
    if (roles.data?.some((r) => r.role === "admin_master")) {
      throw new Error("O usuário mestre não pode ser excluído.");
    }
    const perfil = await supabaseAdmin
      .from("profiles")
      .select("nome,username,setor")
      .eq("id", data.userId)
      .maybeSingle();
    const auditoria = await supabaseAdmin.from("auditoria_autenticacao").insert({
      user_id: null,
      username: perfil.data?.username ?? null,
      email,
      acao: "EXCLUSAO_USUARIO",
      dados: { nome: perfil.data?.nome ?? null, setor: perfil.data?.setor ?? null },
    });
    if (auditoria.error) throw new Error(auditoria.error.message);
    const removido = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (removido.error) throw new Error(removido.error.message);
    return { ok: true };
  });

export const existeAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true });
  return { existe: (count ?? 0) > 0 };
});

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
    if (criado.error || !criado.data.user)
      throw new Error(criado.error?.message ?? "Falha ao criar o administrador.");
    const id = criado.data.user.id;
    await supabaseAdmin.auth.admin.updateUserById(id, { email_confirm: true });
    await supabaseAdmin.from("profiles").upsert({ id, nome: data.nome, ativo: true });
    await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: "admin_master" });
    return { ok: true };
  });
