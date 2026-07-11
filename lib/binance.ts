import type { Candle } from "./types";

// API publica de Binance para velas (klines). No requiere API key.
// Docs: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
const BASE_URL = "https://api.binance.com/api/v3/klines";

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

export async function fetchCandles(
  symbol: string,
  interval: Interval,
  limit = 200
): Promise<Candle[]> {
  const url = `${BASE_URL}?symbol=${encodeURIComponent(
    symbol.toUpperCase()
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

  return raw.map((k) => ({
    time: Math.floor(k[0] / 1000), // ms -> segundos UTC
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}
