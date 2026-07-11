import { NextRequest, NextResponse } from "next/server";
import { streamText, toTextStream, createTextStreamResponse } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { lessonBodySchema, firstError } from "@/lib/schemas";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Comparte cuota con /api/analyze: mismo costo por llamada a OpenAI.
const LIMIT = 15;
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "lesson"), LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `Demasiadas lecciones seguidas. Espera ${rl.retryAfterSec}s.`,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Falta OPENAI_API_KEY. El repaso con IA necesita la clave configurada.",
      },
      { status: 500 }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON no válido." }, { status: 400 });
  }
  const parsed = lessonBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstError(parsed.error) },
      { status: 400 }
    );
  }
  const { name, bias } = parsed.data;

  const modelId = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const openai = createOpenAI({ apiKey });

  const prompt = `Un estudiante acaba de fallar al identificar el patron de vela japonesa "${name}" (sesgo ${bias}) en un juego. Enseñaselo de forma didactica y motivadora en espanol latinoamericano.

Usa Markdown con **negritas** y responde en 4 puntos cortos:
1. **Que es y como se ve**: la forma de la vela o velas.
2. **Como reconocerlo rapido**: la senal visual clave.
3. **Que significa**: que indica en el mercado y por que (${bias}).
4. **Tip para no confundirlo**: con que patron parecido suele confundirse.

Maximo 160 palabras. Tono cercano, como un buen profesor.`;

  try {
    const result = streamText({
      model: openai(modelId),
      system:
        "Eres un profesor experto y cercano de analisis tecnico. Explicas patrones de velas japonesas de forma clara y didactica, con ejemplos visuales en palabras.",
      prompt,
      temperature: 0.6,
      maxOutputTokens: 400,
      onError: ({ error }) => {
        console.error("[lesson] error de streaming:", error);
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
