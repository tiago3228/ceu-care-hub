/** Utilitários de data no padrão brasileiro (DD-MM-AAAA na interface, ISO no banco). */

export function isoParaBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  if (!a || !m || !d) return "";
  return `${d}-${m}-${a}`;
}

export function brParaIso(br: string): string | null {
  const digitos = br.replace(/\D/g, "");
  if (digitos.length !== 8) return null;
  const d = digitos.slice(0, 2);
  const m = digitos.slice(2, 4);
  const a = digitos.slice(4, 8);
  const dia = Number(d);
  const mes = Number(m);
  const ano = Number(a);
  if (mes < 1 || mes > 12 || dia < 1 || ano < 1900) return null;
  const teste = new Date(Date.UTC(ano, mes - 1, dia));
  if (teste.getUTCMonth() !== mes - 1 || teste.getUTCDate() !== dia) return null;
  return `${a}-${m}-${d}`;
}

/** Formata digitação livre (só números) em DD-MM-AAAA enquanto o usuário digita. */
export function mascaraDataBr(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
}

/** Soma dias a uma data ISO civil sem convertê-la para o fuso horário local. */
export function somarDiasIso(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() + dias);
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

/** Retorna o dia da semana de uma data ISO: 0 domingo, 1 segunda, ... 6 sábado. */
export function diaSemanaIso(iso: string): number {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/** Retorna a segunda-feira da semana da data local atual. */
export function segundaDaSemanaAtual(): string {
  const agora = new Date();
  const iso = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
  const deslocamento = diaSemanaIso(iso) === 0 ? 6 : diaSemanaIso(iso) - 1;
  return somarDiasIso(iso, -deslocamento);
}

export function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type StatusValidade = "normal" | "alerta" | "vencido";

/** Mesma regra do services/estoque.py: vencido / alerta / normal. */
export function statusValidade(
  validadeIso: string | null | undefined,
  diasAlerta: number,
): StatusValidade {
  if (!validadeIso) return "normal";
  const hoje = new Date(hojeIso());
  const validade = new Date(validadeIso.slice(0, 10));
  if (Number.isNaN(validade.getTime())) return "normal";
  if (validade < hoje) return "vencido";
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + diasAlerta);
  return validade <= limite ? "alerta" : "normal";
}
