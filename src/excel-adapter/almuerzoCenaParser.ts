import * as XLSX from "xlsx";
import { Food, MealOption, MealType, MealCategory, ImportWarning } from "@/domain/types";
import { normalizeText } from "@/lib/slugify";

/** Lee Almuerzo y Cena de la hoja "Calculos". A diferencia de Desayuno/Merienda,
 * esta zona NO es una Tabla de Excel con nombre hoy: se ancla por los textos
 * "ALMUERZO" / "CENA" / "Alimento" (encabezado de columna). Es la parte mas
 * fragil del importador — si se reestructura el Excel, solo hay que tocar
 * este archivo. */

// Ojo: esta columna NO es una etiqueta semantica de seccion (hidratos/proteinas/...);
// es la categoria real del alimento en "Base de datos" (mas granular). Por eso el
// mapeo cubre varias categorias de Base de datos que en la practica aparecen dentro
// de Almuerzo/Cena. Si aparece una categoria nueva no listada aca, se importa igual
// pero SIN bucket asignado y se avisa (nunca se adivina en silencio).
const CATEGORY_MAP: Record<string, MealCategory> = {
  "HIDRATOS DE CARBONO": "hidratos",
  PAN: "hidratos",
  CARNES: "proteinas",
  ACEITE: "grasas",
  VEGETALES: "vegetales",
};

function cellStr(ws: XLSX.WorkSheet, ref: string): string | null {
  const c = ws[ref];
  if (!c || c.v === undefined || c.v === null || c.v === "") return null;
  return String(c.v).trim();
}
function cellNum(ws: XLSX.WorkSheet, ref: string): number | null {
  const c = ws[ref];
  if (!c || c.v === undefined || c.v === null || c.v === "") return null;
  const n = typeof c.v === "number" ? c.v : Number(c.v);
  return Number.isFinite(n) ? n : null;
}

function findSectionRow(ws: XLSX.WorkSheet, text: string, fromRow: number, toRow: number): number {
  for (let r = fromRow; r <= toRow; r++) {
    if (cellStr(ws, `A${r}`) === text) return r;
  }
  return -1;
}

export function parseAlmuerzoCena(
  ws: XLSX.WorkSheet,
  foods: Food[],
  patientId: string,
  warnings: ImportWarning[]
): MealOption[] {
  const options: MealOption[] = [];
  const maxRow = 220;

  const almuerzoRow = findSectionRow(ws, "ALMUERZO", 120, maxRow);
  const cenaRow = findSectionRow(ws, "CENA", 120, maxRow);

  if (almuerzoRow < 0 || cenaRow < 0) {
    warnings.push({
      id: "warn_almuerzo_cena_no_encontrados",
      importId: "",
      severity: "bloqueante",
      sheet: "Calculos",
      message: 'No se encontraron los encabezados "ALMUERZO" y/o "CENA" en la hoja Calculos. No se puede importar esta zona.',
      resolved: false,
    });
    return options;
  }

  parseSection(ws, "almuerzo", almuerzoRow, cenaRow, foods, patientId, options, warnings);
  parseSection(ws, "cena", cenaRow, maxRow, foods, patientId, options, warnings);

  warnings.push({
    id: "info_almuerzo_cena_posicion_fija",
    importId: "",
    severity: "info",
    sheet: "Calculos",
    message:
      'Almuerzo y Cena se leyeron anclando por texto ("ALMUERZO"/"CENA"/"Alimento"), pero la zona en si NO es una Tabla de Excel con nombre (a diferencia de "DESAYUNO"). Es la seccion menos estable del importador. Recomendacion ya entregada: convertirla en Tabla con nombre en una proxima version de tu plantilla.',
    resolved: false,
  });

  return options;
}

