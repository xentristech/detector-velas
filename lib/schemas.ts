import { z } from "zod";
import { INTERVALS } from "./binance";

// ---------------------------------------------------------------------------
// Esquemas de validacion de entrada (Zod) para las rutas de API.
// ---------------------------------------------------------------------------

// Un par de Binance: mayusculas y digitos, entre 5 y 20 caracteres (ej. BTCUSDT).
export const symbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{5,20}$/, "Símbolo no válido (ej. BTCUSDT).");

export const intervalSchema = z.enum(
  INTERVALS as unknown as [string, ...string[]],
  { message: `Intervalo no válido. Usa: ${INTERVALS.join(", ")}.` }
);

// Query para /api/candles
export const candlesQuerySchema = z.object({
  symbol: symbolSchema,
  interval: intervalSchema,
  limit: z.coerce
    .number()
    .int()
    .min(20, { message: "El límite mínimo es 20 velas." })
    .max(500, { message: "El límite máximo es 500 velas." })
    .default(200),
});

// Body para /api/analyze
const biasSchema = z.enum(["alcista", "bajista", "neutral"]);

const patternSchema = z.object({
  name: z.string(),
  key: z.string(),
  bias: biasSchema,
  strength: z.number(),
  index: z.number(),
  time: z.number(),
  size: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  description: z.string(),
});

export const analyzeBodySchema = z.object({
  symbol: symbolSchema,
  interval: intervalSchema,
  verdict: z.object({
    bias: biasSchema,
    score: z.number(),
    lastPattern: patternSchema.nullable(),
  }),
  // Se limita a 12 para acotar el tamano del prompt (control de costo).
  recentPatterns: z.array(patternSchema).max(12),
  lastPrice: z.number().nonnegative(),
});

// Body para /api/lesson (repaso de un patron en el juego)
export const lessonBodySchema = z.object({
  key: z.string().min(1).max(40),
  name: z.string().min(1).max(60),
  bias: biasSchema,
});

// Devuelve el primer mensaje de error legible de un resultado de Zod.
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos de entrada no válidos.";
}
