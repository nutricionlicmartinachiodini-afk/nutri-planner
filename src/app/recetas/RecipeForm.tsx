"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORY_LABELS: Record<string, string> = {
  desayuno: "Desayuno",
  merienda: "Merienda",
  almuerzo: "Almuerzo",
  cena_con_hidratos: "Cena (con hidratos)",
  cena_sin_hidratos: "Cena (sin hidratos)",
  colacion: "Colación",
  preparacion_base: "Preparación base (salsas, aderezos, etc.)",
};
const CATEGORY_ORDER = [
  "desayuno", "merienda", "almuerzo", "cena_con_hidratos", "cena_sin_hidratos", "colacion", "preparacion_base",
];

interface FoodOption {
  id: string;
  name: string;
  baseUnit: string;
}

interface IngredientRow {
  key: string;
  foodId: string;
  rawQuantity: string;
  unit: string;
  cookedQuantity: string;
  notes: string;
}

function emptyIngredient(): IngredientRow {
  return { key: crypto.randomUUID(), foodId: "", rawQuantity: "", unit: "", cookedQuantity: "", notes: "" };
}

export function RecipeForm({ recipeId }: { recipeId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(recipeId);

  const [foods, setFoods] = useState<FoodOption[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("almuerzo");
  const [servings, setServings] = useState("1");
  const [prepTimeMin, setPrepTimeMin] = useState("");
  const [instructions, setInstructions] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"activo" | "archivado">("activo");
  const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyIngredient()]);

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/foods")
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Error desconocido.");
        setFoods(d.foods);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    if (!recipeId) return;
    let cancelled = false;
    fetch(`/api/recipes/${recipeId}`)
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Error desconocido.");
        if (cancelled) return;
        setName(d.name);
        setCategory(d.category);
        setServings(String(d.servings));
        setPrepTimeMin(d.prepTimeMin != null ? String(d.prepTimeMin) : "");
        setInstructions(d.instructions);
        setTagsText((d.tags ?? []).join(", "));
        setNotes(d.notes);
        setStatus(d.status);
        setIngredients(
          d.ingredients.length > 0
            ? d.ingredients.map((ing: { foodId: string; rawQuantity: number; unit: string; cookedQuantity: number | null; notes: string | null }) => ({
                key: crypto.randomUUID(),
                foodId: ing.foodId,
                rawQuantity: String(ing.rawQuantity),
                unit: ing.unit,
                cookedQuantity: ing.cookedQuantity != null ? String(ing.cookedQuantity) : "",
                notes: ing.notes ?? "",
              }))
            : [emptyIngredient()]
        );
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  function updateIngredient(key: string, patch: Partial<IngredientRow>) {
    setIngredients((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeIngredient(key: string) {
    setIngredients((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }
  function addIngredient() {
    setIngredients((rows) => [...rows, emptyIngredient()]);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const fields = {
        name: name.trim(),
        category,
        servings: Number(servings) || 1,
        prepTimeMin: prepTimeMin.trim() ? Number(prepTimeMin) : null,
        instructions,
        tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
        notes,
        status,
      };
      const ingredientsPayload = ingredients
        .filter((r) => r.foodId && r.rawQuantity.trim())
        .map((r) => ({
          foodId: r.foodId,
          rawQuantity: Number(r.rawQuantity),
          unit: r.unit,
          cookedQuantity: r.cookedQuantity.trim() ? Number(r.cookedQuantity) : null,
          notes: r.notes.trim() || null,
        }));

      const url = isEdit ? `/api/recipes/${recipeId}` : "/api/recipes";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, ingredients: ingredientsPayload }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Error desconocido al guardar.");
      router.push("/recetas");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!recipeId) return;
    if (!confirm(`¿Borrar la receta "${name}"? Si está usada en algún menú semanal, esos días van a quedar sin receta asignada.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Error desconocido al borrar.");
      router.push("/recetas");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  if (loading) return <p>Cargando...</p>;
  if (loadError) {
    return (
      <div className="card">
        <p style={{ color: "var(--error)" }}>No se pudo cargar: {loadError}</p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="field">
          <label>Nombre de la receta</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pollo a la plancha con vegetales salteados" />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Categoría</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Porciones</label>
            <input type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} />
          </div>
          <div className="field">
            <label>Tiempo de preparación (min, opcional)</label>
            <input type="number" min={0} value={prepTimeMin} onChange={(e) => setPrepTimeMin(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as "activo" | "archivado")}>
            <option value="activo">Activo (aparece para elegir en el menú semanal)</option>
            <option value="archivado">Archivado (se guarda pero no aparece para elegir)</option>
          </select>
        </div>
      </div>

      <div className="card">
        <h3>Instrucciones</h3>
        <textarea rows={6} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Pasos para preparar la receta..." />
      </div>

      <div className="card">
        <h3>Ingredientes</h3>
        <p style={{ fontSize: 13, color: "#555" }}>
          Cantidades de referencia para vos, para saber qué cocinar. No son las cantidades exactas
          de cada paciente: esas siguen saliendo del cálculo de Almuerzo/Cena del Excel de cada uno.
        </p>
        {ingredients.map((row) => (
          <div key={row.key} className="field-row" style={{ alignItems: "flex-end", marginBottom: 8 }}>
            <div className="field" style={{ flex: 2 }}>
              <label>Alimento</label>
              <select value={row.foodId} onChange={(e) => updateIngredient(row.key, { foodId: e.target.value })}>
                <option value="">— elegir —</option>
                {foods.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Cantidad</label>
              <input type="number" value={row.rawQuantity} onChange={(e) => updateIngredient(row.key, { rawQuantity: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Unidad</label>
              <input type="text" value={row.unit} onChange={(e) => updateIngredient(row.key, { unit: e.target.value })} placeholder="gr, unidad..." />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Cant. cocida (opcional)</label>
              <input type="number" value={row.cookedQuantity} onChange={(e) => updateIngredient(row.key, { cookedQuantity: e.target.value })} />
            </div>
            <button className="secondary" onClick={() => removeIngredient(row.key)} type="button">Quitar</button>
          </div>
        ))}
        <button className="secondary" onClick={addIngredient} type="button">+ Agregar ingrediente</button>
      </div>

      <div className="card">
        <h3>Notas (opcional)</h3>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tips, variantes, alergenos..." />
      </div>

      <div className="card">
        <button className="primary" disabled={saving || !name.trim()} onClick={handleSave}>
          {saving ? "Guardando..." : "Guardar receta"}
        </button>
        {isEdit && (
          <button className="secondary" disabled={deleting} onClick={handleDelete} style={{ marginLeft: 8 }}>
            {deleting ? "Borrando..." : "Borrar receta"}
          </button>
        )}
        {saveError && <p style={{ color: "var(--error)", fontSize: 13, marginTop: 8 }}>{saveError}</p>}
      </div>
    </>
  );
}
