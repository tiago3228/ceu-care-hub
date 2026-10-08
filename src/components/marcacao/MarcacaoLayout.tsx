import type { ReactNode } from "react";
import { CalendarDays, MessageCircle, Stethoscope, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";

export type MarcacaoAba = "escala" | "medicos" | "colaboradores" | "chat";

const ABAS: {
  id: MarcacaoAba;
  rotulo: string;
  destino: string;
  modulo: string;
  Icone: typeof CalendarDays;
}[] = [
  {
    id: "escala",
    rotulo: "Escala semanal",
    destino: "/marcacao",
    modulo: "marcacao_escala_visualizar",
    Icone: CalendarDays,
  },
  {
    id: "medicos",
    rotulo: "Médicos",
    destino: "/marcacao-medicos",
    modulo: "marcacao_medicos_visualizar",
    Icone: Stethoscope,
  },
  {
    id: "colaboradores",
    rotulo: "Colaboradores",
    destino: "/marcacao-colaboradores",
    modulo: "marcacao_colaboradores_visualizar",
    Icone: Users,
  },
  {
    id: "chat",
    rotulo: "Chat da Marcação",
    destino: "/chat-marcacao",
    modulo: "chat_marcacao",
    Icone: MessageCircle,
  },
];

export function MarcacaoLayout({ aba, children }: { aba: MarcacaoAba; children: ReactNode }) {
  const { temModulo } = useSessao();
  const abasVisiveis = ABAS.filter((item) => temModulo(item.modulo));

  return (
    <AppShell
      titulo="Marcação"
      descricao="Escala semanal, equipe, médicos e comunicação da equipe de Marcação."
    >
      <div className="space-y-5">
        <nav
          aria-label="Seções da Marcação"
          className="flex flex-wrap gap-2 border-b border-border pb-3"
        >
          {abasVisiveis.map(({ id, rotulo, destino, Icone }) => (
            <a
              key={id}
              href={destino}
              aria-current={aba === id ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${aba === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
            >
              <Icone className="size-4" />
              {rotulo}
            </a>
          ))}
        </nav>
        {children}
      </div>
    </AppShell>
  );
}
