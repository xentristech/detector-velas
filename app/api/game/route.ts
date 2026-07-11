import { NextRequest, NextResponse } from "next/server";
import { fetchCandles, type Interval } from "@/lib/binance";
import { detectPatterns, PATTERN_CATALOG } from "@/lib/patterns";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import type { GameRound, GameOption, Pattern } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = 60;
const WINDOW_MS = 60_000;

const SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "LTCUSDT",
];
const INTERVALS: Interval[] = ["1h", "4h", "1d"];

// Cuantas velas de contexto antes del patron se muestran.
const BEFORE = 18;
const AFTER = 2;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "game"), LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Demasiadas rondas seguidas. Espera ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // Intenta varias combinaciones hasta encontrar un patron con contexto.
  try {
    let chosen: { candles: Awaited<ReturnType<typeof fetchCandles>>; pattern: Pattern; symbol: string; interval: Interval } | null =
      null;

    for (let attempt = 0; attempt < 6 && !chosen; attempt++) {
      const symbol = pick(SYMBOLS);
      const interval = pick(INTERVALS);
      const candles = await fetchCandles(symbol, interval, 150);
      const patterns = detectPatterns(candles);
      // Patrones con suficiente contexto antes y algo despues.
      const eligible = patterns.filter(
        (p) => p.index >= BEFORE && p.index <= candles.length - 1 - AFTER
      );
      if (eligible.length > 0) {
        chosen = { candles, pattern: pick(eligible), symbol, interval };
      }
    }

    if (!chosen) {
      return NextResponse.json(
        { error: "No se pudo armar una ronda. Intenta de nuevo." },
        { status: 503 }
      );
    }

    const { candles, pattern, symbol, interval } = chosen;
    const start = Math.max(0, pattern.index - BEFORE);
    const end = Math.min(candles.length, pattern.index + AFTER + 1);
    const window = candles.slice(start, end);

    // Opciones: la correcta + 3 distractores del catalogo, barajadas.
    const correct = PATTERN_CATALOG.find((c) => c.key === pattern.key)!;
    const distractors = shuffle(
      PATTERN_CATALOG.filter((c) => c.key !== pattern.key)
    ).slice(0, 3);
    const options: GameOption[] = shuffle(
      [correct, ...distractors].map((c) => ({ key: c.key, name: c.name }))
    );

    const round: GameRound = {
      symbol,
      interval,
      candles: window,
      markerTime: candles[pattern.index].time,
      correctKey: pattern.key,
      correctName: correct.name,
      bias: pattern.bias,
      description: pattern.description,
      options,
    };
    return NextResponse.json(round);
  } catch {
    return NextResponse.json(
      { error: "No pudimos conectar con Binance. Intenta de nuevo." },
      { status: 502 }
    );
  }
}
