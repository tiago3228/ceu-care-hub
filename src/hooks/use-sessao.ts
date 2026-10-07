import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ModuloChave, PerfilValor } from "@/lib/modulos";

export interface Sessao {
  userId: string;
  email: string | null;
  username: string | null;
  nome: string;
  setor: string | null;
  ativo: boolean;
  papeis: PerfilValor[];
  modulos: string[];
}

async function carregarSessao(): Promise<Sessao | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const [perfil, papeis, permissoes] = await Promise.all([
    (supabase as any)
      .from("profiles")
      .select("nome, setor, username, ativo")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("usuario_permissoes").select("modulo").eq("user_id", user.id),
  ]);

  return {
    userId: user.id,
    email: user.email ?? null,
    username: perfil.data?.username ?? null,
    nome: perfil.data?.nome || user.email?.split("@")[0] || "Usuário",
    setor: perfil.data?.setor ?? null,
    ativo: perfil.data?.ativo ?? true,
    papeis: (papeis.data ?? []).map((p) => p.role as PerfilValor),
    modulos: (permissoes.data ?? []).map((p) => p.modulo),
  };
}

export function useSessao() {
  const query = useQuery({ queryKey: ["sessao"], queryFn: carregarSessao, staleTime: 60_000 });
  const sessao = query.data ?? null;
  const isAdmin = !!sessao?.papeis.some((p) => p === "admin_master" || p === "administrador");
  const isMaster = !!sessao?.papeis.includes("admin_master");
  const somenteLeitura = !!sessao?.papeis.includes("visualizacao") && !isAdmin;

  const temModulo = (modulo: ModuloChave | string) =>
    !!sessao?.ativo && (isAdmin || sessao.modulos.includes(modulo));

  return { ...query, sessao, isAdmin, isMaster, somenteLeitura, temModulo };
}
