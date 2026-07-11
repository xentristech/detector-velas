import type { Candle, Pattern, Bias } from "./types";

// ---------------------------------------------------------------------------
// Motor de deteccion de patrones de velas japonesas (por reglas, sin IA).
// Preciso, deterministico y gratis. La IA solo redacta el veredicto despues.
// ---------------------------------------------------------------------------

// Metricas basicas de una vela.
function body(c: Candle) {
  return Math.abs(c.close - c.open);
}
function range(c: Candle) {
  return c.high - c.low;
}
function upperShadow(c: Candle) {
  return c.high - Math.max(c.open, c.close);
}
function lowerShadow(c: Candle) {
  return Math.min(c.open, c.close) - c.low;
}
function isBull(c: Candle) {
  return c.close > c.open;
}
function isBear(c: Candle) {
  return c.close < c.open;
}

// Tendencia previa a `index` mirando `lookback` velas hacia atras.
// Sirve para distinguir p. ej. martillo (fondo) de hombre colgado (techo).
function trendBefore(
  candles: Candle[],
  index: number,
  lookback = 5
): "up" | "down" | "flat" {
  const start = index - lookback;
  if (start < 0) return "flat";
  const first = candles[start].close;
  const last = candles[index - 1].close;
  const change = (last - first) / first;
  if (change > 0.01) return "up";
  if (change < -0.01) return "down";
  return "flat";
}

// Clampa la fuerza al rango 0..100.
function clampStrength(s: number) {
  return Math.max(0, Math.min(100, Math.round(s)));
}

