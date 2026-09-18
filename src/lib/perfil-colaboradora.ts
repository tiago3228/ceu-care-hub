export type ColaboradoraPerfil = {
  tipo_colaboradora?: string | null;
  cargo?: string | null;
};

export function temPerfilEnfermagem(colaboradora: ColaboradoraPerfil) {
  const tipo = (colaboradora.tipo_colaboradora ?? "").trim().toLocaleLowerCase("pt-BR");
  const cargo = (colaboradora.cargo ?? "").trim().toLocaleLowerCase("pt-BR");
  return (
    [
      "enfermeira",
      "enfermagem",
      "técnica",
      "técnica de enfermagem",
      "técnico de enfermagem",
    ].includes(tipo) ||
    cargo.includes("enfermagem") ||
    cargo.includes("enfermeira") ||
    cargo.includes("enfermeiro")
  );
}
