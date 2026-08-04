"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface MealConfigResolved {
  unifyBreakfastSnackAuto: boolean;
  unifyBreakfastSnackManualOverride: boolean | null;
  unifyBreakfastSnack: boolean;
  unifyLunchDinnerAuto: boolean;
  unifyLunchDinnerManualOverride: boolean | null;
  unifyLunchDinner: boolean;
  lunchHasCarbsAuto: boolean;
  lunchHasCarbs: boolean;
  dinnerHasCarbsAuto: boolean;
  dinnerHasCarbs: boolean;
}

type TriState = "auto" | "true" | "false";
function toTriState(v: boolean | null): TriState {
  return v === null ? "auto" : v ? "true" : "false";
}
function fromTriState(v: TriState): boolean | null {
  return v === "auto" ? null : v === "true";
}

export default function ConfiguracionComidasPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [data, setData] = useState<MealConfigResolved | null>(null);
  const [breakfastOverride, setBreakfastOverride] = useState<TriState>("auto");
  const [lunchDinnerOverride, setLunchDinnerOverride] = useState<TriState>("auto");
  const [lunchHasCarbs, setLunchHasCarbs] = useState(true);
  const [dinnerHasCarbs, setDinnerHasCarbs] = useState(true);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/patients/${id}/meal-config`)
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Error desconocido.");
        if (!cancelled) {
          setData(d);
          setBreakfastOverride(toTriState(d.unifyBreakfastSnackManualOverride));
          setLunchDinnerOverride(toTriState(d.unifyLunchDinnerManualOverride));
          setLunchHasCarbs(d.lunchHasCarbs);
          setDinnerHasCarbs(d.dinnerHasCarbs);
        }
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/patients/${id}/meal-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unifyBreakfastSnackManualOverride: fromTriState(breakfastOverride),
          unifyLunchDinnerManualOverride: fromTriState(lunchDinnerOverride),
          lunchHasCarbs,
          dinnerHasCarbs,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Error desconocido al guardar.");
      setData(d);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container">
      <h1>Configuración de comidas</h1>
      <p>
        <Link href={`/pacientes/${id}`}>&larr; Volver a la ficha del paciente</Link>
      </p>

      {loading && <p>Cargando...</p>}
      {loadError && (
        <div className="card">
          <p style={{ color: "var(--error)" }}>No se pudo cargar: {loadError}</p>
        </div>
      )}

      {data && (
        <>
          <div className="card">
            <h3>Desayuno y Merienda</h3>
            <p style={{ fontSize: 13, color: "#555" }}>
              Detección automática (comparando los alimentos de cada opción): en este
              paciente {data.unifyBreakfastSnackAuto ? "son iguales, así que se unificarían en una sola sección." : "son distintos, así que se mostrarían por separado."}
            </p>
            <div className="field" style={{ maxWidth: 320 }}>
              <label>Mostrar como</label>
              <select value={breakfastOverride} onChange={(e) => { setBreakfastOverride(e.target.value as TriState); setSaved(false); }}>
                <option value="auto">Automático (detectado: {data.unifyBreakfastSnackAuto ? "unificado" : "separado"})</option>
                <option value="true">Forzar: unificado (una sola sección)</option>
                <option value="false">Forzar: separado (Desayuno y Merienda aparte)</option>
              </select>
            </div>
          </div>

          <div className="card">
            <h3>Almuerzo y Cena</h3>
            <p style={{ fontSize: 13, color: "#555" }}>
              Detección automática (comparando los alimentos de cada categoría): en este
              paciente {data.unifyLunchDinnerAuto ? "son iguales, así que se unificarían en una sola sección." : "son distintos, así que se mostrarían por separado."}
            </p>
            <div className="field" style={{ maxWidth: 320 }}>
              <label>Mostrar como</label>
              <select value={lunchDinnerOverride} onChange={(e) => { setLunchDinnerOverride(e.target.value as TriState); setSaved(false); }}>
                <option value="auto">Automático (detectado: {data.unifyLunchDinnerAuto ? "unificado" : "separado"})</option>
                <option value="true">Forzar: unificado (una sola sección)</option>
                <option value="false">Forzar: separado (Almuerzo y Cena aparte)</option>
              </select>
            </div>
          </div>

          <div className="card">
            <h3>Hidratos de carbono</h3>
            <p style={{ fontSize: 13, color: "#555" }}>
              Si se desactiva, la sección de hidratos de esa comida se omite en el plan
              (nunca se muestra vacía). Detectado a partir del Excel importado, editable acá.
            </p>
            <div className="field-row">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={lunchHasCarbs} onChange={(e) => { setLunchHasCarbs(e.target.checked); setSaved(false); }} />
                Almuerzo con hidratos
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={dinnerHasCarbs} onChange={(e) => { setDinnerHasCarbs(e.target.checked); setSaved(false); }} />
                Cena con hidratos
              </label>
            </div>
          </div>

          <div className="card">
            <button className="primary" disabled={saving} onClick={handleSave}>
              {saving ? "Guardando..." : "Guardar configuración"}
            </button>
            {saved && <p style={{ color: "var(--brand-dark)", fontSize: 13 }}>Guardado.</p>}
            {saveError && <p style={{ color: "var(--error)", fontSize: 13 }}>{saveError}</p>}
          </div>

          <div className="card">
            <Link href={`/pacientes/${id}/menu-semanal`}>
              <button className="secondary">Ir al menú semanal &rarr;</button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
