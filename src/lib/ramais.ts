export interface Ramal {
  id: number;
  numero: string | null;
  setor: string | null;
  responsavel: string | null;
  localizacao: string | null;
  categoria: string | null;
  situacao: string;
  observacoes: string | null;
}

export const SITUACOES = [
  "Em uso",
  "Livre",
  "Sem utilização",
  "Usuário ausente",
  "Só chama",
  "Inativo",
] as const;

export type Situacao = (typeof SITUACOES)[number];

/** Situações que representam um ramal disponível para futura utilização. */
export const SITUACOES_LIVRES: string[] = [
  "Livre",
  "Sem utilização",
  "Usuário ausente",
  "Só chama",
];

export const CATEGORIAS = [
  "Administração",
  "Enfermagem",
  "Financeiro",
  "RH/DP",
  "Recepção",
  "Marcação",
  "Mamografia",
  "Medicina Nuclear",
  "Salas de Atendimento",
  "Compras",
  "Faturamento",
  "Manutenção",
  "Qualidade",
  "Portaria",
  "Matriz",
  "Outros",
];

export function tomSituacao(situacao: string) {
  switch (situacao) {
    case "Em uso":
      return "bg-info-suave text-info";
    case "Livre":
      return "bg-verde-suave text-verde";
    case "Inativo":
      return "bg-vermelho-suave text-vermelho";
    default:
      return "bg-amarelo-suave text-amarelo-foreground";
  }
}

export function combina(r: Ramal, termo: string) {
  if (!termo) return true;
  const t = termo.trim().toLowerCase();
  return [r.numero, r.setor, r.responsavel, r.localizacao, r.categoria, r.observacoes]
    .filter(Boolean)
    .some((v) => (v as string).toLowerCase().includes(t));
}

export function ordenar(a: Ramal, b: Ramal) {
  if (!a.numero) return 1;
  if (!b.numero) return -1;
  return a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });
}
