import Link from "next/link";
import {
  getPatientFull,
  getMealConfigOverride,
  getMealOptionLabels,
  getWeeklyMenu,
  getRecipe,
  getMealCategoryFoods,
  RecipeFull,
} from "@/lib/repository";
import { resolveMealConfig } from "@/lib/mealConfigLogic";
import { groupMealOptionsByOptionNumber } from "@/lib/mealOptionNaming";
import { MealCategory } from "@/domain/types";
import { MarkdownLite } from "./MarkdownLite";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<MealCategory, string> = {
  hidratos: "Hidratos de carbono",
  proteinas: "Proteínas",
  grasas: "Grasas",
  vegetales: "Vegetales",
};
const CATEGORY_ORDER: MealCategory[] = ["hidratos", "proteinas", "grasas", "vegetales"];
const MEAL_CATEGORY_ROLE_LABELS: Record<string, string> = {
  hidratos: "Hidratos",
  proteinas: "Proteínas",
  grasas: "Grasas",
  vegetales: "Vegetales",
};

const DAY_LABELS7 = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function fmtFecha(iso: string | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const mi = Number(m) - 1;
  if (!y || mi < 0 || mi > 11) return iso;
  return `${Number(d)} de ${meses[mi]} de ${y}`;
}

interface CategoryFoodItem {
  foodName: string;
  quantity: number;
  unit: string;
}

