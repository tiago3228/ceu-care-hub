import { supabase } from "@/integrations/supabase/client";
import { hojeIso } from "@/lib/datas";

export interface Item {
  id: number;
  codigo: string | null;
  nome: string;
  tipo: string;
  grupo: string | null;
  unidade: string | null;
  referencia: string | null;
  anvisa: string | null;
  preco: number | null;
  custo: number | null;
  ativo: boolean;
  el: boolean;
  cs: boolean;
  be: boolean;
  controla_validade: boolean;
}

export interface Lote {
  id: number;
  item_id: number;
  lote: string | null;
  validade: string | null;
  quantidade: number;
  localizacao: string | null;
  data_entrada: string;
}

export type TipoMovimentacao = "entrada" | "saida" | "ajuste" | "descarte";

export const TIPOS_ITEM = ["Material", "Medicamento", "Insumo", "Outros"];

export function horaAgora(): string {
  return new Date().toTimeString().slice(0, 5);
}

/** Dias de alerta de validade configurados no sistema (padrão 30, como no desktop). */
export async function diasAlertaValidade(): Promise<number> {
  const { data } = await supabase
    .from("configuracoes_sistema")
    .select("valor")
    .eq("chave", "dias_alerta_validade")
    .maybeSingle();
  const n = Number(data?.valor);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

interface ContextoMov {
  userId: string | null;
  usuarioNome: string | null;
  observacoes?: string | null;
  responsavelId?: number | null;
  solicitacaoItemId?: number | null;
}

async function registrarMovimentacao(
  itemId: number,
  loteId: number | null,
  tipo: TipoMovimentacao,
  quantidade: number,
  ctx: ContextoMov,
) {
  const { error } = await supabase.from("movimentacoes_estoque").insert({
    item_id: itemId,
    lote_id: loteId,
    tipo,
    quantidade,
    data: hojeIso(),
    hora: horaAgora(),
    responsavel_id: ctx.responsavelId ?? null,
    solicitacao_item_id: ctx.solicitacaoItemId ?? null,
    observacoes: ctx.observacoes ?? null,
    user_id: ctx.userId,
    usuario_nome: ctx.usuarioNome,
  });
  if (error) throw error;
}

/** Entrada de estoque: cria (ou soma em) um lote e registra a movimentação. */
export async function darEntrada(params: {
  itemId: number;
  lote: string | null;
  validade: string | null;
  quantidade: number;
  localizacao: string | null;
  ctx: ContextoMov;
}) {
  const { itemId, lote, validade, quantidade, localizacao, ctx } = params;
  if (!(quantidade > 0)) throw new Error("Informe uma quantidade maior que zero.");

  const { data: existentes, error: erroBusca } = await supabase
    .from("lotes")
    .select("*")
    .eq("item_id", itemId);
  if (erroBusca) throw erroBusca;

  const igual = (existentes ?? []).find(
    (l) => (l.lote ?? "") === (lote ?? "") && (l.validade ?? "") === (validade ?? ""),
  ) as Lote | undefined;

  let loteId: number;
  if (igual) {
    const { error } = await supabase
      .from("lotes")
      .update({ quantidade: Number(igual.quantidade) + quantidade, localizacao: localizacao ?? igual.localizacao })
      .eq("id", igual.id);
    if (error) throw error;
    loteId = igual.id;
  } else {
    const { data, error } = await supabase
      .from("lotes")
      .insert({
        item_id: itemId,
        lote: lote || null,
        validade: validade || null,
        quantidade,
        localizacao: localizacao || null,
        data_entrada: hojeIso(),
      })
      .select("id")
      .single();
    if (error) throw error;
    loteId = data.id as number;
  }

  await registrarMovimentacao(itemId, loteId, "entrada", quantidade, ctx);
  return loteId;
}

export interface AlocacaoFefo {
  loteId: number;
  lote: string | null;
  validade: string | null;
  quantidade: number;
}

/**
 * FEFO (first expired, first out) — mesma regra do services/estoque.py:
 * consome primeiro o lote com validade mais próxima; lotes vencidos NUNCA são
 * consumidos automaticamente (precisam de descarte/ajuste manual).
 */
export function planejarFefo(lotes: Lote[], quantidade: number): {
  alocacoes: AlocacaoFefo[];
  faltante: number;
} {
  const hoje = hojeIso();
  const disponiveis = lotes
    .filter((l) => Number(l.quantidade) > 0)
    .filter((l) => !l.validade || l.validade.slice(0, 10) >= hoje)
    .sort((a, b) => {
      const va = a.validade ?? "9999-12-31";
      const vb = b.validade ?? "9999-12-31";
      if (va !== vb) return va < vb ? -1 : 1;
      return a.data_entrada < b.data_entrada ? -1 : 1;
    });

  const alocacoes: AlocacaoFefo[] = [];
  let restante = quantidade;
  for (const l of disponiveis) {
    if (restante <= 0) break;
    const usar = Math.min(restante, Number(l.quantidade));
    alocacoes.push({ loteId: l.id, lote: l.lote, validade: l.validade, quantidade: usar });
    restante -= usar;
  }
  return { alocacoes, faltante: Math.max(0, restante) };
}

/** Baixa de estoque por FEFO. Retorna os lotes efetivamente consumidos. */
export async function darSaidaFefo(params: {
  itemId: number;
  quantidade: number;
  tipo?: TipoMovimentacao;
  ctx: ContextoMov;
}): Promise<AlocacaoFefo[]> {
  const { itemId, quantidade, ctx } = params;
  const tipo = params.tipo ?? "saida";
  if (!(quantidade > 0)) throw new Error("Informe uma quantidade maior que zero.");

  const { data, error } = await supabase.from("lotes").select("*").eq("item_id", itemId);
  if (error) throw error;

  const { alocacoes, faltante } = planejarFefo((data ?? []) as Lote[], quantidade);
  if (faltante > 0) {
    throw new Error(
      `Saldo insuficiente em lotes válidos: faltam ${faltante}. Verifique lotes vencidos ou registre uma entrada.`,
    );
  }

  for (const a of alocacoes) {
    const atual = (data ?? []).find((l) => l.id === a.loteId) as Lote;
    const { error: erroUp } = await supabase
      .from("lotes")
      .update({ quantidade: Number(atual.quantidade) - a.quantidade })
      .eq("id", a.loteId);
    if (erroUp) throw erroUp;
    await registrarMovimentacao(itemId, a.loteId, tipo, a.quantidade, ctx);
  }
  return alocacoes;
}

/** Ajuste/descarte direto em um lote específico (inclusive vencido). */
export async function ajustarLote(params: {
  lote: Lote;
  novaQuantidade: number;
  tipo: "ajuste" | "descarte";
  ctx: ContextoMov;
}) {
  const { lote, novaQuantidade, tipo, ctx } = params;
  if (novaQuantidade < 0) throw new Error("A quantidade não pode ser negativa.");
  const diferenca = novaQuantidade - Number(lote.quantidade);
  const { error } = await supabase.from("lotes").update({ quantidade: novaQuantidade }).eq("id", lote.id);
  if (error) throw error;
  await registrarMovimentacao(lote.item_id, lote.id, tipo, Math.abs(diferenca), ctx);
}
