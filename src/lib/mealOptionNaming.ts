import { MealOption, MealType } from "@/domain/types";

export interface MealOptionItem {
  foodName: string;
  quantity: number;
  unit: string;
}

export interface MealOptionGroup {
  optionNumber: number;
  autoName: string;
  items: MealOptionItem[];
}

/** Agrupa las MealOption de Desayuno o Merienda por numero de opcion, y arma
 * un nombre automatico concatenando los alimentos (ej. "Leche proteica 52 gr
 * + Pan integral + Huevo"). Es el punto de partida honesto: Martina lo puede
 * sobreescribir por algo mas natural ("Infusion con leche + tostada con
 * queso y fruta") desde Configuracion de comidas. Nunca inventamos un
 * nombre "lindo" nosotros - solo concatenamos lo que realmente esta en la
 * opcion. */
export function groupMealOptionsByOptionNumber(
  options: MealOption[],
  mealType: MealType
): MealOptionGroup[] {
  const relevant = options.filter((o) => o.mealType === mealType && o.optionNumber !== null);
  const byOption = new Map<number, MealOption[]>();
  for (const o of relevant) {
    const key = o.optionNumber as number;
    if (!byOption.has(key)) byOption.set(key, []);
    byOption.get(key)!.push(o);
  }
  return Array.from(byOption.entries())
    .sort(([a], [b]) => a - b)
    .map(([optionNumber, opts]) => ({
      optionNumber,
      autoName: opts.map((o) => o.foodNameSnapshot ?? o.foodId).join(" + "),
      items: opts.map((o) => ({
        foodName: o.foodNameSnapshot ?? o.foodId,
        quantity: o.quantity,
        unit: o.unit,
      })),
    }));
}
