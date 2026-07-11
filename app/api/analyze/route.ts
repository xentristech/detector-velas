import { NextRequest, NextResponse } from "next/server";
import { streamText, toTextStream, createTextStreamResponse } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { analyzeBodySchema, firstError } from "@/lib/schemas";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Limite estricto: cada llamada consume cuota de OpenAI (cuesta dinero).
const LIMIT = 10;
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  // 1) Rate limit por IP (protege la cuota de OpenAI).
  const rl = rateLimit(clientKey(req, "analyze"), LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `Demasiados análisis seguidos. Espera ${rl.retryAfterSec}s antes de pedir otro veredicto.`,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // 2) Clave configurada.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Falta OPENAI_API_KEY. Copia .env.example a .env.local y agrega tu clave.",
      },
      { status: 500 }
    );
  }

  // 3) Validar el cuerpo.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON no válido." }, { status: 400 });
  }
  const parsed = analyzeBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstError(parsed.error) },
      { status: 400 }
    );
  }
  const { symbol, interval, verdict, recentPatterns, lastPrice } = parsed.data;

  const modelId = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const openai = createOpenAI({ apiKey });

  const patternsText =
    recentPatterns.length > 0
      ? recentPatterns
          .map(
            (p) =>
              `- ${p.name} (${p.bias}, fuerza ${p.strength}/100): ${p.description}`
          )
          .join("\n")
      : "No se detectaron patrones claros recientes.";

  const prompt = `Eres un analista tecnico. Con base en la deteccion automatica de velas japonesas, redacta un veredicto breve en espanol latinoamericano.

Simbolo: ${symbol}
Intervalo: ${interval}
Precio actual: ${lastPrice}
Sesgo calculado: ${verdict.bias} (score ${verdict.score} de -100 a +100)
Ultimo patron: ${verdict.lastPattern ? verdict.lastPattern.name : "ninguno"}

Patrones recientes detectados:
${patternsText}

Responde en 3 partes cortas y claras:
1. VEREDICTO: una frase indicando si es ALCISTA, BAJISTA o NEUTRAL y por que.
2. RAZON: 2-3 renglones explicando los patrones y el contexto.
3. AVISO: recuerda que no es asesoria financiera y que conviene confirmar con volumen/soportes.

Se conciso, directo y evita tecnicismos innecesarios.`;

  try {
    const result = streamText({
      model: openai(modelId),
      system:
        "Eres un analista tecnico experto en patrones de velas japonesas. Escribes claro, honesto y siempre aclaras que no es asesoria financiera.",
      prompt,
      temperature: 0.5,
      // Control de costo: acota la salida (el veredicto es corto).
      maxOutputTokens: 400,
      onError: ({ error }) => {
        console.error("[analyze] error de streaming:", error);
      },
    });

    return createTextStreamResponse({
      stream: toTextStream({ stream: result.stream }),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error llamando a OpenAI";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
