import { createFileRoute } from "@tanstack/react-router";
import { MarcacaoLayout } from "@/components/marcacao/MarcacaoLayout";
import { MarcacaoWorkspace } from "@/components/marcacao/MarcacaoWorkspace";

export const Route = createFileRoute("/_authenticated/marcacao")({
  head: () => ({ meta: [{ title: "Escala de Marcação | Clínica CEU" }] }),
  component: PaginaEscalaMarcacao,
});

function PaginaEscalaMarcacao() {
  return (
    <MarcacaoLayout aba="escala">
      <MarcacaoWorkspace aba="escala" />
    </MarcacaoLayout>
  );
}
