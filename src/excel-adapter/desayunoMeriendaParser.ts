import * as XLSX from "xlsx";
import { Food, MealOption, MealType, ImportWarning } from "@/domain/types";
import { normalizeText } from "@/lib/slugify";

/** Lee las opciones de Desayuno y Merienda de la hoja "Calculos" anclando por
 * TEXTO ("OPCIÓN N", "Alimento", "TOTAL:") en vez de por numero de fila fijo.
 * Esto es mas robusto que una posicion de fila hardcodeada: sigue funcionando
 * si se insertan o borran filas en otra parte de la hoja. Igual se marca como
 * "info: seccion leida por texto ancla, no por Tabla con nombre" en las
 * advertencias, para que quede visible en la pantalla de revision. */

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

interface OptionBlock {
  optionNumber: number;
  headerRow: number;
  totalRow: number;
}

function findOptionBlocks(ws: XLSX.WorkSheet, maxRow: number): OptionBlock[][] {
  const matches: { row: number; num: number }[] = [];
  const re = /^OPCI[ÓO]N\s+(\d+)/i;
  for (let row = 1; row <= maxRow; row++) {
    const v = cellStr(ws, `A${row}`);
    if (!v) continue;
    const m = re.exec(v);
    if (m) matches.push({ row, num: Number(m[1]) });
  }

  // agrupar en "corridas": cada vez que el numero de opcion vuelve a 1 (y ya veniamos
  // de una corrida con contenido) empieza un grupo nuevo (Desayuno -> Merienda)
  const groups: { row: number; num: number }[][] = [];
  let current: { row: number; num: number }[] = [];
  for (const m of matches) {
    if (m.num === 1 && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(m);
  }
  if (current.length > 0) groups.push(current);

  return groups.map((group) =>
    group.map(({ row, num }) => {
      // headerRow: siguiente fila con "Alimento" en col A
      let headerRow = -1;
      for (let r = row + 1; r <= row + 5; r++) {
        if (cellStr(ws, `A${r}`) === "Alimento") {
          headerRow = r;
          break;
        }
      }
      // totalRow: siguiente fila que empieza con "TOTAL" en col A
      let totalRow = -1;
      if (headerRow > 0) {
        for (let r = headerRow + 1; r <= headerRow + 30; r++) {
          const v = cellStr(ws, `A${r}`);
          if (v && v.toUpperCase().startsWith("TOTAL")) {
            totalRow = r;
            break;
          }
        }
      }
      return { optionNumber: num, headerRow, totalRow };
    })
  );
}

export function parseDesayunoMerienda(
  ws: XLSX.WorkSheet,
  foods: Food[],
  patientId: string,
  warnings: ImportWarning[]
): MealOption[] {
  const groups = findOptionBlocks(ws, 135); // Almuerzo arranca ~133, no hace falta ir mas alla
  const options: MealOption[] = [];

  const mealTypesInOrder: MealType[] = ["desayuno", "merienda"];
  groups.slice(0, 2).forEach((blocks, groupIdx) => {
    const mealType = mealTypesInOrder[groupIdx];
    if (!mealType) return;

    blocks.forEach((block) => {
      if (block.headerRow < 0 || block.totalRow < 0) {
        warnings.push({
          id: `warn_${mealType}_opcion_${block.optionNumber}_estructura`,
          importId: "",
          severity: "bloqueante",
          sheet: "Calculos",
          message: `No se pudo ubicar la tabla de la opcion ${block.optionNumber} de ${mealType} (falta el encabezado "Alimento" o la fila "TOTAL:"). Revisar si se modifico la estructura del Excel en esa zona.`,
          resolved: false,
        });
        return;
      }

      let namedRowCount = 0; // filas con nombre de alimento cargado, tenga o no cantidad
      let foodRowCount = 0; // filas efectivamente incluidas en el plan (con cantidad cargada)
      for (let row = block.headerRow + 1; row < block.totalRow; row++) {
        const name = cellStr(ws, `A${row}`);
        if (!name) continue;
        namedRowCount++;

        // Si la cantidad esta en blanco, Martina no quiere ese alimento en
        // esta opcion del plan de este paciente: se omite en silencio, no es
        // un error. (Antes esto generaba un bloqueante incorrecto.)
        const quantity = cellNum(ws, `D${row}`);
        if (quantity === null) continue;
        foodRowCount++;

        const food = matchFood(name, foods, mealType, row, warnings);

        if (food) {
          if (food.dataStatus === "incompleto") {
            warnings.push({
              id: `warn_${mealType}_opcion_${block.optionNumber}_incompleto_${row}`,
              importId: "",
              severity: "bloqueante",
              sheet: "Calculos",
              cellRef: `A${row}`,
              message: `"${food.name}" tiene estado "incompleto" en el catalogo: no se puede usar en el plan hasta completar sus datos obligatorios.`,
              resolved: false,
            });
          } else if (food.dataStatus === "a_verificar") {
            warnings.push({
              id: `warn_${mealType}_opcion_${block.optionNumber}_averificar_${row}`,
              importId: "",
              severity: "advertencia",
              sheet: "Calculos",
              cellRef: `A${row}`,
              message: `"${food.name}" tiene estado "a verificar" en el catalogo. Se importa igual, pero revisalo antes de generar el PDF.`,
              resolved: false,
            });
          } else if (food.dataStatus === "inactivo") {
            warnings.push({
              id: `warn_${mealType}_opcion_${block.optionNumber}_inactivo_${row}`,
              importId: "",
              severity: "advertencia",
              sheet: "Calculos",
              cellRef: `A${row}`,
              message: `"${food.name}" figura como "inactivo" en el catalogo pero se encontro en una importacion nueva. Confirma si corresponde reactivarlo o reemplazarlo.`,
              resolved: false,
            });
          }
        }

        options.push({
          id: `mo_${mealType}_${block.optionNumber}_${row}`,
          patientId,
          mealType,
          optionNumber: block.optionNumber,
          category: null,
          foodId: food?.id ?? `__no_match__${row}`,
          quantity,
          unit: cellStr(ws, `C${row}`) ?? "",
          cookedQuantity: null, // Desayuno/Merienda no maneja peso cocido en el Excel actual
          homemadeMeasureText: null,
          computedKcal: cellNum(ws, `E${row}`) ?? 0,
          computedCarbs: cellNum(ws, `F${row}`) ?? 0,
          computedProtein: cellNum(ws, `G${row}`) ?? 0,
          computedFat: cellNum(ws, `H${row}`) ?? 0,
        });
      }

      if (foodRowCount === 0) {
        if (namedRowCount > 0) {
          // Habia alimentos nombrados pero ninguno con cantidad cargada:
          // Martina dejo la opcion entera sin completar a proposito, no va en
          // el plan de este paciente. Es esperado, no es un error.
          warnings.push({
            id: `warn_${mealType}_opcion_${block.optionNumber}_sin_cantidades`,
            importId: "",
            severity: "info",
            sheet: "Calculos",
            message: `La opcion ${block.optionNumber} de ${mealType} no tiene cantidades cargadas en ningun alimento: se omite del plan de este paciente.`,
            resolved: false,
          });
        } else {
          warnings.push({
            id: `warn_${mealType}_opcion_${block.optionNumber}_vacia`,
            importId: "",
            severity: "advertencia",
            sheet: "Calculos",
            message: `La opcion ${block.optionNumber} de ${mealType} no tiene ningun alimento cargado.`,
            resolved: false,
          });
        }
      }
    });
  });

  warnings.push({
    id: "info_desayuno_merienda_ancla_texto",
    importId: "",
    severity: "info",
    sheet: "Calculos",
    message:
      'La zona de Desayuno y Merienda se leyo ubicando los textos "OPCIÓN N" / "Alimento" / "TOTAL:", no una Tabla de Excel con nombre (salvo "DESAYUNO"). Es razonablemente estable, pero no tan robusta como una Tabla con nombre.',
    resolved: false,
  });

  checkMeriendaMatchesDesayuno(options, warnings);

  return options;
}

function matchFood(
  name: string,
  foods: Food[],
  mealType: MealType,
  row: number,
  warnings: ImportWarning[]
): Food | null {
  const target = normalizeText(name);
  let food = foods.find((f) => normalizeText(f.name) === target) ?? null;
  if (!food) {
    food = foods.find((f) => f.alternativeNames.some((alt) => normalizeText(alt) === target)) ?? null;
  }
  if (!food) {
    warnings.push({
      id: `warn_${mealType}_no_match_${row}`,
      importId: "",
      severity: "bloqueante",
      sheet: "Calculos",
      cellRef: `A${row}`,
      message: `El alimento "${name}" (fila ${row}) no coincide con ningun alimento del catalogo "Base de datos". Elegi el alimento correcto o cargalo como nuevo antes de continuar.`,
      resolved: false,
    });
  }
  return food;
}

/** Compara, opcion por opcion, el conjunto de alimentos de Merienda contra el
 * equivalente de Desayuno. Nunca corrige solo - solo avisa, tal como pediste. */
function checkMeriendaMatchesDesayuno(options: MealOption[], warnings: ImportWarning[]) {
  const byMeal = (mt: MealType, opt: number) =>
    options.filter((o) => o.mealType === mt && o.optionNumber === opt).map((o) => o.foodId);

  const optionNumbers = Array.from(new Set(options.filter((o) => o.mealType === "desayuno").map((o) => o.optionNumber)));
  for (const opt of optionNumbers) {
    const desayunoFoods = new Set(byMeal("desayuno", opt as number));
    const meriendaFoods = new Set(byMeal("merienda", opt as number));
    if (meriendaFoods.size === 0) continue; // ya se avisa aparte que la opcion esta vacia
    const sameSize = desayunoFoods.size === meriendaFoods.size;
    const sameContent = sameSize && [...desayunoFoods].every((f) => meriendaFoods.has(f));
    if (!sameContent) {
      warnings.push({
        id: `warn_merienda_vs_desayuno_opcion_${opt}`,
        importId: "",
        severity: "advertencia",
        sheet: "Calculos",
        message: `La opción de merienda no contiene los mismos ingredientes que la opción equivalente del desayuno (opción ${opt}).`,
        resolved: false,
      });
    }
  }
}
