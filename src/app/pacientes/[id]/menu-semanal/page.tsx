"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// Cena se separa en dos filas (con hidratos / sin hidratos), no una sola con
// desplegable agrupado: es como Martina arma sus menus en la practica (una
// fila entera de opciones para dias de entrenamiento, otra para dias sin
// entrenamiento), asi que el paciente/Martina elige la fila segun corresponda
// ese dia en vez de tener que saber de antemano cual va a ser.
const MEAL_TYPES: { key: string; label: string; kind: "opciones" | "recetas"; recipeCategory?: string }[] = [
  { key: "desayuno", label: "Desayuno", kind: "opciones" },
  { key: "merienda", label: "Merienda", kind: "opciones" },
  { key: "almuerzo", label: "Almuerzo", kind: "recetas", recipeCategory: "almuerzo" },
  { key: "cena_con_hidratos", label: "Cena (con hidratos)", kind: "recetas", recipeCategory: "cena_con_hidratos" },
  { key: "cena_sin_hidratos", label: "Cena (sin hidratos)", kind: "recetas", recipeCategory: "cena_sin_hidratos" },
];

interface MealOptionItem {
  foodName: string;
  quantity: number;
  unit: string;
}

interface MealOptionNameEntry {
  optionNumber: number;
  autoName: string;
  manualName: string | null;
  resolvedName: string;
  items: MealOptionItem[];
}

interface MealOptionNamesResponse {
  desayuno: MealOptionNameEntry[];
  merienda: MealOptionNameEntry[];
}

interface RecipeSummary {
  id: string;
  name: string;
  category: string;
  status: string;
  servings: number;
  prepTimeMin: number | null;
}

interface RecipeIngredientRow {
  foodId: string;
  foodName: string;
  rawQuantity: number;
  unit: string;
  cookedQuantity: number | null;
}

interface RecipeFull extends RecipeSummary {
  instructions: string;
  ingredients: RecipeIngredientRow[];
}

interface CellState {
  freeText: string;
  selectedOptionNumber: number | null;
  recipeId: string | null;
}

type Grid = Record<string, Record<number, CellState>>;

function emptyCell(): CellState {
  return { freeText: "", selectedOptionNumber: null, recipeId: null };
}

