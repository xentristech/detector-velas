"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { GameRound } from "@/lib/types";

const GameChart = dynamic(() => import("@/components/GameChart"), {
  ssr: false,
});

function biasLabel(bias: string) {
  if (bias === "alcista") return "ALCISTA";
  if (bias === "bajista") return "BAJISTA";
  return "NEUTRAL";
}

export default function PatternGame() {
  const [round, setRound] = useState<GameRound | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const loadRound = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const res = await fetch("/api/game", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo cargar la ronda.");
      setRound(json as GameRound);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido.");
      setRound(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRound();
  }, [loadRound]);

  const answered = selected !== null;

  const choose = (key: string) => {
    if (answered || !round) return;
    setSelected(key);
    setTotal((t) => t + 1);
    if (key === round.correctKey) {
      setScore((s) => s + 1);
      setStreak((st) => {
        const next = st + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setStreak(0);
    }
  };

  // Clase visual de cada boton segun el estado tras responder.
  const optionClass = (key: string) => {
    if (!answered) return "game-option";
    if (key === round?.correctKey) return "game-option correct";
    if (key === selected) return "game-option wrong";
    return "game-option dim";
  };

  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div className="game">
      <div className="game-scorebar">
        <div className="stat">
          <span className="stat-num">{score}/{total}</span>
          <span className="stat-lbl">aciertos ({pct}%)</span>
        </div>
        <div className="stat">
          <span className="stat-num">{streak}🔥</span>
          <span className="stat-lbl">racha</span>
        </div>
        <div className="stat">
          <span className="stat-num">{bestStreak}</span>
          <span className="stat-lbl">mejor racha</span>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="game-grid">
        <div className="chart-panel game-chart">
          {round ? (
            <GameChart candles={round.candles} markerTime={round.markerTime} />
          ) : (
            <div style={{ padding: 20 }} className="muted">
              {loading ? "Cargando ronda…" : "—"}
            </div>
          )}
        </div>

        <div className="game-panel">
          <div className="card">
            <h2>¿Qué patrón ves?</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {round
                ? `Marcado en ${round.symbol} · ${round.interval}. Mira las velas del círculo dorado.`
                : "Preparando…"}
            </p>

            <div className="game-options">
              {round?.options.map((o) => (
                <button
                  key={o.key}
                  className={optionClass(o.key)}
                  onClick={() => choose(o.key)}
                  disabled={answered || loading}
                >
                  {o.name}
                </button>
              ))}
            </div>
          </div>

          {answered && round && (
            <div className="card game-feedback">
              <div
                className={`game-result ${
                  selected === round.correctKey ? "ok" : "no"
                }`}
              >
                {selected === round.correctKey
                  ? "¡Correcto! 🎉"
                  : "Casi. La respuesta era:"}
              </div>
              <div className="game-answer">
                <span className={`badge ${round.bias}`}>
                  {biasLabel(round.bias)}
                </span>
                <strong>{round.correctName}</strong>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                {round.description}
              </p>
              <button
                className="game-next"
                onClick={loadRound}
                disabled={loading}
              >
                {loading ? "Cargando…" : "Siguiente ronda →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