function CategoryTable({
  categoryFoods,
  omitHidratos,
}: {
  categoryFoods: Record<string, CategoryFoodItem[]>;
  omitHidratos: boolean;
}) {
  const cats = CATEGORY_ORDER.filter((c) => !(c === "hidratos" && omitHidratos) && categoryFoods[c]?.length);
  if (cats.length === 0) return <p className="muted">Sin datos cargados para esta comida.</p>;
  return (
    <table className="ac">
      <tbody>
        {cats.map((cat) => (
          <tr key={cat}>
            <td className="cat">{CATEGORY_LABELS[cat]}</td>
            <td className="cnt">
              {categoryFoods[cat]!.map((it, i) => (
                <div key={i}>
                  {it.foodName} — {it.quantity} {it.unit}
                </div>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function resolveRecipeIngredientLines(
  recipe: RecipeFull,
  patientCategoryFoods: Record<string, CategoryFoodItem[]> | undefined
): string[] {
  const lines: string[] = [];
  for (const ing of recipe.ingredients) {
    if (ing.mealCategoryRole) {
      const label = MEAL_CATEGORY_ROLE_LABELS[ing.mealCategoryRole] ?? ing.mealCategoryRole;
      const items = patientCategoryFoods?.[ing.mealCategoryRole];
      if (items && items.length > 0) {
        lines.push(`${label}: ${items.map((it) => `${it.foodName} ${it.quantity} ${it.unit}`).join(" + ")}`);
      } else {
        lines.push(`${label}: (sin datos en el plan de este paciente)`);
      }
    } else if (ing.foodName) {
      lines.push(`${ing.foodName} ${ing.rawQuantity ?? ""} ${ing.unit ?? ""}`.trim());
    }
  }
  return lines;
}

export default async function VistaPreviaPage({ params }: { params: { id: string } }) {
  const full = await getPatientFull(params.id);
  if (!full) {
    return (
      <div className="container">
        <h1>Vista previa</h1>
        <p style={{ color: "var(--error)" }}>Paciente no encontrado.</p>
      </div>
    );
  }
  const { patient, mealOptions } = full;

  const [override, labels, categoryFoods, weeklyMenu] = await Promise.all([
    getMealConfigOverride(params.id),
    getMealOptionLabels(params.id),
    getMealCategoryFoods(params.id),
    getWeeklyMenu(params.id),
  ]);
  const resolved = resolveMealConfig(mealOptions, override);
  const labelByKey = new Map(labels.map((l) => [`${l.mealType}_${l.optionNumber}`, l.name]));

  const desayunoGroups = groupMealOptionsByOptionNumber(mealOptions, "desayuno").map((g) => ({
    ...g,
    name: labelByKey.get(`desayuno_${g.optionNumber}`) ?? g.autoName,
  }));
  const meriendaGroups = groupMealOptionsByOptionNumber(mealOptions, "merienda").map((g) => ({
    ...g,
    name: labelByKey.get(`merienda_${g.optionNumber}`) ?? g.autoName,
  }));

  // Recetas usadas en el menu semanal (si Martina cargo alguna)
  const recipeIds = Array.from(new Set(weeklyMenu.cells.map((c) => c.recipeId).filter((x): x is string => Boolean(x))));
  const recipeById = new Map<string, RecipeFull>();
  await Promise.all(
    recipeIds.map(async (rid) => {
      const r = await getRecipe(rid);
      if (r) recipeById.set(rid, r);
    })
  );
  const hasWeeklyMenu = weeklyMenu.cells.length > 0;
  const days = Array.from({ length: weeklyMenu.daysCount }, (_, i) => i + 1);
  const desayunoOptByNumber = new Map(desayunoGroups.map((g) => [g.optionNumber, g]));
  const meriendaOptByNumber = new Map(meriendaGroups.map((g) => [g.optionNumber, g]));

  return (
    <div className="plan-doc">
      <style>{`
        @page { size: A4; margin: 18mm 18mm 22mm 18mm; }
        .plan-doc { font-family: Arial, "Liberation Sans", sans-serif; color: #222; background: #F7FAF2; }
        .plan-doc .toolbar { padding: 16px; background: #fff; border-bottom: 1px solid #ddd; display: flex; gap: 12px; align-items: center; }
        .plan-doc .page { background: #fff; max-width: 800px; margin: 24px auto; padding: 28px 32px; box-shadow: 0 0 8px rgba(0,0,0,0.08); }
        .plan-doc .cover { padding: 0; overflow: hidden; page-break-after: always; }
        .plan-doc .cover img { width: 100%; display: block; }
        .plan-doc h1 { color: #3D5A2E; font-size: 22px; margin: 0 0 4px; }
        .plan-doc h2.sec { background: #3D5A2E; color: #fff; padding: 8px 14px; border-radius: 4px; font-size: 15px; margin: 24px 0 12px; }
        .plan-doc h3 { color: #3D5A2E; font-size: 16px; margin: 16px 0 6px; }
        .plan-doc h4 { color: #5A7A42; font-size: 14px; margin: 12px 0 4px; }
        .plan-doc .datos-table td { padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 14px; }
        .plan-doc .datos-table td:first-child { color: #5A7A42; font-weight: bold; width: 180px; }
        .plan-doc .meal { border-left: 4px solid #5A7A42; background: #F7FAF2; padding: 8px 12px; margin-bottom: 10px; border-radius: 0 4px 4px 0; page-break-inside: avoid; }
        .plan-doc .meal .opt-name { font-weight: bold; color: #3D5A2E; margin-bottom: 4px; }
        .plan-doc .meal .opt-items { font-size: 13px; color: #444; }
        .plan-doc table.ac { width: 100%; border-collapse: collapse; margin-bottom: 12px; page-break-inside: avoid; }
        .plan-doc table.ac td { border: 1px solid #D5E8B5; padding: 8px 10px; font-size: 13px; vertical-align: top; }
        .plan-doc table.ac td.cat { background: #D5E8B5; color: #3D5A2E; font-weight: bold; width: 140px; }
        .plan-doc .obj-list { margin: 4px 0 10px 20px; }
        .plan-doc .muted { color: #888; font-size: 13px; }
        .plan-doc .week-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .plan-doc .week-table th, .plan-doc .week-table td { border: 1px solid #D5E8B5; padding: 6px 8px; vertical-align: top; }
        .plan-doc .week-table th { background: #D5E8B5; color: #3D5A2E; }
        .plan-doc .pb { page-break-before: always; }
        @media print {
          .plan-doc { background: #fff; }
          .plan-doc .toolbar { display: none; }
          .plan-doc .page { box-shadow: none; margin: 0; max-width: none; }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="toolbar no-print">
        <Link href={`/pacientes/${params.id}`}>&larr; Volver a la ficha</Link>
        <PrintButton />
      </div>

      {/* Portada */}
      <div className="page cover">
        <img src="/portada.png" alt="Portada" />
      </div>

      {/* Datos del paciente */}
      <div className="page">
        <h1>Plan nutricional</h1>
        <p className="muted">
          {patient.firstName} {patient.lastName} · {fmtFecha(patient.consultDate)}
        </p>
        <table className="datos-table">
          <tbody>
            <tr><td>Nombre y apellido</td><td>{patient.firstName} {patient.lastName}</td></tr>
            <tr><td>Fecha de consulta</td><td>{fmtFecha(patient.consultDate)}</td></tr>
            <tr><td>Sexo</td><td>{patient.sex}</td></tr>
            <tr><td>Talla</td><td>{patient.height} cm</td></tr>
            <tr><td>Peso</td><td>{patient.weight} kg</td></tr>
            <tr><td>Nivel de actividad</td><td>{patient.activityLevel}</td></tr>
            <tr><td>Objetivo</td><td>{patient.goal}</td></tr>
          </tbody>
        </table>
      </div>

      {/* Objetivos */}
      {patient.objectivesText && (
        <div className="page pb">
          <h2 className="sec">Objetivos del plan</h2>
          <MarkdownLite text={patient.objectivesText} />
        </div>
      )}

      {/* Indicaciones */}
      {patient.indicationsText && (
        <div className="page">
          <h2 className="sec">Indicaciones y observaciones</h2>
          <MarkdownLite text={patient.indicationsText} />
        </div>
      )}

      {/* Desayuno / Merienda */}
      <div className="page pb">
        {resolved.unifyBreakfastSnack ? (
          <>
            <h2 className="sec">Desayuno y Merienda</h2>
            {desayunoGroups.length === 0 && <p className="muted">Sin opciones cargadas.</p>}
            {desayunoGroups.map((g) => (
              <div className="meal" key={g.optionNumber}>
                <div className="opt-name">Opción {g.optionNumber}: {g.name}</div>
                <div className="opt-items">{g.items.map((it) => `${it.foodName} ${it.quantity} ${it.unit}`).join(" · ")}</div>
              </div>
            ))}
          </>
        ) : (
          <>
            <h2 className="sec">Desayuno</h2>
            {desayunoGroups.length === 0 && <p className="muted">Sin opciones cargadas.</p>}
            {desayunoGroups.map((g) => (
              <div className="meal" key={g.optionNumber}>
                <div className="opt-name">Opción {g.optionNumber}: {g.name}</div>
                <div className="opt-items">{g.items.map((it) => `${it.foodName} ${it.quantity} ${it.unit}`).join(" · ")}</div>
              </div>
            ))}
            <h2 className="sec">Merienda</h2>
            {meriendaGroups.length === 0 && <p className="muted">Sin opciones cargadas.</p>}
            {meriendaGroups.map((g) => (
              <div className="meal" key={g.optionNumber}>
                <div className="opt-name">Opción {g.optionNumber}: {g.name}</div>
                <div className="opt-items">{g.items.map((it) => `${it.foodName} ${it.quantity} ${it.unit}`).join(" · ")}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Almuerzo / Cena */}
      <div className="page pb">
        {resolved.unifyLunchDinner ? (
          <>
            <h2 className="sec">Almuerzo y Cena</h2>
            <p className="muted">Elegí una opción de cada categoría.</p>
            <CategoryTable categoryFoods={categoryFoods.almuerzo} omitHidratos={!resolved.lunchHasCarbs} />
          </>
        ) : (
          <>
            <h2 className="sec">Almuerzo</h2>
            <p className="muted">Elegí una opción de cada categoría.</p>
            <CategoryTable categoryFoods={categoryFoods.almuerzo} omitHidratos={!resolved.lunchHasCarbs} />
            <h2 className="sec">Cena</h2>
            <p className="muted">Elegí una opción de cada categoría.</p>
            <CategoryTable categoryFoods={categoryFoods.cena} omitHidratos={!resolved.dinnerHasCarbs} />
          </>
        )}
      </div>

      {/* Menu semanal (opcional, solo si Martina cargo algo) */}
      {hasWeeklyMenu && (
        <div className="page pb">
          <h2 className="sec">Menú semanal sugerido</h2>
          <table className="week-table">
            <thead>
              <tr>
                <th>Comida</th>
                {days.map((d) => (
                  <th key={d}>{DAY_LABELS7[d - 1] ?? `Día ${d}`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["desayuno", "merienda", "almuerzo", "cena_con_hidratos", "cena_sin_hidratos"] as const).map((mealKey) => {
                const rowCells = weeklyMenu.cells.filter((c) => c.mealType === mealKey);
                if (rowCells.length === 0) return null;
                const label =
                  mealKey === "desayuno" ? "Desayuno" :
                  mealKey === "merienda" ? "Merienda" :
                  mealKey === "almuerzo" ? "Almuerzo" :
                  mealKey === "cena_con_hidratos" ? "Cena (con hidratos)" : "Cena (sin hidratos)";
                const patientMealKey = mealKey.startsWith("cena") ? "cena" : mealKey;
                return (
                  <tr key={mealKey}>
                    <td style={{ fontWeight: "bold" }}>{label}</td>
                    {days.map((d) => {
                      const cell = rowCells.find((c) => c.day === d);
                      if (!cell) return <td key={d}></td>;
                      if (cell.selectedOptionNumber !== null) {
                        const opt = mealKey === "desayuno"
                          ? desayunoOptByNumber.get(cell.selectedOptionNumber)
                          : meriendaOptByNumber.get(cell.selectedOptionNumber);
                        return <td key={d}>{opt?.name ?? `Opción ${cell.selectedOptionNumber}`}</td>;
                      }
                      if (cell.recipeId) {
                        const recipe = recipeById.get(cell.recipeId);
                        if (!recipe) return <td key={d}></td>;
                        const lines = resolveRecipeIngredientLines(recipe, categoryFoods[patientMealKey as "almuerzo" | "cena"]);
                        return (
                          <td key={d}>
                            <div style={{ fontWeight: "bold" }}>{recipe.name}</div>
                            <div className="muted">{lines.join(" · ")}</div>
                          </td>
                        );
                      }
                      return <td key={d}>{cell.freeText}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
