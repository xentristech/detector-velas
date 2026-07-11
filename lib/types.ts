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

// --- Juego de patrones ---

// Una opcion de respuesta en el juego.
export interface GameOption {
  key: string;
  name: string;
}

// Una ronda del juego "¿Que patron ves?".
export interface GameRound {
  symbol: string;
  interval: string;
  candles: Candle[]; // ventana de velas a mostrar
  markerTime: number; // vela donde termina el patron (para marcarla)
  correctKey: string;
  correctName: string;
  bias: Bias;
  description: string; // explicacion que se revela al responder
  options: GameOption[]; // 4 opciones barajadas (incluye la correcta)
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
