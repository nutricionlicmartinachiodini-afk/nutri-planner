import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { PlanDraft, ImportWarning, Patient } from "@/domain/types";
import { parseBaseDeDatos } from "./baseDeDatosParser";
import { parseAnamnesis } from "./anamnesisParser";
import { parseReferencia } from "./referenciaParser";
import { parseDesayunoMerienda } from "./desayunoMeriendaParser";
import { parseAlmuerzoCena } from "./almuerzoCenaParser";

/** Punto de entrada del importador. Devuelve un PlanDraft en memoria - nada se
 * persiste todavia. La pantalla de Revision es la que decide si se confirma. */
export function importExcelFile(buffer: Buffer | ArrayBuffer): PlanDraft {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const importId = uuidv4();
  const warnings: ImportWarning[] = [];

  const requiredSheets = ["Anamnesis", "Calculos", "Base de datos"];
  for (const s of requiredSheets) {
    if (!wb.Sheets[s]) {
      warnings.push({
        id: `warn_missing_sheet_${s}`,
        importId,
        severity: "bloqueante",
        sheet: s,
        message: `No se encontro la hoja "${s}" en el archivo. La importacion no puede continuar sin ella.`,
        resolved: false,
      });
    }
  }
  if (warnings.some((w) => w.severity === "bloqueante")) {
    return { importId, patient: {}, mealOptions: [], foods: [], warnings: withImportId(warnings, importId) };
  }

  const { foods, warnings: foodWarnings } = parseBaseDeDatos(wb.Sheets["Base de datos"]!);
  warnings.push(...foodWarnings);

  const anamnesis = parseAnamnesis(wb.Sheets["Anamnesis"]!, warnings);
  const activityLevels = wb.Sheets["Referencia"] ? parseReferencia(wb.Sheets["Referencia"]) : [];
  const activityLevel = matchActivityLevel(anamnesis.activityLevelLabel, activityLevels);
  if (anamnesis.activityLevelLabel && !activityLevel) {
    warnings.push({
      id: "warn_nivel_actividad_no_encontrado",
      importId,
      severity: "advertencia",
      sheet: "Anamnesis",
      cellRef: "B34",
      message: `El nivel de actividad ("${anamnesis.activityLevelLabel}") no coincide con ninguno de los 5 valores de la hoja Referencia.`,
      resolved: false,
    });
  }

  const [lastName, ...firstRest] = (anamnesis.fullName ?? "").split(" ");
  const patient: Partial<Patient> = {
    id: uuidv4(),
    firstName: firstRest.join(" ") || undefined,
    lastName: lastName || undefined,
    sex: anamnesis.sex ?? undefined,
    height: anamnesis.height ?? undefined,
    weight: anamnesis.weight ?? undefined,
    consultDate: anamnesis.consultDate ?? undefined,
    goal: anamnesis.goal ?? undefined,
    // Si matcheo (exacto o por prefijo antes de ":"), guardamos la categoria
    // limpia ("Ligero") en vez del texto crudo del desplegable, para que se
    // vea bien en la ficha y en el futuro PDF. Si no matcheo ninguna, dejamos
    // el texto tal cual vino (nunca lo inventamos ni lo recortamos a ciegas).
    activityLevel: activityLevel?.label ?? anamnesis.activityLevelLabel ?? undefined,
    activityFactor: activityLevel?.factor,
  };

  const calculosWs = wb.Sheets["Calculos"]!;
  const patientId = patient.id as string;
  const desayunoMerienda = parseDesayunoMerienda(calculosWs, foods, patientId, warnings);
  const almuerzoCena = parseAlmuerzoCena(calculosWs, foods, patientId, warnings);

  const mealOptions = [...desayunoMerienda, ...almuerzoCena];

  return {
    importId,
    patient,
    mealOptions,
    foods,
    warnings: withImportId(warnings, importId),
  };
}

function withImportId(warnings: ImportWarning[], importId: string): ImportWarning[] {
  return warnings.map((w) => ({ ...w, importId }));
}

/** El desplegable de "Nivel de actividad fisica" en Anamnesis puede guardar
 * solo la categoria ("Ligero") o la categoria + el criterio completo
 * concatenados ("Ligero: Ejercicio ligero 1-3 dias/semana..."), segun como
 * este armada la lista de opciones en el Excel de origen. Probamos match
 * exacto primero y, si falla, tratamos todo lo que esta antes de ":" como la
 * categoria real. Nunca inventamos un valor si ninguna de las dos formas
 * matchea - en ese caso queda como advertencia, igual que antes.
 */
function matchActivityLevel(
  label: string | null,
  levels: { label: string; factor: number; criterio: string }[]
) {
  if (!label) return undefined;
  const exact = levels.find((l) => l.label === label);
  if (exact) return exact;
  const prefix = label.split(":")[0]?.trim();
  if (!prefix) return undefined;
  return levels.find((l) => l.label === prefix);
}