// Detecta el patron mas significativo que TERMINA en `index`.
// Prioriza patrones de 3 velas, luego 2, luego 1.
function detectAt(candles: Candle[], index: number): Pattern | null {
  const c = candles[index];
  const p1 = index >= 1 ? candles[index - 1] : null;
  const p2 = index >= 2 ? candles[index - 2] : null;
  const trend = trendBefore(candles, index);

  const make = (
    data: Omit<Pattern, "index" | "time">
  ): Pattern => ({
    ...data,
    strength: clampStrength(data.strength),
    index,
    time: c.time,
  });

  // ------------------------------------------------------------------
  // PATRONES DE 3 VELAS
  // ------------------------------------------------------------------
  if (p1 && p2) {
    // Estrella de la manana (alcista): bajista fuerte, vela pequena, alcista fuerte.
    if (
      isBear(p2) &&
      body(p2) > range(p2) * 0.5 &&
      body(p1) < body(p2) * 0.5 &&
      isBull(c) &&
      c.close > (p2.open + p2.close) / 2
    ) {
      return make({
        name: "Estrella de la manana",
        key: "morning_star",
        bias: "alcista",
        size: 3,
        strength: 80,
        description:
          "Reversion alcista de 3 velas tras una caida: vela bajista, indecision y vela alcista que recupera terreno.",
      });
    }

    // Estrella del atardecer (bajista): alcista fuerte, vela pequena, bajista fuerte.
    if (
      isBull(p2) &&
      body(p2) > range(p2) * 0.5 &&
      body(p1) < body(p2) * 0.5 &&
      isBear(c) &&
      c.close < (p2.open + p2.close) / 2
    ) {
      return make({
        name: "Estrella del atardecer",
        key: "evening_star",
        bias: "bajista",
        size: 3,
        strength: 80,
        description:
          "Reversion bajista de 3 velas tras una subida: vela alcista, indecision y vela bajista que borra el avance.",
      });
    }

    // Tres soldados blancos (alcista): 3 alcistas consecutivas al alza.
    if (
      isBull(p2) &&
      isBull(p1) &&
      isBull(c) &&
      p1.close > p2.close &&
      c.close > p1.close &&
      body(p1) > range(p1) * 0.6 &&
      body(c) > range(c) * 0.6
    ) {
      return make({
        name: "Tres soldados blancos",
        key: "three_white_soldiers",
        bias: "alcista",
        size: 3,
        strength: 85,
        description:
          "Tres velas alcistas seguidas con cierres cada vez mas altos: fuerte impulso comprador.",
      });
    }

    // Tres cuervos negros (bajista): 3 bajistas consecutivas a la baja.
    if (
      isBear(p2) &&
      isBear(p1) &&
      isBear(c) &&
      p1.close < p2.close &&
      c.close < p1.close &&
      body(p1) > range(p1) * 0.6 &&
      body(c) > range(c) * 0.6
    ) {
      return make({
        name: "Tres cuervos negros",
        key: "three_black_crows",
        bias: "bajista",
        size: 3,
        strength: 85,
        description:
          "Tres velas bajistas seguidas con cierres cada vez mas bajos: fuerte presion vendedora.",
      });
    }
  }

  // ------------------------------------------------------------------
  // PATRONES DE 2 VELAS
  // ------------------------------------------------------------------
  if (p1) {
    // Envolvente alcista: bajista seguida de alcista que envuelve su cuerpo.
    if (
      isBear(p1) &&
      isBull(c) &&
      c.close >= p1.open &&
      c.open <= p1.close
    ) {
      const engulf = body(c) / (body(p1) || 1);
      return make({
        name: "Envolvente alcista",
        key: "bullish_engulfing",
        bias: "alcista",
        size: 2,
        strength: 65 + Math.min(25, engulf * 10),
        description:
          "Una vela alcista envuelve por completo el cuerpo de la bajista anterior: los compradores toman el control.",
      });
    }

    // Envolvente bajista: alcista seguida de bajista que la envuelve.
    if (
      isBull(p1) &&
      isBear(c) &&
      c.open >= p1.close &&
      c.close <= p1.open
    ) {
      const engulf = body(c) / (body(p1) || 1);
      return make({
        name: "Envolvente bajista",
        key: "bearish_engulfing",
        bias: "bajista",
        size: 2,
        strength: 65 + Math.min(25, engulf * 10),
        description:
          "Una vela bajista envuelve por completo el cuerpo de la alcista anterior: los vendedores toman el control.",
      });
    }

    // Linea penetrante (alcista): bajista, luego alcista que cierra sobre el 50% de la anterior.
    if (
      isBear(p1) &&
      isBull(c) &&
      c.open < p1.low &&
      c.close > (p1.open + p1.close) / 2 &&
      c.close < p1.open
    ) {
      return make({
        name: "Linea penetrante",
        key: "piercing_line",
        bias: "alcista",
        size: 2,
        strength: 60,
        description:
          "Tras una vela bajista, una alcista abre con hueco a la baja pero cierra por encima de la mitad: rebote comprador.",
      });
    }

    // Nube oscura (bajista): alcista, luego bajista que cierra bajo el 50% de la anterior.
    if (
      isBull(p1) &&
      isBear(c) &&
      c.open > p1.high &&
      c.close < (p1.open + p1.close) / 2 &&
      c.close > p1.open
    ) {
      return make({
        name: "Nube oscura",
        key: "dark_cloud_cover",
        bias: "bajista",
        size: 2,
        strength: 60,
        description:
          "Tras una vela alcista, una bajista abre con hueco al alza pero cierra por debajo de la mitad: giro vendedor.",
      });
    }

    // Harami alcista: bajista grande y luego alcista pequena dentro de su cuerpo.
    if (
      isBear(p1) &&
      isBull(c) &&
      body(p1) > body(c) * 1.5 &&
      c.open > p1.close &&
      c.close < p1.open
    ) {
      return make({
        name: "Harami alcista",
        key: "bullish_harami",
        bias: "alcista",
        size: 2,
        strength: 55,
        description:
          "Una vela pequena alcista queda dentro del cuerpo de una bajista grande: posible agotamiento de la caida.",
      });
    }

    // Harami bajista: alcista grande y luego bajista pequena dentro de su cuerpo.
    if (
      isBull(p1) &&
      isBear(c) &&
      body(p1) > body(c) * 1.5 &&
      c.open < p1.close &&
      c.close > p1.open
    ) {
      return make({
        name: "Harami bajista",
        key: "bearish_harami",
        bias: "bajista",
        size: 2,
        strength: 55,
        description:
          "Una vela pequena bajista queda dentro del cuerpo de una alcista grande: posible agotamiento de la subida.",
      });
    }
  }

  // ------------------------------------------------------------------
  // PATRONES DE 1 VELA
  // ------------------------------------------------------------------
  const b = body(c);
  const r = range(c) || 1;
  const up = upperShadow(c);
  const lo = lowerShadow(c);

  // Marubozu alcista: cuerpo grande, casi sin mechas, alcista.
  if (isBull(c) && b > r * 0.9) {
    return make({
      name: "Marubozu alcista",
      key: "bullish_marubozu",
      bias: "alcista",
      size: 1,
      strength: 70,
      description:
        "Vela alcista casi sin mechas: los compradores dominaron toda la sesion.",
    });
  }
  // Marubozu bajista.
  if (isBear(c) && b > r * 0.9) {
    return make({
      name: "Marubozu bajista",
      key: "bearish_marubozu",
      bias: "bajista",
      size: 1,
      strength: 70,
      description:
        "Vela bajista casi sin mechas: los vendedores dominaron toda la sesion.",
    });
  }

  // Martillo / Hombre colgado: cuerpo pequeno arriba, mecha inferior larga.
  if (lo > b * 2 && up < b) {
    if (trend === "down") {
      return make({
        name: "Martillo",
        key: "hammer",
        bias: "alcista",
        size: 1,
        strength: 60,
        description:
          "Cuerpo pequeno con mecha inferior larga tras una caida: rechazo de precios bajos, posible piso.",
      });
    }
    if (trend === "up") {
      return make({
        name: "Hombre colgado",
        key: "hanging_man",
        bias: "bajista",
        size: 1,
        strength: 55,
        description:
          "Misma forma que el martillo pero al final de una subida: aviso de posible techo.",
      });
    }
  }

  // Estrella fugaz / Martillo invertido: cuerpo pequeno abajo, mecha superior larga.
  if (up > b * 2 && lo < b) {
    if (trend === "up") {
      return make({
        name: "Estrella fugaz",
        key: "shooting_star",
        bias: "bajista",
        size: 1,
        strength: 60,
        description:
          "Cuerpo pequeno con mecha superior larga tras una subida: rechazo de precios altos, posible techo.",
      });
    }
    if (trend === "down") {
      return make({
        name: "Martillo invertido",
        key: "inverted_hammer",
        bias: "alcista",
        size: 1,
        strength: 55,
        description:
          "Cuerpo pequeno con mecha superior larga tras una caida: intento comprador, posible giro al alza.",
      });
    }
  }

  // Doji: cuerpo casi inexistente. Indecision (neutral).
  if (b <= r * 0.1) {
    return make({
      name: "Doji",
      key: "doji",
      bias: "neutral",
      size: 1,
      strength: 40,
      description:
        "Apertura y cierre casi iguales: indecision del mercado, posible punto de giro.",
    });
  }

  return null;
}

