import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const LIMITE_ONLINE_MS = 2 * 60 * 1000;

export type Presenca = { user_id: string; ultimo_acesso: string };

export function usePresenca(userId: string | undefined, ativo = true) {
  const query = useQuery({
    queryKey: ["usuarios-presenca"],
    enabled: !!userId && ativo,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("usuario_presenca")
        .select("user_id, ultimo_acesso");
      if (error) throw error;
      return (data ?? []) as Presenca[];
    },
  });

  useEffect(() => {
    if (!userId || !ativo) return;
    const marcar = () => {
      void (supabase as any).rpc("marcar_usuario_online");
    };
    marcar();
    const intervalo = window.setInterval(marcar, 30_000);
    return () => window.clearInterval(intervalo);
  }, [ativo, userId]);

  const estaOnline = (id: string) => {
    const item = query.data?.find((p) => p.user_id === id);
    return !!item && Date.now() - new Date(item.ultimo_acesso).getTime() < LIMITE_ONLINE_MS;
  };

  return { ...query, estaOnline };
}
