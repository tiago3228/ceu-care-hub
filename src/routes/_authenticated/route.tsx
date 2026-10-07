import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return;
    } catch {
      // Uma sessão ausente ou inválida deve voltar ao login, sem derrubar o roteador.
    }
    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
