import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9._-]{2,39}$/,
    "Usuário inválido. Use letras, números, ponto, hífen ou sublinhado.",
  );
const contaSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  username,
  setor: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  senha: z.string().min(8).max(72),
});

export const resolverLogin = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ login: z.string().trim().min(1).max(255) }).parse(input))
  .handler(async ({ data }) => {
    if (data.login.includes("@")) return { email: data.login.trim().toLowerCase() };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: perfil, error } = await supabaseAdmin
      .from("profiles")
      .select("login")
      .ilike("username", data.login.trim())
      .maybeSingle();
    if (error || !perfil?.login) throw new Error("Usuário ou senha incorretos.");
    return { email: perfil.login };
  });

export const criarContaPublica = createServerFn({ method: "POST" })
  .inputValidator((input) => contaSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existente = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    if (existente.data) throw new Error("Este usuário já está cadastrado.");
    const setor = await supabaseAdmin
      .from("setores")
      .select("id,nome,papel_padrao,permissoes_padrao")
      .ilike("nome", data.setor)
      .eq("ativo", true)
      .maybeSingle();
    if (!setor.data) throw new Error("Selecione um setor válido.");
    const configuracao = await supabaseAdmin
      .from("configuracoes_acesso")
      .select("valor")
      .eq("chave", "cadastro_automatico")
      .maybeSingle();
    const cadastroAutomatico = configuracao.data?.valor !== false;
    const criado = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome, username: data.username, setor: setor.data.nome },
    });
    if (criado.error || !criado.data.user)
      throw new Error(criado.error?.message ?? "Não foi possível criar sua conta.");
    const id = criado.data.user.id;
    await supabaseAdmin
      .from("profiles")
      .update({
        username: data.username,
        setor_id: setor.data.id,
        setor: setor.data.nome,
        login: data.email,
        ativo: cadastroAutomatico,
        data_cadastro: new Date().toISOString(),
      })
      .eq("id", id);
    if (cadastroAutomatico)
      await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: setor.data.papel_padrao });
    const modulos = (setor.data.permissoes_padrao ?? []) as string[];
    if (cadastroAutomatico && modulos.length)
      await supabaseAdmin
        .from("usuario_permissoes")
        .upsert(modulos.map((modulo) => ({ user_id: id, modulo })));
    await supabaseAdmin.from("auditoria_autenticacao").insert({
      user_id: id,
      username: data.username,
      email: data.email,
      acao: "CRIACAO_CONTA",
      dados: { setor: setor.data.nome, modo: cadastroAutomatico ? "automatico" : "pendente" },
    });
    return { id, email: data.email, cadastroAutomatico };
  });
