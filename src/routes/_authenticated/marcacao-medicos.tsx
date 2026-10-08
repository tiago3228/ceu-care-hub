import { createFileRoute } from "@tanstack/react-router";
import { MarcacaoLayout } from "@/components/marcacao/MarcacaoLayout";
import { MarcacaoWorkspace } from "@/components/marcacao/MarcacaoWorkspace";

export const Route = createFileRoute("/_authenticated/marcacao-medicos")({
  head: () => ({ meta: [{ title: "Médicos da Marcação | Clínica CEU" }] }),
  component: PaginaMedicosMarcacao,
});

function PaginaMedicosMarcacao() {
  return (
    <MarcacaoLayout aba="medicos">
      <MarcacaoWorkspace aba="medicos" />
    </MarcacaoLayout>
  );
}
