"use client";

export function PrintButton() {
  return (
    <button className="primary no-print" onClick={() => window.print()}>
      Exportar / Imprimir PDF
    </button>
  );
}
