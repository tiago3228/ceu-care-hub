import { createFileRoute } from "@tanstack/react-router";
import { MarcacaoLayout } from "@/components/marcacao/MarcacaoLayout";
import { MarcacaoWorkspace } from "@/components/marcacao/MarcacaoWorkspace";

export const Route = createFileRoute("/_authenticated/marcacao-colaboradores")({
  head: () => ({ meta: [{ title: "Colaboradores da Marcação | Clínica CEU" }] }),
  component: PaginaColaboradoresMarcacao,
});

function PaginaColaboradoresMarcacao() {
  return (
    <MarcacaoLayout aba="colaboradores">
      <MarcacaoWorkspace aba="colaboradores" />
    </MarcacaoLayout>
  );
}
