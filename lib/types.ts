// Tipos compartidos entre backend, deteccion de patrones y frontend.

// Una vela (candle) en formato OHLC. `time` en segundos UTC (formato de lightweight-charts).
export interface Candle {
  time: number; // segundos UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Direccion del patron detectado.
export type Bias = "alcista" | "bajista" | "neutral";

// Un patron de velas detectado.
export interface Pattern {
  name: string; // nombre legible en espanol, ej. "Envolvente alcista"
  key: string; // identificador estable, ej. "bullish_engulfing"
  bias: Bias;
  // Fuerza/confianza de 0 a 100 segun que tan bien se cumplen las condiciones.
  strength: number;
  // Indice de la vela (dentro del arreglo de candles) donde termina el patron.
  index: number;
  time: number; // segundos UTC de la vela final del patron
  // Cuantas velas abarca el patron (1, 2 o 3).
  size: 1 | 2 | 3;
  description: string; // que significa el patron
}

// Respuesta del endpoint /api/candles
export interface CandlesResponse {
  symbol: string;
  interval: string;
  candles: Candle[];
  patterns: Pattern[];
  // Veredicto global calculado a partir de los ultimos patrones.
  verdict: {
    bias: Bias;
    score: number; // -100 (muy bajista) .. +100 (muy alcista)
    lastPattern: Pattern | null;
  };
}
