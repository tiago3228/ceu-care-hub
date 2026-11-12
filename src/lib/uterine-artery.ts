import { percentilNormal } from "@/lib/fetal-biometry";

export const UTPI_GOMEZ_MIN_DAYS = 77;
export const UTPI_GOMEZ_MAX_DAYS = 293;
export const UTPI_GOMEZ_Z95 = 1.6449;

export type ReferenciaUtpiGomez = {
  mediana: number;
  p5: number;
  p95: number;
};

export type ResultadoUtpiGomez = ReferenciaUtpiGomez & {
  zScore: number;
  percentil: number;
  acimaDoP95: boolean;
};

/** Curva de Gómez et al. (2008), com a idade gestacional informada em dias. */
export function referenciaUtpiGomez(diasGestacionais: number): ReferenciaUtpiGomez | null {
  if (
    !Number.isFinite(diasGestacionais) ||
    diasGestacionais < UTPI_GOMEZ_MIN_DAYS ||
    diasGestacionais > UTPI_GOMEZ_MAX_DAYS
  )
    return null;

  const mediaLog = 1.39 - 0.012 * diasGestacionais + 0.0000198 * diasGestacionais ** 2;
  const desvioLog = 0.272 - 0.000259 * diasGestacionais;
  if (desvioLog <= 0) return null;

  return {
    mediana: Math.exp(mediaLog),
    p5: Math.exp(mediaLog - UTPI_GOMEZ_Z95 * desvioLog),
    p95: Math.exp(mediaLog + UTPI_GOMEZ_Z95 * desvioLog),
  };
}

/** Classifica um IP médio positivo frente à curva Gómez; null indica idade inválida. */
export function calcularUtpiGomez(
  ipMedio: number,
  diasGestacionais: number,
): ResultadoUtpiGomez | null {
  if (!Number.isFinite(ipMedio) || ipMedio <= 0) return null;
  const referencia = referenciaUtpiGomez(diasGestacionais);
  if (!referencia) return null;

  const mediaLog = 1.39 - 0.012 * diasGestacionais + 0.0000198 * diasGestacionais ** 2;
  const desvioLog = 0.272 - 0.000259 * diasGestacionais;
  const zScore = (Math.log(ipMedio) - mediaLog) / desvioLog;

  return {
    ...referencia,
    zScore,
    percentil: percentilNormal(zScore),
    acimaDoP95: zScore > UTPI_GOMEZ_Z95,
  };
}
