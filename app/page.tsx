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
      if (!res.ok) throw new Error(json.error || "Error al cargar datos");
      setData(json as CandlesResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
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
        setError("La IA no devolvio texto. Revisa la clave o el modelo.");
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
        <h1>🕯️ Detector de Velas Japonesas</h1>
        <p>Cripto · Binance · visualizacion TradingView · veredicto con IA</p>
      </div>

      <div className="controls">
        <div className="field">
          <label htmlFor="symbol">Simbolo</label>
          <input
            id="symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="BTCUSDT"
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
          {loading ? "Cargando…" : "Analizar"}
        </button>
        <button
          className="secondary"
          onClick={analyze}
          disabled={!data || analyzing}
        >
          {analyzing ? "Pensando…" : "🤖 Veredicto IA"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid">
        <div className="chart-panel">
          {data ? (
            <CandleChart candles={data.candles} patterns={data.patterns} />
          ) : (
            <div style={{ padding: 20 }} className="muted">
              {loading ? "Cargando velas…" : "Sin datos"}
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
                  <span className="score">score {verdict.score}</span>
                </div>
                <div className="meter">
                  <div className="pin" style={{ left: `${pinPct}%` }} />
                </div>
                <div className="muted">
                  {verdict.lastPattern
                    ? `Ultimo patron: ${verdict.lastPattern.name}`
                    : "Sin patrones recientes claros"}
                </div>
              </>
            ) : (
              <div className="muted">—</div>
            )}
          </div>

          <div className="card">
            <h2>Analisis IA (OpenAI)</h2>
            {analyzing || analysis ? (
              <div className="analysis">
                {analysis || (analyzing ? "" : "")}
                {analyzing && <span className="caret" aria-hidden="true" />}
                {analyzing && !analysis && (
                  <span className="muted">Pensando…</span>
                )}
              </div>
            ) : (
              <div className="muted">
                Pulsa “Veredicto IA” para una explicacion en lenguaje natural.
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
                    <span className="strength">{p.strength}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">Sin patrones detectados.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
