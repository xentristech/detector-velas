"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CandlesResponse, Pattern } from "@/lib/types";

// El chart es solo-cliente (usa canvas/DOM), se carga sin SSR.
const CandleChart = dynamic(() => import("@/components/CandleChart"), {
  ssr: false,
});

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];

function biasLabel(bias: string) {
  if (bias === "alcista") return "ALCISTA";
  if (bias === "bajista") return "BAJISTA";
  return "NEUTRAL";
}

// Iconos SVG (estilo Lucide) — reemplazan emojis para verse igual en todo sistema.
function CandleIcon() {
  return (
    <svg
      className="icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5v4" />
      <rect width="4" height="6" x="7" y="9" rx="1" />
      <path d="M9 15v2" />
      <path d="M17 3v2" />
      <rect width="4" height="8" x="15" y="5" rx="1" />
      <path d="M17 13v3" />
      <path d="M3 3v18h18" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg
      className="icon"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

export default function Home() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState("1h");
  const [data, setData] = useState<CandlesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch(
        `/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}`
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || "No pudimos cargar las velas.");
      setData(json as CandlesResponse);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos cargar las velas. Revisa tu conexión e inténtalo de nuevo."
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, interval]);

  // Cargar al inicio.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyze = useCallback(async () => {
    if (!data) return;
    setAnalyzing(true);
    setError(null);
    setAnalysis("");
    try {
      const lastPrice = data.candles[data.candles.length - 1]?.close ?? 0;
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: data.symbol,
          interval: data.interval,
          verdict: data.verdict,
          recentPatterns: data.patterns.slice(-6),
          lastPrice,
        }),
      });

      // Si algo falla, el backend responde JSON con { error }.
      if (!res.ok) {
        let msg = "Error en el analisis";
        try {
          const json = await res.json();
          msg = json.error || msg;
        } catch {
          /* respuesta no-JSON */
        }
        throw new Error(msg);
      }

      // Respuesta en streaming: leer el body y mostrar el texto conforme llega.
      const reader = res.body?.getReader();
      if (!reader) {
        setAnalysis(await res.text());
        return;
      }
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAnalysis(acc);
      }
      if (!acc.trim()) {
        setError(
          "La IA no devolvió texto. Puede ser el límite diario de la API, la clave o el modelo. Intenta de nuevo más tarde."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setAnalysis(null);
    } finally {
      setAnalyzing(false);
    }
  }, [data]);

  const verdict = data?.verdict;
  // Posicion del pin en el medidor: score -100..100 -> 0..100%.
  const pinPct = verdict ? (verdict.score + 100) / 2 : 50;
  const recentPatterns: Pattern[] = data
    ? [...data.patterns].slice(-12).reverse()
    : [];

  return (
    <main className="app">
      <div className="header">
        <h1>
          <CandleIcon />
          Detector de Velas Japonesas
        </h1>
        <p>Cripto · datos de Binance · gráfico estilo TradingView · veredicto con IA</p>
      </div>

      <div className="controls">
        <div className="field">
          <label htmlFor="symbol">Símbolo</label>
          <input
            id="symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="BTCUSDT"
            aria-describedby="symbol-hint"
          />
        </div>
        <div className="field">
          <label htmlFor="interval">Intervalo</label>
          <select
            id="interval"
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
          >
            {INTERVALS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <button onClick={load} disabled={loading}>
          {loading ? "Cargando velas…" : "Analizar"}
        </button>
        <button
          className="secondary"
          onClick={analyze}
          disabled={!data || analyzing}
          title={!data ? "Primero pulsa Analizar para cargar las velas" : undefined}
        >
          <SparklesIcon />
          {analyzing ? "Generando…" : "Veredicto con IA"}
        </button>
      </div>
      <p id="symbol-hint" className="hint">
        Escribe un par de Binance (ej. BTCUSDT, ETHUSDT, SOLUSDT) y elige el
        intervalo. Las flechas marcan los patrones; pasa el cursor o toca una
        vela para ver sus valores y el patrón.
      </p>

      {error && <div className="error">{error}</div>}

      <div className="grid">
        <div className="chart-panel">
          {data ? (
            <CandleChart candles={data.candles} patterns={data.patterns} />
          ) : (
            <div style={{ padding: 20 }} className="muted">
              {loading
                ? "Cargando velas…"
                : "Aún no hay velas. Escribe un símbolo y pulsa Analizar."}
            </div>
          )}
        </div>

        <div className="sidebar">
          <div className="card">
            <h2>Veredicto</h2>
            {verdict ? (
              <>
                <div className="verdict">
                  <span className={`badge ${verdict.bias}`}>
                    {biasLabel(verdict.bias)}
                  </span>
                  <span
                    className="score"
                    title="Sesgo ponderado de los últimos patrones, de −100 (muy bajista) a +100 (muy alcista)"
                  >
                    sesgo {verdict.score > 0 ? `+${verdict.score}` : verdict.score}
                  </span>
                </div>
                <div className="meter" aria-hidden="true">
                  <div className="pin" style={{ left: `${pinPct}%` }} />
                </div>
                <div className="muted">
                  {verdict.lastPattern
                    ? `Último patrón: ${verdict.lastPattern.name}`
                    : "Sin patrones recientes claros"}
                </div>
              </>
            ) : (
              <div className="muted">Carga un símbolo para ver el veredicto.</div>
            )}
          </div>

          <div className="card">
            <h2>Análisis con IA</h2>
            {analyzing || analysis ? (
              <div className="analysis">
                {analysis}
                {analyzing && <span className="caret" aria-hidden="true" />}
                {analyzing && !analysis && (
                  <span className="muted">Redactando el veredicto…</span>
                )}
              </div>
            ) : (
              <div className="muted">
                Pulsa “Veredicto con IA” para leer una explicación del análisis
                en lenguaje natural.
              </div>
            )}
          </div>

          <div className="card">
            <h2>Patrones detectados</h2>
            {recentPatterns.length > 0 ? (
              <div className="pattern-list">
                {recentPatterns.map((p, i) => (
                  <div className="pattern-item" key={`${p.key}-${p.time}-${i}`}>
                    <span className={`dot ${p.bias}`} />
                    <span className="name">{p.name}</span>
                    <span className="strength" title="Fuerza del patrón, 0–100">
                      {p.strength}
                    </span>
                  </div>
                ))}
              </div>
            ) : data ? (
              <div className="muted">
                No se detectaron patrones en estas velas. Prueba otro intervalo
                o símbolo.
              </div>
            ) : (
              <div className="muted">Aquí verás los patrones al analizar.</div>
            )}
          </div>
        </div>
      </div>

      <footer className="disclaimer">
        <p>
          Herramienta educativa. <strong>No es asesoría financiera.</strong> Los
          patrones de velas son señales probabilísticas: confírmalos con
          volumen, soportes y contexto antes de operar.
        </p>
        <p className="copyright">
          © 2026 Xentris LLC · Los Tres Dioses. Todos los derechos reservados.
        </p>
      </footer>
    </main>
  );
}
