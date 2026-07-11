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
