import { MealOption, MealType, MealCategory } from "@/domain/types";

/**
 * Logica de deteccion automatica para Configuracion de comidas.
 * Se recalcula siempre a partir de las MealOption actuales del paciente (no
 * se cachea un valor viejo): si el catalogo o las opciones cambian, la
 * deteccion automatica se actualiza sola. El override manual, si existe,
 * siempre gana por sobre lo automatico.
 */

function foodSet(options: MealOption[], mealType: MealType, group: number | MealCategory | null): Set<string> {
  return new Set(
    options
      .filter((o) => o.mealType === mealType && (group === null || o.optionNumber === group || o.category === group))
      .map((o) => o.foodId)
  );
}

/** true = Desayuno y Merienda tienen, opcion por opcion, exactamente los mismos
 * alimentos (mismo criterio que la advertencia de importacion). Si son
 * identicos en todas las opciones, tiene sentido unificarlos en una sola
 * seccion del plan. */
export function computeUnifyBreakfastSnackAuto(options: MealOption[]): boolean {
  const optionNumbers = Array.from(
    new Set(options.filter((o) => o.mealType === "desayuno").map((o) => o.optionNumber))
  ).filter((n): n is number => n !== null);
  if (optionNumbers.length === 0) return false;
  return optionNumbers.every((opt) => {
    const a = foodSet(options, "desayuno", opt);
    const b = foodSet(options, "merienda", opt);
    return a.size > 0 && a.size === b.size && [...a].every((f) => b.has(f));
  });
}

export function computeUnifyLunchDinnerAuto(options: MealOption[]): boolean {
  const categories: MealCategory[] = ["hidratos", "proteinas", "grasas", "vegetales"];
  const relevant = categories.filter(
    (c) => options.some((o) => o.mealType === "almuerzo" && o.category === c) ||
           options.some((o) => o.mealType === "cena" && o.category === c)
  );
  if (relevant.length === 0) return false;
  return relevant.every((cat) => {
    const a = foodSet(options, "almuerzo", cat);
    const b = foodSet(options, "cena", cat);
    return a.size > 0 && a.size === b.size && [...a].every((f) => b.has(f));
  });
}

export function computeHasCarbsAuto(options: MealOption[], mealType: "almuerzo" | "cena"): boolean {
  return options.some((o) => o.mealType === mealType && o.category === "hidratos");
}

export interface MealConfigOverride {
  unifyBreakfastSnackManualOverride: boolean | null;
  unifyLunchDinnerManualOverride: boolean | null;
  lunchHasCarbs: boolean | null; // null = todavia no se guardo override, usar auto
  dinnerHasCarbs: boolean | null;
}

export interface MealConfigResolved {
  unifyBreakfastSnackAuto: boolean;
  unifyBreakfastSnackManualOverride: boolean | null;
  unifyBreakfastSnack: boolean; // efectivo
  unifyLunchDinnerAuto: boolean;
  unifyLunchDinnerManualOverride: boolean | null;
  unifyLunchDinner: boolean; // efectivo
  lunchHasCarbsAuto: boolean;
  lunchHasCarbs: boolean; // efectivo
  dinnerHasCarbsAuto: boolean;
  dinnerHasCarbs: boolean; // efectivo
}

export function resolveMealConfig(options: MealOption[], override: MealConfigOverride | null): MealConfigResolved {
  const unifyBreakfastSnackAuto = computeUnifyBreakfastSnackAuto(options);
  const unifyLunchDinnerAuto = computeUnifyLunchDinnerAuto(options);
  const lunchHasCarbsAuto = computeHasCarbsAuto(options, "almuerzo");
  const dinnerHasCarbsAuto = computeHasCarbsAuto(options, "cena");

  return {
    unifyBreakfastSnackAuto,
    unifyBreakfastSnackManualOverride: override?.unifyBreakfastSnackManualOverride ?? null,
    unifyBreakfastSnack: override?.unifyBreakfastSnackManualOverride ?? unifyBreakfastSnackAuto,
    unifyLunchDinnerAuto,
    unifyLunchDinnerManualOverride: override?.unifyLunchDinnerManualOverride ?? null,
    unifyLunchDinner: override?.unifyLunchDinnerManualOverride ?? unifyLunchDinnerAuto,
    lunchHasCarbsAuto,
    lunchHasCarbs: override?.lunchHasCarbs ?? lunchHasCarbsAuto,
    dinnerHasCarbsAuto,
    dinnerHasCarbs: override?.dinnerHasCarbs ?? dinnerHasCarbsAuto,
  };
}
