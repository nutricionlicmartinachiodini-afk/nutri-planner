import * as XLSX from "xlsx";

/** Lee la hoja "Plan - textos": es la unica parte del sistema que Martina
 * escribe a mano por paciente (no se calcula ni se deriva de otra hoja).
 * B5 = "Objetivos del plan" (bloque numerado en Markdown), B21 =
 * "Observaciones / aclaraciones" generales. Las mapeamos a
 * Patient.objectivesText / Patient.indicationsText para que la ficha del
 * paciente no le pida reescribir algo que ya redacto en el Excel.
 * Si la celda esta vacia, devolvemos null (nunca se inventa texto: "lo que
 * dejes vacio, no aparece en el plan", tal como dice la propia hoja). */

function strOrNull(ws: XLSX.WorkSheet, ref: string): string | null {
  const c = ws[ref];
  if (!c || c.v === undefined || c.v === null) return null;
  const s = String(c.v).trim();
  return s === "" ? null : s;
}

export interface PlanTextosData {
  objectivesText: string | null;
  indicationsText: string | null;
}

export function parsePlanTextos(ws: XLSX.WorkSheet): PlanTextosData {
  return {
    objectivesText: strOrNull(ws, "B5"),
    indicationsText: strOrNull(ws, "B21"),
  };
}
