import * as XLSX from "xlsx";
import { Food, DataStatus, CookedBase, ImportWarning } from "@/domain/types";
import { slugify } from "@/lib/slugify";

/**
 * Lee la hoja "Base de datos" fila por fila (rango de encabezado fijo, filas 2 a 200,
 * se detiene en la primera fila totalmente vacia). Esta zona es estable: tiene
 * encabezados de columna fijos en la fila 1, no depende de numero de fila del contenido.
 */

const COLS = {
  categoria: "A",
  alimento: "B",
  cantidadBase: "C",
  unidad: "D",
  refOriginal: "E",
  kcalBase: "F",
  hdcBase: "G",
  protBase: "H",
  grasasBase: "I",
  kcalUnidad: "J",
  hdcUnidad: "K",
  protUnidad: "L",
  grasasUnidad: "M",
  marca: "N",
  link: "O",
  estadoDato: "P",
  estadoCrudoCocido: "Q",
  factorCoccion: "R",
  medidaCaseraUnidad: "S",
  medidaCaseraGramos: "T",
  medidaCaseraBase: "U",
  tamanoChico: "V",
  tamanoMediano: "W",
  tamanoGrande: "X",
} as const;

function mapDataStatus(raw: string | null, rowRef: string, warnings: ImportWarning[]): DataStatus {
  if (!raw) return "a_verificar";
  const norm = raw.trim().toLowerCase();
  if (norm === "completo") return "completo";
  if (norm === "a verificar") return "a_verificar";
  if (norm === "incompleto") return "incompleto";
  if (norm === "inactivo") return "inactivo";
  warnings.push({
    id: `warn_${rowRef}_estado`,
    importId: "",
    severity: "advertencia",
    sheet: "Base de datos",
    cellRef: rowRef,
    message: `"Estado dato" tiene un valor no reconocido ("${raw}"). Se trato como "a_verificar" hasta que lo confirmes.`,
    resolved: false,
  });
  return "a_verificar";
}

function mapCookedBase(raw: string | null): CookedBase | null {
  if (!raw) return null;
  const norm = raw.trim().toLowerCase();
  if (norm.startsWith("crudo")) return "crudo";
  if (norm.startsWith("cocido")) return "cocido";
  if (norm.startsWith("no aplica") || norm === "n/a") return "no_aplica";
  return null;
}

function numOrNull(v: XLSX.CellObject | undefined): number | null {
  if (!v || v.v === undefined || v.v === null || v.v === "") return null;
  const n = typeof v.v === "number" ? v.v : Number(v.v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: XLSX.CellObject | undefined): string | null {
  if (!v || v.v === undefined || v.v === null || v.v === "") return null;
  return String(v.v).trim();
}

export function parseBaseDeDatos(ws: XLSX.WorkSheet): { foods: Food[]; warnings: ImportWarning[] } {
  const foods: Food[] = [];
  const warnings: ImportWarning[] = [];
  const seenSlugs = new Map<string, string>(); // slug -> nombre original, para detectar colisiones

  for (let row = 2; row <= 200; row++) {
    const nameCell = ws[`${COLS.alimento}${row}`];
    const name = strOrNull(nameCell);
    if (!name) {
      // fila totalmente vacia (o sin nombre): fin de la tabla si ya venimos leyendo datos
      if (foods.length > 0) {
        // confirmamos que el resto de la fila tambien este vacio antes de cortar
        const cat = strOrNull(ws[`${COLS.categoria}${row}`]);
        if (!cat) break;
      }
      continue;
    }

    const id = slugify(name);
    if (seenSlugs.has(id)) {
      warnings.push({
        id: `warn_food_dup_${row}`,
        importId: "",
        severity: "advertencia",
        sheet: "Base de datos",
        cellRef: `B${row}`,
        message: `El alimento "${name}" (fila ${row}) genera el mismo ID interno que "${seenSlugs.get(id)}". Revisar si son el mismo alimento duplicado o nombres que necesitan diferenciarse.`,
        resolved: false,
      });
    }
    seenSlugs.set(id, name);

    const kcalPerUnit = numOrNull(ws[`${COLS.kcalUnidad}${row}`]);
    const carbsPerUnit = numOrNull(ws[`${COLS.hdcUnidad}${row}`]);
    const proteinPerUnit = numOrNull(ws[`${COLS.protUnidad}${row}`]);
    const fatPerUnit = numOrNull(ws[`${COLS.grasasUnidad}${row}`]);

    if (kcalPerUnit === null) {
      warnings.push({
        id: `warn_food_kcal_${row}`,
        importId: "",
        severity: "bloqueante",
        sheet: "Base de datos",
        cellRef: `J${row}`,
        message: `"${name}" (fila ${row}) no tiene "Kcal / unidad" numerico. No se puede usar en ningun calculo hasta completarlo.`,
        resolved: false,
      });
    }

    const dataStatus = mapDataStatus(strOrNull(ws[`${COLS.estadoDato}${row}`]), `P${row}`, warnings);

    const food: Food = {
      id,
      name,
      alternativeNames: [],
      category: strOrNull(ws[`${COLS.categoria}${row}`]) ?? "",
      baseQuantity: numOrNull(ws[`${COLS.cantidadBase}${row}`]) ?? 0,
      baseUnit: strOrNull(ws[`${COLS.unidad}${row}`]) ?? "",
      kcalPerUnit: kcalPerUnit ?? 0,
      carbsPerUnit: carbsPerUnit ?? 0,
      proteinPerUnit: proteinPerUnit ?? 0,
      fatPerUnit: fatPerUnit ?? 0,
      cookingFactor: numOrNull(ws[`${COLS.factorCoccion}${row}`]),
      homemadeMeasureUnit: strOrNull(ws[`${COLS.medidaCaseraUnidad}${row}`]),
      homemadeMeasureGrams: numOrNull(ws[`${COLS.medidaCaseraGramos}${row}`]),
      homemadeMeasureBase: mapCookedBase(strOrNull(ws[`${COLS.medidaCaseraBase}${row}`])),
      sizeSmallG: numOrNull(ws[`${COLS.tamanoChico}${row}`]),
      sizeMediumG: numOrNull(ws[`${COLS.tamanoMediano}${row}`]),
      sizeLargeG: numOrNull(ws[`${COLS.tamanoGrande}${row}`]),
      dataStatus,
      sourceRowRef: `Base de datos!B${row}`,
      brand: strOrNull(ws[`${COLS.marca}${row}`]),
      link: strOrNull(ws[`${COLS.link}${row}`]),
    };

    if (!food.cookingFactor || !food.homemadeMeasureUnit) {
      warnings.push({
        id: `info_food_missing_cocido_${row}`,
        importId: "",
        severity: "info",
        sheet: "Base de datos",
        cellRef: `B${row}`,
        message: `"${name}" no tiene factor de coccion y/o medida casera cargados. El plan va a mostrar solo la cantidad disponible; se puede completar el catalogo mas adelante.`,
        resolved: false,
      });
    }

    foods.push(food);
  }

  return { foods, warnings };
}
