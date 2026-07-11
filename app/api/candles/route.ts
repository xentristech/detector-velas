import { NextRequest, NextResponse } from "next/server";
import { fetchCandles, INTERVALS, type Interval } from "@/lib/binance";
import { detectPatterns, computeVerdict } from "@/lib/patterns";
import type { CandlesResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
  const interval = (searchParams.get("interval") || "1h") as Interval;
  const limit = Math.min(
    500,
    Math.max(20, parseInt(searchParams.get("limit") || "200", 10))
  );

  if (!INTERVALS.includes(interval)) {
    return NextResponse.json(
      { error: `Intervalo no válido. Usa uno de: ${INTERVALS.join(", ")}.` },
      { status: 400 }
    );
  }

  try {
    const candles = await fetchCandles(symbol, interval, limit);
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
    // Binance devuelve 400 / "Invalid symbol" cuando el par no existe.
    const invalidSymbol = /invalid symbol|\b400\b/i.test(raw);
    const message = invalidSymbol
      ? `No encontramos “${symbol}” en Binance. Revisa que sea un par válido (ej. BTCUSDT, ETHUSDT).`
      : "No pudimos conectar con Binance. Vuelve a intentarlo en unos segundos.";
    return NextResponse.json({ error: message }, { status: invalidSymbol ? 404 : 502 });
  }
}
