import type { Candle } from "./types";

// ---------------------------------------------------------------------------
// Indicadores técnicos derivados de las velas (cálculo determinístico, sin IA).
// ---------------------------------------------------------------------------

// Un punto de una serie de indicador para lightweight-charts.
export interface IndicatorPoint {
  time: number; // segundos UTC (debe coincidir con el time de la vela)
  value: number;
}

// RSI (Relative Strength Index) con suavizado de Wilder.
// Devuelve un punto por cada vela a partir de la #`period` (las primeras no
// tienen RSI definido, así que se omiten y la línea empieza más tarde).
export function computeRSI(candles: Candle[], period = 14): IndicatorPoint[] {
  if (candles.length <= period) return [];

  const out: IndicatorPoint[] = [];

  // Primera media simple de ganancias/pérdidas sobre las primeras `period` variaciones.
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = candles[i].close - candles[i - 1].close;
    if (delta >= 0) avgGain += delta;
    else avgLoss -= delta;
  }
  avgGain /= period;
  avgLoss /= period;

  const rsiFrom = (gain: number, loss: number) => {
    if (loss === 0) return 100;
    const rs = gain / loss;
    return 100 - 100 / (1 + rs);
  };

  // Primer valor de RSI en el índice `period`.
  out.push({ time: candles[period].time, value: rsiFrom(avgGain, avgLoss) });

  // Suavizado de Wilder para el resto.
  for (let i = period + 1; i < candles.length; i++) {
    const delta = candles[i].close - candles[i - 1].close;
    const gain = delta >= 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out.push({ time: candles[i].time, value: rsiFrom(avgGain, avgLoss) });
  }

  return out;
}

// SMA (media móvil simple) sobre el cierre.
// Devuelve un punto por cada vela a partir de la #`period-1` (la línea empieza
// cuando ya hay `period` cierres para promediar).
export function computeSMA(candles: Candle[], period: number): IndicatorPoint[] {
  if (period < 1 || candles.length < period) return [];

  const out: IndicatorPoint[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) {
      out.push({ time: candles[i].time, value: sum / period });
    }
  }
  return out;
}

// EMA (media móvil exponencial) sobre el cierre.
// Se siembra con la SMA de las primeras `period` velas y luego suaviza.
export function computeEMA(candles: Candle[], period: number): IndicatorPoint[] {
  if (period < 1 || candles.length < period) return [];

  const k = 2 / (period + 1);
  const out: IndicatorPoint[] = [];

  let ema = 0;
  for (let i = 0; i < period; i++) ema += candles[i].close;
  ema /= period;
  out.push({ time: candles[period - 1].time, value: ema });

  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    out.push({ time: candles[i].time, value: ema });
  }
  return out;
}
