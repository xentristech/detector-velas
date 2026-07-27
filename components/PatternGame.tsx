"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Markdown from "@/components/Markdown";
import Confetti from "@/components/Confetti";
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
  // Contador que se incrementa en cada acierto para relanzar el confeti.
  const [burst, setBurst] = useState(0);

  // Repaso con IA del patron fallado.
  const [lesson, setLesson] = useState<string | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);

  const loadRound = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    setLesson(null);
    setLessonError(null);
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
      setBurst((b) => b + 1);
      setStreak((st) => {
        const next = st + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setStreak(0);
    }
  };

  // Pide a la IA un repaso didactico del patron que se fallo (streaming).
  const requestLesson = useCallback(async () => {
    if (!round) return;
    setLessonLoading(true);
    setLessonError(null);
    setLesson("");
    try {
      const res = await fetch("/api/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: round.correctKey,
          name: round.correctName,
          bias: round.bias,
        }),
      });
      if (!res.ok) {
        let msg = "No se pudo generar el repaso.";
        try {
          const j = await res.json();
          msg = j.error || msg;
        } catch {
          /* respuesta no-JSON */
        }
        throw new Error(msg);
      }
      const reader = res.body?.getReader();
      if (!reader) {
        setLesson(await res.text());
        return;
      }
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setLesson(acc);
      }
      if (!acc.trim()) {
        setLessonError(
          "La IA no devolvió texto. Puede ser el límite diario o que falte la clave."
        );
      }
    } catch (e) {
      setLessonError(e instanceof Error ? e.message : "Error desconocido.");
      setLesson(null);
    } finally {
      setLessonLoading(false);
    }
  }, [round]);

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
          <span key={score} className="stat-num pop">
            {score}/{total}
          </span>
          <span className="stat-lbl">aciertos ({pct}%)</span>
        </div>
        <div className={`stat ${streak >= 3 ? "hot" : ""}`}>
          <span key={streak} className="stat-num pop">
            {streak}
            <span className="stat-fire">🔥</span>
          </span>
          <span className="stat-lbl">racha</span>
        </div>
        <div className="stat">
          <span key={bestStreak} className="stat-num pop">
            {bestStreak}
          </span>
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
              {round?.options.map((o, idx) => (
                <button
                  key={o.key}
                  className={optionClass(o.key)}
                  style={{ "--i": idx } as React.CSSProperties}
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
              {selected === round.correctKey && <Confetti key={burst} />}
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

              {selected !== round.correctKey && (
                <div className="game-lesson">
                  {!lesson && !lessonLoading && !lessonError && (
                    <button className="lesson-btn" onClick={requestLesson}>
                      🎓 ¿Quieres repasar este patrón con IA?
                    </button>
                  )}
                  {(lessonLoading || lesson) && (
                    <div className="analysis lesson-text">
                      {lesson && <Markdown text={lesson} />}
                      {lessonLoading && (
                        <span className="caret" aria-hidden="true" />
                      )}
                      {lessonLoading && !lesson && (
                        <span className="muted">Preparando tu repaso…</span>
                      )}
                    </div>
                  )}
                  {lessonError && (
                    <div className="error" style={{ marginTop: 8 }}>
                      {lessonError}
                    </div>
                  )}
                </div>
              )}

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