// Recorre todas las velas y devuelve los patrones detectados.
export function detectPatterns(candles: Candle[]): Pattern[] {
  const patterns: Pattern[] = [];
  for (let i = 0; i < candles.length; i++) {
    const p = detectAt(candles, i);
    if (p) patterns.push(p);
  }
  return patterns;
}

// Calcula un veredicto global ponderando los ultimos patrones.
// score: -100 (muy bajista) .. +100 (muy alcista).
export function computeVerdict(patterns: Pattern[]): {
  bias: Bias;
  score: number;
  lastPattern: Pattern | null;
} {
  if (patterns.length === 0) {
    return { bias: "neutral", score: 0, lastPattern: null };
  }

  // Tomar los ultimos 5 patrones y ponderar por recencia y fuerza.
  const recent = patterns.slice(-5);
  let score = 0;
  let weightSum = 0;
  recent.forEach((p, idx) => {
    const recency = idx + 1; // mas peso a los mas recientes
    const dir = p.bias === "alcista" ? 1 : p.bias === "bajista" ? -1 : 0;
    score += dir * p.strength * recency;
    weightSum += p.strength * recency;
  });

  const normalized = weightSum > 0 ? Math.round((score / weightSum) * 100) : 0;
  const bias: Bias =
    normalized > 15 ? "alcista" : normalized < -15 ? "bajista" : "neutral";

  return {
    bias,
    score: normalized,
    lastPattern: patterns[patterns.length - 1],
  };
}
