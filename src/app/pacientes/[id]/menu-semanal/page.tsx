"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const MEAL_TYPES: { key: string; label: string }[] = [
  { key: "desayuno", label: "Desayuno" },
  { key: "merienda", label: "Merienda" },
  { key: "almuerzo", label: "Almuerzo" },
  { key: "cena", label: "Cena" },
];

type Grid = Record<string, Record<number, string>>; // mealType -> day -> texto

export default function MenuSemanalPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [daysCount, setDaysCount] = useState<5 | 7>(5);
  const [grid, setGrid] = useState<Grid>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/patients/${id}/weekly-menu`)
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Error desconocido.");
        if (!cancelled) {
          setDaysCount(d.daysCount);
          const g: Grid = {};
          for (const mt of MEAL_TYPES) g[mt.key] = {};
          for (const cell of d.cells as { day: number; mealType: string; freeText: string }[]) {
            if (!g[cell.mealType]) g[cell.mealType] = {};
            g[cell.mealType]![cell.day] = cell.freeText;
          }
          setGrid(g);
        }
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  function updateCell(mealType: string, day: number, value: string) {
    setGrid((g) => ({ ...g, [mealType]: { ...(g[mealType] ?? {}), [day]: value } }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const cells: { day: number; mealType: string; freeText: string }[] = [];
      for (const mt of MEAL_TYPES) {
        for (let day = 1; day <= daysCount; day++) {
          const freeText = grid[mt.key]?.[day] ?? "";
          if (freeText.trim()) cells.push({ day, mealType: mt.key, freeText });
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

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      <h1>Menú semanal</h1>
      <p>
        <Link href={`/pacientes/${id}`}>&larr; Volver a la ficha del paciente</Link>
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
                    <td style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>{mt.label}</td>
                    {days.map((d) => (
                      <td key={d} style={{ minWidth: 160 }}>
                        <input
                          style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13 }}
                          value={grid[mt.key]?.[d] ?? ""}
                          onChange={(e) => updateCell(mt.key, d, e.target.value)}
                          placeholder="Texto libre"
                        />
                      </td>
                    ))}
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
