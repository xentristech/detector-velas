// Markdown minimo y seguro (nodos React, sin HTML crudo ni dependencias).
// Soporta negritas (**...**) y parrafos por linea. Suficiente para el
// analisis de IA y las lecciones del juego.

function renderInline(text: string, prefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <strong key={prefix + i}>{part.slice(2, -2)}</strong>;
    }
    return part ? <span key={prefix + i}>{part}</span> : null;
  });
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) =>
        line.trim() === "" ? (
          <div key={i} className="md-gap" />
        ) : (
          <p key={i} className="md-p">
            {renderInline(line, `${i}-`)}
          </p>
        )
      )}
    </>
  );
}
