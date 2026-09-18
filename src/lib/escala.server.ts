/**
 * Regras de negócio da escala, portadas do sistema desktop:
 * - services/sugestao.py (pontuação: nunca bloqueio)
 * - services/conflito_e_auditoria.py (sobreposição de horários em minutos)
 * - services/validacao_requisitos.py (compatibilidade verde/amarelo/vermelho)
 */

export type StatusCompatibilidade = "verde" | "amarelo" | "vermelho";

export function minutosDoHorario(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2})[:h]?(\d{2})?$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Sobreposição de intervalos; horários ausentes são tratados como "dia inteiro". */
export function horariosSobrepoem(
  aIni: string | null,
  aFim: string | null,
  bIni: string | null,
  bFim: string | null,
): boolean {
  const a1 = minutosDoHorario(aIni) ?? 0;
  const a2 = minutosDoHorario(aFim) ?? 24 * 60;
  const b1 = minutosDoHorario(bIni) ?? 0;
  const b2 = minutosDoHorario(bFim) ?? 24 * 60;
  return a1 < b2 && b1 < a2;
}

/** Campos multivalorados em texto do sistema antigo ("US, DOPPLER; MAMA"). */
export function listaTexto(valor: string | null | undefined): string[] {
  if (!valor) return [];
  return valor
    .split(/[,;/|\n]/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
}

export function ehExperiente(treinamentos: string | null | undefined): boolean {
  return listaTexto(treinamentos).some((t) => t.includes("EXPERIENTE"));
}

export interface MedicoRegra {
  id: number;
  nome: string;
  apelido?: string | null;
  especialidades: string | null;
  especialidade_principal: string | null;
  necessita_experiente: boolean;
  colaboradora_padrao_id: number | null;
}

export interface ColaboradoraRegra {
  id: number;
  nome: string;
  apelido?: string | null;
  tipo_colaboradora?: string | null;
  especialidades: string | null;
  treinamentos: string | null;
  atende_todos_medicos: boolean;
  medico_padrao_id: number | null;
  cargo: string | null;
  desativada: boolean;
}

export function especialidadesMedico(medico: MedicoRegra): string[] {
  const lista = listaTexto(medico.especialidades);
  const principal = listaTexto(medico.especialidade_principal);
  return Array.from(new Set([...lista, ...principal]));
}

/** Status salvo em escalas.status_compatibilidade + motivo_alerta. */
export function avaliarCompatibilidade(
  medico: MedicoRegra | null,
  colaboradoras: ColaboradoraRegra[],
): { status: StatusCompatibilidade; motivos: string[] } {
  const motivos: string[] = [];
  if (!medico) {
    return { status: "amarelo", motivos: ["Escala sem médico definido."] };
  }
  if (!colaboradoras.length) {
    return { status: "amarelo", motivos: ["Nenhuma colaboradora escalada."] };
  }

  let status: StatusCompatibilidade = "verde";

  if (medico.necessita_experiente && !colaboradoras.some((c) => ehExperiente(c.treinamentos))) {
    status = "vermelho";
    motivos.push(`${medico.nome} exige colaboradora com treinamento "Experiente".`);
  }

  const espMedico = especialidadesMedico(medico);
  if (espMedico.length) {
    const semEspecialidade = colaboradoras.filter(
      (c) => !listaTexto(c.especialidades).some((e) => espMedico.includes(e)),
    );
    if (semEspecialidade.length === colaboradoras.length) {
      if (status !== "vermelho") status = "amarelo";
      motivos.push(
        `Nenhuma colaboradora escalada tem especialidade em comum com ${medico.nome} (${espMedico.join(", ")}).`,
      );
    } else if (semEspecialidade.length) {
      if (status !== "vermelho") status = "amarelo";
      motivos.push(
        `Sem especialidade em comum com o médico: ${semEspecialidade.map((c) => c.nome).join(", ")}.`,
      );
    }
  }

  return { status, motivos };
}

interface EscalaExistente {
  id: number;
  sala_id: number | null;
  medico_id: number | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  escala_colaboradoras: { colaboradora_id: number }[] | null;
}

/** Conflitos do mesmo dia: médico em outra sala e colaboradora em duas escalas. */
export function detectarConflitos(params: {
  escalaId: number | null;
  medicoId: number | null;
  salaId: number | null;
  horarioInicio: string | null;
  horarioFim: string | null;
  colaboradoraIds: number[];
  existentes: EscalaExistente[];
  nomeMedico: (id: number) => string;
  nomeColaboradora: (id: number) => string;
  nomeSala: (id: number | null) => string;
}): string[] {
  const conflitos: string[] = [];
  for (const outra of params.existentes) {
    if (params.escalaId && outra.id === params.escalaId) continue;
    if (
      !horariosSobrepoem(
        params.horarioInicio,
        params.horarioFim,
        outra.horario_inicio,
        outra.horario_fim,
      )
    ) {
      continue;
    }
    if (params.medicoId && outra.medico_id === params.medicoId && outra.sala_id !== params.salaId) {
      conflitos.push(
        `${params.nomeMedico(params.medicoId)} já está escalado em ${params.nomeSala(outra.sala_id)} no mesmo horário.`,
      );
    }
    const ocupadas = (outra.escala_colaboradoras ?? []).map((c) => c.colaboradora_id);
    for (const id of params.colaboradoraIds) {
      if (ocupadas.includes(id)) {
        conflitos.push(
          `${params.nomeColaboradora(id)} já está em ${params.nomeSala(outra.sala_id)} no mesmo horário.`,
        );
      }
    }
  }
  return Array.from(new Set(conflitos));
}

/**
 * Pontuação de sugestão (services/sugestao.py):
 * +10 vínculo cadastrado, até +5 frequência histórica (teto 10 escalas), +2 mesmo dia da semana.
 */
export function pontuarColaboradoras(params: {
  colaboradoras: ColaboradoraRegra[];
  medico: MedicoRegra | null;
  salaId: number | null;
  diaSemana: number;
  vinculosMedico: { colaboradora_id: number; medico_id: number }[];
  vinculosSala: { colaboradora_id: number; sala_id: number }[];
  historico: {
    colaboradora_id: number;
    medico_id: number | null;
    sala_id: number | null;
    dia_semana: number;
  }[];
  indisponiveis: Set<number>;
}) {
  const { medico, salaId, diaSemana } = params;
  return params.colaboradoras
    .filter((c) => !c.desativada)
    .map((c) => {
      const motivos: string[] = [];
      let pontos = 0;

      const vinculadaAoMedico =
        !!medico &&
        (c.atende_todos_medicos ||
          c.medico_padrao_id === medico.id ||
          medico.colaboradora_padrao_id === c.id ||
          params.vinculosMedico.some(
            (v) => v.colaboradora_id === c.id && v.medico_id === medico.id,
          ));
      const vinculadaASala =
        !!salaId &&
        params.vinculosSala.some((v) => v.colaboradora_id === c.id && v.sala_id === salaId);

      if (vinculadaAoMedico) {
        pontos += 10;
        motivos.push(
          c.atende_todos_medicos ? "Atende todos os médicos" : "Médico padrão cadastrado",
        );
      }
      if (vinculadaASala) {
        pontos += 10;
        motivos.push("Cadastrada nesta sala");
      }

      const juntos = params.historico.filter(
        (h) =>
          h.colaboradora_id === c.id &&
          ((medico && h.medico_id === medico.id) || (salaId && h.sala_id === salaId)),
      ).length;
      if (juntos > 0) {
        const bonus = Math.min(juntos, 10) / 2;
        pontos += bonus;
        motivos.push(`${juntos} escala(s) anteriores nesta combinação`);
      }

      const mesmoDia = params.historico.some(
        (h) => h.colaboradora_id === c.id && h.dia_semana === diaSemana,
      );
      if (mesmoDia) {
        pontos += 2;
        motivos.push("Já trabalhou neste dia da semana");
      }

      const compat = medico ? avaliarCompatibilidade(medico, [c]) : null;
      const indisponivel = params.indisponiveis.has(c.id);
      if (indisponivel) motivos.push("Ausência registrada nesta data");

      return {
        id: c.id,
        nome: c.nome,
        apelido: c.apelido ?? null,
        cargo: c.cargo,
        pontos: Math.round(pontos * 10) / 10,
        motivos,
        indisponivel,
        statusCompatibilidade: compat?.status ?? ("amarelo" as StatusCompatibilidade),
        alertasCompatibilidade: compat?.motivos ?? [],
      };
    })
    .sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome));
}

export const DIAS_SEMANA = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
] as const;

/** Dia da semana (0=domingo) de uma data ISO, sem efeito de fuso. */
export function diaSemanaIso(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

export function periodoPorHorario(inicio: string | null): string {
  const min = minutosDoHorario(inicio);
  if (min === null) return "integral";
  return min < 12 * 60 ? "manha" : min < 18 * 60 ? "tarde" : "noite";
}
