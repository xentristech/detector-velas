"use client";

import { useMemo } from "react";

const COLORS = ["#f5a524", "#26a69a", "#42a5f5", "#ef5350", "#a78bfa", "#ffa726"];

// Ráfaga de confeti para celebrar un acierto. Las piezas se colocan de forma
// determinística (por índice) para evitar desajustes de hidratación en SSR.
export default function Confetti({ count = 18 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 55 + ((i * 37) % 45);
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 18,
          rot: (i * 47) % 360,
          delay: (i % 5) * 18,
          color: COLORS[i % COLORS.length],
        };
      }),
    [count]
  );

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              "--x": `${p.x}px`,
              "--y": `${p.y}px`,
              "--rot": `${p.rot}deg`,
              animationDelay: `${p.delay}ms`,
              background: p.color,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
