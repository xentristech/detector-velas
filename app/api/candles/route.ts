import { NextRequest, NextResponse } from "next/server";
import { fetchCandles, type Interval } from "@/lib/binance";
import { detectPatterns, computeVerdict } from "@/lib/patterns";
import { candlesQuerySchema, firstError } from "@/lib/schemas";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import type { CandlesResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Limite generoso: es una lectura barata (con cache de Binance).
const LIMIT = 60;
const WINDOW_MS = 60_000;

export async function GET(req: NextRequest) {
  // 1) Rate limit por IP.
  const rl = rateLimit(clientKey(req, "candles"), LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `Demasiadas peticiones. Espera ${rl.retryAfterSec}s e inténtalo de nuevo.`,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // 2) Validar entrada.
  const { searchParams } = new URL(req.url);
  const parsed = candlesQuerySchema.safeParse({
    symbol: searchParams.get("symbol") ?? "BTCUSDT",
    interval: searchParams.get("interval") ?? "1h",
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstError(parsed.error) },
      { status: 400 }
    );
  }
  const { symbol, interval, limit } = parsed.data;

  // 3) Buscar velas y analizarlas.
  try {
    const candles = await fetchCandles(symbol, interval as Interval, limit);
    if (candles.length === 0) {
      return NextResponse.json(
        {
          error: `No hay velas para “${symbol}”. Revisa que el símbolo esté bien escrito (ej. BTCUSDT).`,
        },
        { status: 404 }
      );
    }

    const patterns = detectPatterns(candles);
    const verdict = computeVerdict(patterns);

    const payload: CandlesResponse = {
      symbol,
      interval,
      candles,
      patterns,
      verdict,
    };
    return NextResponse.json(payload);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    const invalidSymbol = /invalid symbol|\b400\b/i.test(raw);
    const message = invalidSymbol
      ? `No encontramos “${symbol}” en Binance. Revisa que sea un par válido (ej. BTCUSDT, ETHUSDT).`
      : "No pudimos conectar con Binance. Vuelve a intentarlo en unos segundos.";
    return NextResponse.json(
      { error: message },
      { status: invalidSymbol ? 404 : 502 }
    );
  }
}