function parseSection(
  ws: XLSX.WorkSheet,
  mealType: MealType,
  startRow: number,
  endRow: number,
  foods: Food[],
  patientId: string,
  options: MealOption[],
  warnings: ImportWarning[]
) {
  // header "Alimento" dentro de la seccion
  let headerRow = -1;
  for (let r = startRow + 1; r < endRow; r++) {
    if (cellStr(ws, `A${r}`) === "Alimento") {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) {
    warnings.push({
      id: `warn_${mealType}_sin_encabezado`,
      importId: "",
      severity: "bloqueante",
      sheet: "Calculos",
      message: `No se encontro la fila de encabezado ("Alimento") dentro de la seccion de ${mealType}.`,
      resolved: false,
    });
    return;
  }

  let rowCount = 0;
  for (let row = headerRow + 1; row < endRow; row++) {
    const name = cellStr(ws, `A${row}`);
    if (!name) continue;
    const categoryRaw = cellStr(ws, `B${row}`);
    const category = categoryRaw ? CATEGORY_MAP[categoryRaw.toUpperCase()] ?? null : null;
    if (!category) {
      warnings.push({
        id: `warn_${mealType}_categoria_no_reconocida_${row}`,
        importId: "",
        severity: "advertencia",
        sheet: "Calculos",
        cellRef: `B${row}`,
        message: `"${name}" (fila ${row}, ${mealType}) tiene una categoria ("${categoryRaw ?? "vacia"}") que no coincide con Hidratos/Proteinas/Grasas/Vegetales. Se importa sin categoria asignada.`,
        resolved: false,
      });
    }
    rowCount++;

    const target = normalizeText(name);
    let food = foods.find((f) => normalizeText(f.name) === target) ?? null;
    if (!food) food = foods.find((f) => f.alternativeNames.some((a) => normalizeText(a) === target)) ?? null;
    if (!food) {
      warnings.push({
        id: `warn_${mealType}_no_match_${row}`,
        importId: "",
        severity: "bloqueante",
        sheet: "Calculos",
        cellRef: `A${row}`,
        message: `El alimento "${name}" (fila ${row}, ${mealType}) no coincide con ningun alimento del catalogo. Elegi el alimento correcto o cargalo como nuevo antes de continuar.`,
        resolved: false,
      });
    } else if (food.dataStatus === "incompleto") {
      warnings.push({
        id: `warn_${mealType}_incompleto_${row}`,
        importId: "",
        severity: "bloqueante",
        sheet: "Calculos",
        cellRef: `A${row}`,
        message: `"${food.name}" tiene estado "incompleto": no se puede usar en el plan hasta completar sus datos obligatorios.`,
        resolved: false,
      });
    } else if (food.dataStatus === "a_verificar") {
      warnings.push({
        id: `warn_${mealType}_averificar_${row}`,
        importId: "",
        severity: "advertencia",
        sheet: "Calculos",
        cellRef: `A${row}`,
        message: `"${food.name}" tiene estado "a verificar". Se importa igual, revisalo antes de generar el PDF.`,
        resolved: false,
      });
    }

    const quantity = cellNum(ws, `D${row}`);
    const cookedQuantity = food?.cookingFactor ? cellNum(ws, `J${row}`) : null; // nunca se inventa si no hay factor
    const homemadeMeasureText = food?.homemadeMeasureUnit || category === "vegetales" ? cellStr(ws, `K${row}`) : null;

    options.push({
      id: `mo_${mealType}_${category ?? "sincat"}_${row}`,
      patientId,
      mealType,
      optionNumber: null,
      category,
      foodId: food?.id ?? `__no_match__${row}`,
      quantity: quantity ?? 0,
      unit: cellStr(ws, `C${row}`) ?? "",
      cookedQuantity,
      homemadeMeasureText,
      computedKcal: cellNum(ws, `E${row}`) ?? 0,
      computedCarbs: cellNum(ws, `F${row}`) ?? 0,
      computedProtein: cellNum(ws, `G${row}`) ?? 0,
      computedFat: cellNum(ws, `H${row}`) ?? 0,
    });
  }

  if (rowCount === 0) {
    warnings.push({
      id: `warn_${mealType}_vacio`,
      importId: "",
      severity: "advertencia",
      sheet: "Calculos",
      message: `No se encontro ningun alimento en la seccion de ${mealType}.`,
      resolved: false,
    });
  }
}
