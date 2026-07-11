import type { Candle } from "./types";

// Endpoint publico de datos de mercado de Binance para velas (klines).
// Se usa data-api.binance.vision en vez de api.binance.com porque este ultimo
// bloquea las IPs de EE. UU. (donde corren los servidores de Vercel). El de
// binance.vision expone los mismos datos publicos sin geo-bloqueo. Sin API key.
const BASE_URL = "https://data-api.binance.vision/api/v3/klines";

// Intervalos permitidos por Binance.
export const INTERVALS = [
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
  "1w",
] as const;

export type Interval = (typeof INTERVALS)[number];

// Cada kline de Binance es un arreglo:
// [ openTime, open, high, low, close, volume, closeTime, ... ]
type RawKline = [
  number, // 0 open time (ms)
  string, // 1 open
  string, // 2 high
  string, // 3 low
  string, // 4 close
  string, // 5 volume
  number, // 6 close time
  ...unknown[]
];

// Cache TTL en memoria: evita re-descargar velas identicas en rafagas
// (p. ej. Analizar seguido de Veredicto IA). Por instancia; TTL corto.
const CACHE_TTL_MS = 20_000;
interface CacheEntry {
  at: number;
  data: Candle[];
}
const candleCache = new Map<string, CacheEntry>();

export async function fetchCandles(
  symbol: string,
  interval: Interval,
  limit = 200
): Promise<Candle[]> {
  const sym = symbol.toUpperCase();
  const cacheKey = `${sym}|${interval}|${limit}`;

  const cached = candleCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${BASE_URL}?symbol=${encodeURIComponent(
    sym
  )}&interval=${interval}&limit=${limit}`;

  const res = await fetch(url, {
    // Refrescar cada 30s en el edge/servidor.
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Binance respondio ${res.status}: ${body.slice(0, 200)}`
    );
  }

  const raw = (await res.json()) as RawKline[];

  const candles = raw.map((k) => ({
    time: Math.floor(k[0] / 1000), // ms -> segundos UTC
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));

  candleCache.set(cacheKey, { at: Date.now(), data: candles });
  return candles;
}
