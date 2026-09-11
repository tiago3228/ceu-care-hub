/** Camada de dados da escala: só roda no servidor (server functions). */
import {
  avaliarCompatibilidade,
  detectarConflitos,
  diaSemanaIso,
  periodoPorHorario,
  pontuarColaboradoras,
  type ColaboradoraRegra,
  type MedicoRegra,
} from "@/lib/escala.server";

type Cliente = any;
interface Contexto {
  supabase: Cliente;
  userId: string;
}

const DIAS_BASE = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function normalizar(txt: string | null | undefined) {
  return (txt ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function garantirEdicao(context: Contexto) {
  const [admin, secretaria, legado, especifica] = await Promise.all([
    context.supabase.rpc("is_admin", { _user_id: context.userId }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "secretaria" }),
    context.supabase.rpc("pode_editar", { _user_id: context.userId, _modulo: "escalas" }),
    context.supabase.rpc("pode_editar", { _user_id: context.userId, _modulo: "escalas_editar" }),
  ]);
  if ([admin, secretaria, legado, especifica].some((resultado) => resultado.error)) {
    throw new Error("Não foi possível validar suas permissões.");
  }
  if (!admin.data && (secretaria.data || (!legado.data && !especifica.data))) {
    throw new Error("Você tem acesso somente para visualizar a escala.");
  }
}

async function registrarAuditoria(
  context: Contexto,
  operacao: string,
  registroId: string,
  anteriores: unknown,
  novos: unknown,
  observacoes?: string | null,
) {
  const { data: perfil } = await context.supabase
    .from("profiles")
    .select("nome")
    .eq("id", context.userId)
    .maybeSingle();
  await context.supabase.from("audit_logs").insert({
    user_id: context.userId,
    usuario_nome: perfil?.nome ?? null,
    tabela: "escalas",
    operacao,
    registro_id: registroId,
    dados_anteriores: anteriores ?? null,
    dados_novos: novos ?? null,
    observacoes: observacoes ?? null,
  });
}

export async function carregarApoioEscala(supabase: Cliente) {
  const [salas, medicos, colaboradoras] = await Promise.all([
    supabase
      .from("salas")
      .select("id, nome, unidade, especialidade_principal, horario_inicio, horario_fim, ativa")
      .eq("ativa", true)
      .order("nome"),
    supabase
      .from("medicos")
      .select(
        "id, nome, apelido, crm, especialidade_principal, especialidades, necessita_experiente, colaboradora_padrao_id, ativo",
      )
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("colaboradoras")
      .select(
        "id, nome, cargo, jornada, entrada, saida, especialidades, treinamentos, atende_todos_medicos, medico_padrao_id, desativada",
      )
      .eq("desativada", false)
      .order("nome"),
  ]);
  return {
    salas: salas.data ?? [],
    medicos: medicos.data ?? [],
    colaboradoras: colaboradoras.data ?? [],
  };
}

export async function carregarSemanaEscala(supabase: Cliente, inicio: string, fim: string) {
  const [escalas, ausencias] = await Promise.all([
    supabase
      .from("escalas")
      .select(
        "id, data, sala_id, medico_id, horario_inicio, horario_fim, periodo, status_compatibilidade, motivo_alerta, observacoes, escala_colaboradoras(colaboradora_id, alerta_ignorado)",
      )
      .gte("data", inicio)
      .lte("data", fim)
      .order("data")
      .order("horario_inicio"),
    supabase
      .from("ausencias")
      .select("id, colaboradora_id, medico_id, tipo, data_inicio, data_fim")
      .lte("data_inicio", fim)
      .gte("data_fim", inicio),
  ]);
  return { escalas: escalas.data ?? [], ausencias: ausencias.data ?? [] };
}

async function indisponiveisNaData(supabase: Cliente, data: string) {
  const { data: aus } = await supabase
    .from("ausencias")
    .select("colaboradora_id")
    .lte("data_inicio", data)
    .gte("data_fim", data);
  return new Set<number>(
    (aus ?? []).map((a: { colaboradora_id: number | null }) => a.colaboradora_id).filter(Boolean),
  );
}

export async function sugerirParaEscala(
  supabase: Cliente,
  data: string,
  medicoId: number | null,
  salaId: number | null,
) {
  const [apoio, vinculosMedico, vinculosSala, historico, indisponiveis] = await Promise.all([
    carregarApoioEscala(supabase),
    supabase.from("colaboradora_medicos_padrao").select("colaboradora_id, medico_id"),
    supabase.from("sala_colaboradoras").select("colaboradora_id, sala_id"),
    supabase
      .from("escala_colaboradoras")
      .select("colaboradora_id, escalas!inner(data, medico_id, sala_id)")
      .order("colaboradora_id")
      .limit(4000),
    indisponiveisNaData(supabase, data),
  ]);

  const medico = (apoio.medicos as MedicoRegra[]).find((m) => m.id === medicoId) ?? null;
  const hist = (historico.data ?? []).map(
    (h: {
      colaboradora_id: number;
      escalas: { data: string; medico_id: number | null; sala_id: number | null };
    }) => ({
      colaboradora_id: h.colaboradora_id,
      medico_id: h.escalas?.medico_id ?? null,
      sala_id: h.escalas?.sala_id ?? null,
      dia_semana: h.escalas?.data ? diaSemanaIso(h.escalas.data) : -1,
    }),
  );

  return pontuarColaboradoras({
    colaboradoras: apoio.colaboradoras as ColaboradoraRegra[],
    medico,
    salaId,
    diaSemana: diaSemanaIso(data),
    vinculosMedico: vinculosMedico.data ?? [],
    vinculosSala: vinculosSala.data ?? [],
    historico: hist,
    indisponiveis,
  });
}

export interface EntradaEscala {
  id?: number | null | undefined;
  data: string;
  salaId: number | null;
  medicoId: number | null;
  horarioInicio?: string | null | undefined;
  horarioFim?: string | null | undefined;
  observacoes?: string | null | undefined;
  colaboradoraIds: number[];
  confirmarAlertas?: boolean | undefined;
}

export async function salvarEscalaCompleta(context: Contexto, entrada: EntradaEscala) {
  await garantirEdicao(context);
  const supabase = context.supabase;
  const apoio = await carregarApoioEscala(supabase);

  const medico = (apoio.medicos as MedicoRegra[]).find((m) => m.id === entrada.medicoId) ?? null;
  const colaboradoras = (apoio.colaboradoras as ColaboradoraRegra[]).filter((c) =>
    entrada.colaboradoraIds.includes(c.id),
  );

  const { data: doDia } = await supabase
    .from("escalas")
    .select(
      "id, sala_id, medico_id, horario_inicio, horario_fim, escala_colaboradoras(colaboradora_id)",
    )
    .eq("data", entrada.data);

  const nomeSala = (id: number | null) =>
    apoio.salas.find((s: { id: number }) => s.id === id)?.nome ?? "outra sala";
  const conflitos = detectarConflitos({
    escalaId: entrada.id ?? null,
    medicoId: entrada.medicoId,
    salaId: entrada.salaId,
    horarioInicio: entrada.horarioInicio ?? null,
    horarioFim: entrada.horarioFim ?? null,
    colaboradoraIds: entrada.colaboradoraIds,
    existentes: doDia ?? [],
    nomeMedico: (id) => apoio.medicos.find((m: { id: number }) => m.id === id)?.nome ?? "Médico",
    nomeColaboradora: (id) =>
      apoio.colaboradoras.find((c: { id: number }) => c.id === id)?.nome ?? "Colaboradora",
    nomeSala,
  });

  const compat = avaliarCompatibilidade(medico, colaboradoras);
  const ausencias = entrada.colaboradoraIds.length
    ? await supabase
        .from("ausencias")
        .select("colaboradora_id, tipo, observacoes")
        .in("colaboradora_id", entrada.colaboradoraIds)
        .lte("data_inicio", entrada.data)
        .gte("data_fim", entrada.data)
    : { data: [] };
  const alertasJornada = colaboradoras
    .filter(
      (c: any) =>
        normalizar(c.jornada).includes("meio") || normalizar(c.jornada).includes("parcial"),
    )
    .map(
      (c: any) =>
        `${c.nome} trabalha em meio período${c.entrada && c.saida ? ` (${c.entrada} às ${c.saida})` : ""} e pode não cobrir a agenda toda. Deseja realmente adicioná-la?`,
    );
  const alertasAusencia = (ausencias.data ?? []).map((a: any) => {
    const nome = colaboradoras.find((c: any) => c.id === a.colaboradora_id)?.nome ?? "Colaboradora";
    return `${nome} está marcada como ausente${a.tipo ? ` (${a.tipo})` : ""}${a.observacoes ? `: ${a.observacoes}` : ""}. Deseja realmente adicioná-la?`;
  });
  const alertas = [...conflitos, ...compat.motivos, ...alertasJornada, ...alertasAusencia];

  if (alertas.length && !entrada.confirmarAlertas) {
    // Alertas nunca bloqueiam: devolvemos para confirmação explícita do usuário.
    return { salvo: false as const, alertas, conflitos, status: compat.status };
  }

  const registro = {
    data: entrada.data,
    sala_id: entrada.salaId,
    medico_id: entrada.medicoId,
    horario_inicio: entrada.horarioInicio ?? null,
    horario_fim: entrada.horarioFim ?? null,
    periodo: periodoPorHorario(entrada.horarioInicio ?? null),
    status_compatibilidade:
      conflitos.length && compat.status === "verde" ? "amarelo" : compat.status,
    motivo_alerta: alertas.length ? alertas.join(" | ") : null,
    observacoes: entrada.observacoes ?? null,
    updated_by: context.userId,
  };

  let escalaId = entrada.id ?? null;
  let anteriores: unknown = null;

  if (escalaId) {
    const { data: antes } = await supabase
      .from("escalas")
      .select("*")
      .eq("id", escalaId)
      .maybeSingle();
    anteriores = antes;
    const { error } = await supabase.from("escalas").update(registro).eq("id", escalaId);
    if (error) throw new Error(error.message);
    await supabase.from("escala_colaboradoras").delete().eq("escala_id", escalaId);
  } else {
    const { data: criada, error } = await supabase
      .from("escalas")
      .insert({ ...registro, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    escalaId = criada.id as number;
  }

  if (entrada.colaboradoraIds.length) {
    const { error } = await supabase.from("escala_colaboradoras").insert(
      entrada.colaboradoraIds.map((colaboradora_id) => ({
        escala_id: escalaId,
        colaboradora_id,
        alerta_ignorado: alertas.length ? "sim" : null,
      })),
    );
    if (error) throw new Error(error.message);
  }

  await registrarAuditoria(
    context,
    entrada.id ? "UPDATE" : "INSERT",
    String(escalaId),
    anteriores,
    { ...registro, colaboradoras: entrada.colaboradoraIds },
    alertas.length ? `Alertas confirmados: ${alertas.join(" | ")}` : null,
  );

  return { salvo: true as const, id: escalaId, alertas, conflitos, status: compat.status };
}

export async function removerEscala(context: Contexto, id: number) {
  await garantirEdicao(context);
  const { data: antes } = await context.supabase
    .from("escalas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const { error } = await context.supabase.from("escalas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await registrarAuditoria(context, "DELETE", String(id), antes, null);
  return { ok: true };
}

/** Clona a escala base (grade fixa por dia da semana) para a semana informada. */
export async function gerarSemanaPelaBase(context: Contexto, inicio: string) {
  await garantirEdicao(context);
  const supabase = context.supabase;

  const { data: base } = await supabase
    .from("escala_base")
    .select(
      "id, dia_semana, periodo, sala_id, medico_id, horario_inicio, horario_fim, observacoes, escala_base_colaboradoras(colaboradora_id)",
    );
  if (!base?.length) return { criadas: 0, ignoradas: 0 };

  const inicioData = new Date(`${inicio}T00:00:00Z`);
  const datas: { iso: string; dia: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicioData);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    datas.push({ iso, dia: d.getUTCDay() });
  }

  const { data: existentes } = await supabase
    .from("escalas")
    .select("data, sala_id, medico_id, horario_inicio")
    .gte("data", datas[0]!.iso)
    .lte("data", datas[6]!.iso);

  let criadas = 0;
  let ignoradas = 0;

  for (const linha of base) {
    const alvo = datas.find((d) => normalizar(DIAS_BASE[d.dia]) === normalizar(linha.dia_semana));
    if (!alvo) {
      ignoradas++;
      continue;
    }
    const jaExiste = (existentes ?? []).some(
      (e: {
        data: string;
        sala_id: number | null;
        medico_id: number | null;
        horario_inicio: string | null;
      }) =>
        e.data === alvo.iso &&
        e.sala_id === linha.sala_id &&
        e.medico_id === linha.medico_id &&
        (e.horario_inicio ?? "") === (linha.horario_inicio ?? ""),
    );
    if (jaExiste) {
      ignoradas++;
      continue;
    }

    const colaboradoraIds = (linha.escala_base_colaboradoras ?? []).map(
      (c: { colaboradora_id: number }) => c.colaboradora_id,
    );
    const resultado = await salvarEscalaCompleta(context, {
      data: alvo.iso,
      salaId: linha.sala_id,
      medicoId: linha.medico_id,
      horarioInicio: linha.horario_inicio,
      horarioFim: linha.horario_fim,
      observacoes: linha.observacoes,
      colaboradoraIds,
      confirmarAlertas: true,
    });
    if (resultado.salvo) criadas++;
    else ignoradas++;
  }

  return { criadas, ignoradas };
}
