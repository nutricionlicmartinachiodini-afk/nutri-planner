import * as fs from "fs";
import * as path from "path";
import { importExcelFile } from "../src/excel-adapter/importExcel";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Uso: ts-node scripts/test-import.ts <ruta al .xlsx>");
  process.exit(1);
}

const buffer = fs.readFileSync(path.resolve(filePath));
const draft = importExcelFile(buffer);

console.log("=== PACIENTE (parcial, lo que vino del Excel) ===");
console.log(JSON.stringify(draft.patient, null, 1));

console.log(`\n=== ALIMENTOS EN CATALOGO: ${draft.foods.length} ===`);
for (const f of draft.foods.slice(0, 5)) {
  console.log(`- ${f.id} | ${f.name} | estado=${f.dataStatus} | kcal/u=${f.kcalPerUnit} | factorCoccion=${f.cookingFactor}`);
}
console.log(`  ... (${draft.foods.length} total)`);

console.log(`\n=== OPCIONES DE COMIDA IMPORTADAS: ${draft.mealOptions.length} ===`);
const byMeal: Record<string, number> = {};
for (const o of draft.mealOptions) byMeal[o.mealType] = (byMeal[o.mealType] ?? 0) + 1;
console.log(byMeal);

const noMatch = draft.mealOptions.filter((o) => o.foodId.startsWith("__no_match__"));
console.log(`\n=== OPCIONES SIN MATCH DE ALIMENTO: ${noMatch.length} ===`);

console.log(`\n=== ADVERTENCIAS: ${draft.warnings.length} ===`);
const bySeverity: Record<string, number> = {};
for (const w of draft.warnings) bySeverity[w.severity] = (bySeverity[w.severity] ?? 0) + 1;
console.log("por severidad:", bySeverity);
for (const w of draft.warnings) {
  console.log(`[${w.severity.toUpperCase()}] (${w.sheet}${w.cellRef ? " " + w.cellRef : ""}) ${w.message}`);
}
