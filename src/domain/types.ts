/**
 * Modelo de dominio - Etapa 1
 * Basado en el documento "etapa-1-propuesta-detallada.md" aprobado por Martina.
 *
 * Principio central: todo alimento se identifica por un `id` interno estable.
 * El nombre de "Base de datos" (`name`) es el texto que se muestra al paciente,
 * pero NUNCA es la clave de relacion entre entidades.
 */

export type DataStatus = "completo" | "a_verificar" | "incompleto" | "inactivo";

export type CookedBase = "crudo" | "cocido" | "no_aplica";

export interface Food {
  id: string; // ej. "food_arroz-integral-yamani" - generado una sola vez, estable
  name: string; // nombre visible = columna "Alimento" de Base de datos
  alternativeNames: string[]; // solo para busqueda/matching interno, nunca se muestran salvo activacion explicita
  category: string;
  baseQuantity: number;
  baseUnit: string;
  kcalPerUnit: number; // columna "Kcal / unidad" (J) - fuente real de calculo
  carbsPerUnit: number; // K
  proteinPerUnit: number; // L
  fatPerUnit: number; // M
  cookingFactor: number | null; // columna R, null si no existe (no inventar)
  homemadeMeasureUnit: string | null; // columna S
  homemadeMeasureGrams: number | null; // columna T
  homemadeMeasureBase: CookedBase | null; // columna U
  sizeSmallG: number | null; // columna V (hoy solo papa)
  sizeMediumG: number | null; // columna W
  sizeLargeG: number | null; // columna X
  dataStatus: DataStatus;
  sourceRowRef: string; // fila/nombre original del Excel, para auditoria y reimportacion
  brand?: string | null;
  link?: string | null;
}

export type Sex = "Masculino" | "Femenino";
export type Goal = "Descenso de peso" | "Ganancia de masa muscular" | "Recomposición corporal";

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dni?: string;
  birthDate?: string; // ISO date
  sex: Sex;
  consultDate: string; // ISO date - NO texto libre, para poder derivar el nombre de archivo del PDF
  height: number; // cm
  weight: number; // kg
  activityLevel: string; // uno de los 5 valores de la hoja Referencia
  activityFactor: number;
  goal: Goal;
  objectivesText: string;
  indicationsText: string;
}

export type MealType = "desayuno" | "merienda" | "almuerzo" | "cena";
export type MealCategory = "hidratos" | "proteinas" | "grasas" | "vegetales";

export interface MealOption {
  id: string;
  patientId: string;
  mealType: MealType;
  optionNumber: number | null; // solo desayuno/merienda
  category: MealCategory | null; // solo almuerzo/cena
  foodId: string; // FK a Food.id - NUNCA el nombre como texto
  quantity: number;
  unit: string;
  cookedQuantity: number | null; // null si Food no tiene cookingFactor
  homemadeMeasureText: string | null; // null si Food no tiene medida casera (nunca se inventa)
  computedKcal: number;
  computedCarbs: number;
  computedProtein: number;
  computedFat: number;
}

export interface MealConfig {
  patientId: string;
  unifyBreakfastSnack: boolean; // true = "Desayunos y meriendas" en una sola seccion
  unifyBreakfastSnackManualOverride: boolean | null; // null = usar comparacion automatica
  unifyLunchDinner: boolean;
  unifyLunchDinnerManualOverride: boolean | null;
  lunchHasCarbs: boolean; // default true
  dinnerHasCarbs: boolean; // default true - si es false, la seccion de hidratos de Cena se omite (nunca vacia)
}

export interface WeeklyMenuCell {
  day: number; // 1-5 o 1-7
  mealType: MealType;
  freeText: string; // V1: texto manual
  recipeId: string | null; // null en V1, se completa cuando exista la biblioteca
}

export interface WeeklyMenu {
  id: string;
  patientId: string;
  daysCount: 5 | 7;
  cells: WeeklyMenuCell[];
}

export type RecipeCategory =
  | "desayuno" | "merienda" | "almuerzo" | "cena_con_hidratos" | "cena_sin_hidratos" | "colacion" | "preparacion_base";

export interface Recipe {
  id: string;
  name: string;
  category: RecipeCategory;
  servings: number;
  prepTimeMin: number | null;
  instructions: string;
  tags: string[];
  notes: string;
  status: "activo" | "archivado";
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  foodId: string; // FK a Food - nunca texto libre
  rawQuantity: number;
  cookedQuantity: number | null;
  unit: string;
  notes?: string;
}

/** Snapshot final: congela todo lo que se muestra en el PDF para que planes ya
 * entregados no cambien si el catalogo se edita despues (alimento inactivo, etc). */
export interface PlanDocument {
  id: string;
  patientId: string;
  generatedAt: string; // ISO datetime
  patientSnapshot: Patient;
  mealOptionsSnapshot: MealOption[];
  mealConfigSnapshot: MealConfig;
  weeklyMenuSnapshot: WeeklyMenu | null;
  foodSnapshots: Record<string, Food>; // foodId -> copia congelada de los campos usados
  fileName: string; // Apellido_Nombre_AAAAMMDD.pdf
}

export type WarningSeverity = "bloqueante" | "advertencia" | "info";

export interface ImportWarning {
  id: string;
  importId: string;
  severity: WarningSeverity;
  sheet: string;
  cellRef?: string;
  message: string;
  resolved: boolean;
}

export interface PlanDraft {
  importId: string;
  patient: Partial<Patient>;
  mealOptions: MealOption[];
  foods: Food[];
  warnings: ImportWarning[];
}
