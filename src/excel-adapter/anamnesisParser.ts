import * as XLSX from "xlsx";
import { Sex, Goal, ImportWarning } from "@/domain/types";

/** Lee Anamnesis por posicion de celda fija. Es un formulario simple (no una tabla
 * con filas repetidas), asi que la posicion fija es estable mientras no cambies
 * el orden de las preguntas del formulario. */

function strOrNull(ws: XLSX.WorkSheet, ref: string): string | null {
  const c = ws[ref];
  if (!c || c.v === undefined || c.v === null || c.v === "") return null;
  return String(c.v).trim();
}
function numOrNull(ws: XLSX.WorkSheet, ref: string): number | null {
  const c = ws[ref];
  if (!c || c.v === undefined || c.v === null || c.v === "") return null;
  const n = typeof c.v === "number" ? c.v : Number(c.v);
  return Number.isFinite(n) ? n : null;
}

export interface AnamnesisData {
  fullName: string | null;
  consultDate: string | null;
  sex: Sex | null;
  height: number | null;
  weight: number | null;
  goal: Goal | null;
  activityLevelLabel: string | null;
}

export function parseAnamnesis(ws: XLSX.WorkSheet, warnings: ImportWarning[]): AnamnesisData {
  const fullName = strOrNull(ws, "B5");
  const consultDateRaw = ws["B4"];
  let consultDate: string | null = null;
  if (consultDateRaw && consultDateRaw.v) {
    // xlsx puede traer fecha como numero de serie o string, segun como este cargada la celda
    if (typeof consultDateRaw.v === "number") {
      const d = XLSX.SSF.parse_date_code(consultDateRaw.v);
      if (d) consultDate = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    } else {
      consultDate = String(consultDateRaw.v);
    }
  }

  const sexRaw = strOrNull(ws, "B9");
  let sex: Sex | null = null;
  if (sexRaw === "Masculino" || sexRaw === "Femenino") sex = sexRaw;
  else if (sexRaw) {
    warnings.push({
      id: "warn_anamnesis_sexo",
      importId: "",
      severity: "bloqueante",
      sheet: "Anamnesis",
      cellRef: "B9",
      message: `El valor de "Sexo" ("${sexRaw}") no es "Masculino" ni "Femenino". Hay que corregirlo antes de continuar.`,
      resolved: false,
    });
  }

  const height = numOrNull(ws, "B16");
  const weight = numOrNull(ws, "B17");

  const goalRaw = strOrNull(ws, "B24");
  const validGoals: Goal[] = ["Descenso de peso", "Ganancia de masa muscular", "Recomposición corporal"];
  const goal = validGoals.includes(goalRaw as Goal) ? (goalRaw as Goal) : null;
  if (goalRaw && !goal) {
    warnings.push({
      id: "warn_anamnesis_objetivo",
      importId: "",
      severity: "advertencia",
      sheet: "Anamnesis",
      cellRef: "B24",
      message: `El "Objetivo principal" ("${goalRaw}") no coincide con ninguno de los 3 objetivos conocidos. Se va a pedir que lo confirmes manualmente.`,
      resolved: false,
    });
  }

  const activityLevelLabel = strOrNull(ws, "B34");

  const requiredMissing: Array<[string, unknown]> = [
    ["B5 (Nombre y apellido)", fullName],
    ["B4 (Fecha de consulta)", consultDate],
    ["B9 (Sexo)", sex],
    ["B16 (Talla)", height],
    ["B17 (Peso)", weight],
  ];
  for (const [label, value] of requiredMissing) {
    if (value === null) {
      warnings.push({
        id: `warn_anamnesis_missing_${label}`,
        importId: "",
        severity: "bloqueante",
        sheet: "Anamnesis",
        message: `Falta un dato obligatorio: ${label}. No completado automaticamente - hay que cargarlo a mano.`,
        resolved: false,
      });
    }
  }

  return { fullName, consultDate, sex, height, weight, goal, activityLevelLabel };
}
