import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  carregarApoioEscala,
  carregarSemanaEscala,
  gerarSemanaPelaBase,
  removerEscala,
  salvarEscalaCompleta,
  sugerirParaEscala,
} from "@/lib/escala.service.server";

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const horario = z
  .string()
  .trim()
  .regex(/^\d{1,2}:\d{2}$/, "Horário inválido (HH:MM)")
  .nullable()
  .optional();

export const obterApoioEscala = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => carregarApoioEscala(context.supabase));

export const obterSemana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ inicio: dataIso, fim: dataIso }).parse(input))
  .handler(async ({ data, context }) =>
    carregarSemanaEscala(context.supabase, data.inicio, data.fim),
  );

export const sugerirColaboradoras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        data: dataIso,
        medicoId: z.number().int().positive().nullable(),
        salaId: z.number().int().positive().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    sugerirParaEscala(context.supabase, data.data, data.medicoId, data.salaId),
  );

export const salvarEscala = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.number().int().positive().nullable().optional(),
        data: dataIso,
        salaId: z.number().int().positive().nullable(),
        medicoId: z.number().int().positive().nullable(),
        horarioInicio: horario,
        horarioFim: horario,
        observacoes: z.string().trim().max(500).nullable().optional(),
        colaboradoraIds: z.array(z.number().int().positive()).max(20),
        confirmarAlertas: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => salvarEscalaCompleta(context, data));

export const excluirEscala = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => removerEscala(context, data.id));

export const gerarPelaEscalaBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ inicio: dataIso }).parse(input))
  .handler(async ({ data, context }) => gerarSemanaPelaBase(context, data.inicio));
