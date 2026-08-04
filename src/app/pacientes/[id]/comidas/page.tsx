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

  const [names, setNames] = useState<MealOptionNamesResponse | null>(null);
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({}); // key `${mealType}_${optionNumber}` -> texto en el input
  const [namesLoading, setNamesLoading] = useState(true);
  const [namesLoadError, setNamesLoadError] = useState<string | null>(null);
  const [namesSaving, setNamesSaving] = useState(false);
  const [namesSaveError, setNamesSaveError] = useState<string | null>(null);
  const [namesSaved, setNamesSaved] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    setNamesLoading(true);
    fetch(`/api/patients/${id}/meal-option-names`)
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Error desconocido.");
        if (!cancelled) {
          setNames(d);
          const edits: Record<string, string> = {};
          for (const mt of ["desayuno", "merienda"] as const) {
            for (const entry of d[mt] as MealOptionNameEntry[]) {
              edits[`${mt}_${entry.optionNumber}`] = entry.manualName ?? entry.autoName;
            }
          }
          setNameEdits(edits);
        }
      })
      .catch((err) => !cancelled && setNamesLoadError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setNamesLoading(false));
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

  async function handleSaveNames() {
    if (!names) return;
    setNamesSaving(true);
    setNamesSaveError(null);
    try {
      const labels: { mealType: string; optionNumber: number; name: string }[] = [];
      for (const mt of ["desayuno", "merienda"] as const) {
        for (const entry of names[mt]) {
          const edited = (nameEdits[`${mt}_${entry.optionNumber}`] ?? "").trim();
          // Si lo que quedo escrito es exactamente el nombre automatico, no
          // hace falta guardar un override - se borra (mismo patron auto/manual
          // que el resto de la app).
          labels.push({ mealType: mt, optionNumber: entry.optionNumber, name: edited === entry.autoName ? "" : edited });
        }
      }
      const res = await fetch(`/api/patients/${id}/meal-option-names`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labels }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Error desconocido al guardar.");
      setNames(d);
      setNamesSaved(true);
    } catch (err) {
      setNamesSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setNamesSaving(false);
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
        </>
      )}

      {namesLoading && <p>Cargando nombres de las preparaciones...</p>}
      {namesLoadError && (
        <div className="card">
          <p style={{ color: "var(--error)" }}>No se pudieron cargar los nombres: {namesLoadError}</p>
        </div>
      )}

      {names && (
        <div className="card">
          <h3>Nombres de las preparaciones (Desayuno y Merienda)</h3>
          <p style={{ fontSize: 13, color: "#555" }}>
            Le ponemos un nombre a cada opción para que en el menú semanal, en vez de
            &quot;Opción 2&quot;, aparezca algo como &quot;Infusión con leche + tostada con queso y
            fruta&quot;. Por defecto usamos los nombres tal cual salen del Excel: cambialos por
            algo más natural si querés. Debajo de cada uno vas a ver el desglose de
            alimentos y cantidades, para que sepas exactamente qué estás nombrando.
          </p>

          {(["desayuno", "merienda"] as const).map((mt) => (
            <div key={mt} style={{ marginTop: 16 }}>
              <h4 style={{ textTransform: "capitalize", marginBottom: 8 }}>{mt}</h4>
              {names[mt].length === 0 && (
                <p style={{ fontSize: 13, color: "#777" }}>No hay opciones de {mt} importadas para este paciente.</p>
              )}
              {names[mt].map((entry) => {
                const key = `${mt}_${entry.optionNumber}`;
                return (
                  <div key={key} className="field" style={{ marginBottom: 12, maxWidth: 520 }}>
                    <label>Opción {entry.optionNumber}</label>
                    <input
                      type="text"
                      value={nameEdits[key] ?? entry.autoName}
                      onChange={(e) => {
                        setNameEdits((prev) => ({ ...prev, [key]: e.target.value }));
                        setNamesSaved(false);
                      }}
                    />
                    <p style={{ fontSize: 12, color: "#777", margin: "4px 0 0" }}>
                      {entry.items.map((it) => `${it.foodName} ${it.quantity} ${it.unit}`).join(" · ")}
                    </p>
                  </div>
                );
              })}
            </div>
          ))}

          <button className="primary" disabled={namesSaving} onClick={handleSaveNames} style={{ marginTop: 8 }}>
            {namesSaving ? "Guardando..." : "Guardar nombres"}
          </button>
          {namesSaved && <p style={{ color: "var(--brand-dark)", fontSize: 13 }}>Guardado.</p>}
          {namesSaveError && <p style={{ color: "var(--error)", fontSize: 13 }}>{namesSaveError}</p>}
        </div>
      )}

      {data && (
        <div className="card">
          <Link href={`/pacientes/${id}/menu-semanal`}>
            <button className="secondary">Ir al menú semanal &rarr;</button>
          </Link>
        </div>
      )}
    </div>
  );
}
