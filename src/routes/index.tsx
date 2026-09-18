import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestão de Sistemas | Clínica CEU" },
      {
        name: "description",
        content:
          "Sistema interno da Clínica CEU para escala semanal, estoque com controle de validade e registros de enfermagem.",
      },
      { property: "og:title", content: "Gestão de Sistemas | Clínica CEU" },
      {
        property: "og:description",
        content: "Escala semanal, estoque FEFO e enfermagem em um só sistema.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <img
          src="/logo-ceu.png"
          alt="CEU Diagnósticos"
          className="mx-auto h-auto w-40 object-contain"
        />
        <h1 className="mt-3 text-2xl font-semibold text-foreground">Gestão de Sistemas</h1>
        <p className="mt-2 text-sm text-muted-foreground">Verificando seu acesso...</p>
      </div>
    </div>
  );
}
