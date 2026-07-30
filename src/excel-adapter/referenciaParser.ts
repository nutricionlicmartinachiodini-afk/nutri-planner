import * as XLSX from "xlsx";

export interface ActivityLevel {
  label: string;
  factor: number;
  criterio: string;
}

/** Hoja "Referencia": tabla chica (5 filas fijas, filas 3-7), encabezado en fila 2.
 * Estable porque son pocas filas con encabezado claro. */
export function parseReferencia(ws: XLSX.WorkSheet): ActivityLevel[] {
  const levels: ActivityLevel[] = [];
  for (let row = 3; row <= 7; row++) {
    const label = ws[`A${row}`]?.v;
    const factor = ws[`B${row}`]?.v;
    const criterio = ws[`C${row}`]?.v;
    if (label && typeof factor === "number") {
      levels.push({ label: String(label), factor, criterio: criterio ? String(criterio) : "" });
    }
  }
  return levels;
}
