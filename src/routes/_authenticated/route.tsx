import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return { user: data.user };
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
