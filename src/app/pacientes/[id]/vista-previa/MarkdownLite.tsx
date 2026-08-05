// Render minimo de markdown liviano (##, ###, **negrita**, listas con * o -)
// para el texto de Objetivos/Indicaciones que Martina escribe en la hoja
// "Plan - textos" del Excel. No es un parser de markdown completo: solo
// cubre la sintaxis que ella usa realmente, sin depender de una libreria
// externa (no hay acceso a red para instalar paquetes nuevos en este
// entorno).

function renderInline(text: string, key: number) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span key={key}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  function flushList() {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${key++}`} className="obj-list">
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item, i)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      blocks.push(<h4 key={key++}>{line.slice(4)}</h4>);
    } else if (line.startsWith("## ")) {
      flushList();
      blocks.push(<h3 key={key++}>{line.slice(3)}</h3>);
    } else if (line.startsWith("* ") || line.startsWith("- ")) {
      listBuffer.push(line.slice(2));
    } else {
      flushList();
      blocks.push(<p key={key++}>{renderInline(line, key)}</p>);
    }
  }
  flushList();

  return <>{blocks}</>;
}
