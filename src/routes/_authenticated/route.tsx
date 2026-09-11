import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) return { user: data.session.user };
      } catch {
        // A storage lock pode rejeitar uma leitura durante a restauração da sessão.
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