export default function MenuSemanalPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [daysCount, setDaysCount] = useState<5 | 7>(5);
  const [grid, setGrid] = useState<Grid>({});
  const [names, setNames] = useState<MealOptionNamesResponse | null>(null);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [recipeDetails, setRecipeDetails] = useState<Record<string, RecipeFull>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/patients/${id}/weekly-menu`).then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Error desconocido al leer el menu semanal.");
        return d;
      }),
      fetch(`/api/patients/${id}/meal-option-names`).then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Error desconocido al leer los nombres de las preparaciones.");
        return d as MealOptionNamesResponse;
      }),
      fetch(`/api/recipes?status=activo`).then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Error desconocido al leer las recetas.");
        return d.recipes as RecipeSummary[];
      }),
    ])
      .then(([menuData, namesData, recipesData]) => {
        if (cancelled) return;
        setNames(namesData);
        setRecipes(recipesData);
        setDaysCount(menuData.daysCount);
        const g: Grid = {};
        for (const mt of MEAL_TYPES) g[mt.key] = {};
        for (const cell of menuData.cells as {
          day: number;
          mealType: string;
          freeText: string;
          selectedOptionNumber: number | null;
          recipeId: string | null;
        }[]) {
          if (!g[cell.mealType]) g[cell.mealType] = {};
          g[cell.mealType]![cell.day] = {
            freeText: cell.freeText ?? "",
            selectedOptionNumber: cell.selectedOptionNumber ?? null,
            recipeId: cell.recipeId ?? null,
          };
        }
        setGrid(g);

        // Precargar el detalle (ingredientes) de las recetas que ya venian
        // elegidas de una carga anterior - si no, la celda queda mostrando
        // "Cargando detalle..." para siempre porque el fetch solo se
        // disparaba al cambiar la seleccion, nunca al cargar la pagina.
        const preselectedRecipeIds = new Set<string>();
        for (const cell of menuData.cells as { recipeId: string | null }[]) {
          if (cell.recipeId) preselectedRecipeIds.add(cell.recipeId);
        }
        preselectedRecipeIds.forEach((rid) => {
          ensureRecipeDetail(rid);
        });
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  function updateCell(mealType: string, day: number, patch: Partial<CellState>) {
    setGrid((g) => {
      const current = g[mealType]?.[day] ?? emptyCell();
      return { ...g, [mealType]: { ...(g[mealType] ?? {}), [day]: { ...current, ...patch } } };
    });
    setSaved(false);
  }

  async function ensureRecipeDetail(recipeId: string) {
    if (recipeDetails[recipeId]) return;
    try {
      const res = await fetch(`/api/recipes/${recipeId}`);
      const d = await res.json();
      if (res.ok) setRecipeDetails((prev) => ({ ...prev, [recipeId]: d }));
    } catch {
      // si falla, simplemente no mostramos el desglose - no es bloqueante
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const cells: {
        day: number;
        mealType: string;
        freeText: string;
        selectedOptionNumber: number | null;
        recipeId: string | null;
      }[] = [];
      for (const mt of MEAL_TYPES) {
        for (let day = 1; day <= daysCount; day++) {
          const cell = grid[mt.key]?.[day];
          if (!cell) continue;
          if (!cell.freeText.trim() && cell.selectedOptionNumber === null && cell.recipeId === null) continue;
          cells.push({
            day,
            mealType: mt.key,
            freeText: cell.freeText,
            selectedOptionNumber: cell.selectedOptionNumber,
            recipeId: cell.recipeId,
          });
        }
      }
      const res = await fetch(`/api/patients/${id}/weekly-menu`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysCount, cells }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Error desconocido al guardar.");
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const days = Array.from({ length: daysCount }, (_, i) => i + 1);

  function optionsFor(mealType: string): MealOptionNameEntry[] {
    if (!names) return [];
    if (mealType === "desayuno") return names.desayuno;
    if (mealType === "merienda") return names.merienda;
    return [];
  }

  function recipesFor(recipeCategory: string): RecipeSummary[] {
    return recipes.filter((r) => r.category === recipeCategory);
  }

  return (
    <div className="container" style={{ maxWidth: 1200 }}>
      <h1>Menú semanal</h1>
      <p>
        <Link href={`/pacientes/${id}`}>&larr; Volver a la ficha del paciente</Link>
        {" · "}
        <Link href="/recetas">Administrar recetas</Link>
      </p>

      {loading && <p>Cargando...</p>}
      {loadError && (
        <div className="card">
          <p style={{ color: "var(--error)" }}>No se pudo cargar: {loadError}</p>
        </div>
      )}

      {!loading && !loadError && (
        <>
          <div className="card">
            <div className="field" style={{ maxWidth: 220 }}>
              <label>Cantidad de días</label>
              <select
                value={daysCount}
                onChange={(e) => {
                  setDaysCount(Number(e.target.value) as 5 | 7);
                  setSaved(false);
                }}
              >
                <option value={5}>5 días</option>
                <option value={7}>7 días</option>
              </select>
            </div>
            <p style={{ fontSize: 13, color: "#555", margin: "8px 0 0" }}>
              Desayuno y Merienda: elegís la opción importada del Excel para cada día (nombre editable
              desde Configuración de comidas). Almuerzo y Cena: elegís una receta de la biblioteca -
              las cantidades reales de este paciente siguen siendo las del Excel, la receta es la idea
              de preparación. En Cena separamos las recetas con y sin hidratos.
            </p>
          </div>

          <div className="card" style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Comida</th>
                  {days.map((d) => (
                    <th key={d}>Día {d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_TYPES.map((mt) => (
                  <tr key={mt.key}>
                    <td style={{ fontWeight: "bold", whiteSpace: "nowrap", verticalAlign: "top" }}>{mt.label}</td>
                    {days.map((d) => {
                      const cell = grid[mt.key]?.[d] ?? emptyCell();

                      if (mt.kind === "opciones") {
                        const options = optionsFor(mt.key);
                        const selected = options.find((o) => o.optionNumber === cell.selectedOptionNumber);
                        return (
                          <td key={d} style={{ minWidth: 200, verticalAlign: "top" }}>
                            <select
                              style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13 }}
                              value={cell.selectedOptionNumber ?? ""}
                              onChange={(e) =>
                                updateCell(mt.key, d, {
                                  selectedOptionNumber: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                            >
                              <option value="">— sin elegir —</option>
                              {options.map((o) => (
                                <option key={o.optionNumber} value={o.optionNumber}>
                                  {o.resolvedName}
                                </option>
                              ))}
                            </select>
                            {selected && (
                              <p style={{ fontSize: 11, color: "#777", margin: "4px 0 0" }}>
                                {selected.items.map((it) => `${it.foodName} ${it.quantity} ${it.unit}`).join(" · ")}
                              </p>
                            )}
                          </td>
                        );
                      }

                      const optionsList = recipesFor(mt.recipeCategory ?? "");
                      const detail = cell.recipeId ? recipeDetails[cell.recipeId] : null;
                      return (
                        <td key={d} style={{ minWidth: 220, verticalAlign: "top" }}>
                          <select
                            style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13 }}
                            value={cell.recipeId ?? ""}
                            onChange={(e) => {
                              const value = e.target.value || null;
                              updateCell(mt.key, d, { recipeId: value });
                              if (value) ensureRecipeDetail(value);
                            }}
                          >
                            <option value="">— sin elegir —</option>
                            {optionsList.map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          {cell.recipeId && !detail && (
                            <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>Cargando detalle...</p>
                          )}
                          {detail && (
                            <p style={{ fontSize: 11, color: "#777", margin: "4px 0 0" }}>
                              {detail.prepTimeMin != null ? `${detail.prepTimeMin} min · ` : ""}
                              {detail.ingredients.map((it) => `${it.foodName} ${it.rawQuantity} ${it.unit}`).join(" · ")}
                            </p>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <button className="primary" disabled={saving} onClick={handleSave}>
              {saving ? "Guardando..." : "Guardar menú semanal"}
            </button>
            {saved && <p style={{ color: "var(--brand-dark)", fontSize: 13 }}>Guardado.</p>}
            {saveError && <p style={{ color: "var(--error)", fontSize: 13 }}>{saveError}</p>}
          </div>

          <div className="card">
            <Link href={`/pacientes/${id}/vista-previa`}>
              <button className="secondary">Ver vista previa del plan &rarr;</button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
