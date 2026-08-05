"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Goal, MealOption, Patient, Sex } from "@/domain/types";

const SEX_OPTIONS: Sex[] = ["Masculino", "Femenino"];
const GOAL_OPTIONS: Goal[] = ["Descenso de peso", "Ganancia de masa muscular", "Recomposición corporal"];

type FormState = {
  firstName: string;
  lastName: string;
  dni: string;
  birthDate: string;
  sex: Sex;
  consultDate: string;
  height: string;
  weight: string;
  activityLevel: string;
  activityFactor: string;
  goal: Goal;
  objectivesText: string;
  indicationsText: string;
};

function patientToForm(p: Patient): FormState {
  return {
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    dni: p.dni ?? "",
    birthDate: p.birthDate ?? "",
    sex: p.sex,
    consultDate: p.consultDate ?? "",
    height: String(p.height ?? ""),
    weight: String(p.weight ?? ""),
    activityLevel: p.activityLevel ?? "",
    activityFactor: String(p.activityFactor ?? ""),
    goal: p.goal,
    objectivesText: p.objectivesText ?? "",
    indicationsText: p.indicationsText ?? "",
  };
}

export default function FichaPacientePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [form, setForm] = useState<FormState | null>(null);
  const [mealOptions, setMealOptions] = useState<MealOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/patients/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error desconocido.");
        if (!cancelled) {
          setForm(patientToForm(data.patient));
          setMealOptions(data.mealOptions);
        }
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSaved(false);
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/patients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          dni: form.dni || undefined,
          birthDate: form.birthDate || undefined,
          sex: form.sex,
          consultDate: form.consultDate,
          height: Number(form.height),
          weight: Number(form.weight),
          activityLevel: form.activityLevel,
          activityFactor: Number(form.activityFactor),
          goal: form.goal,
          objectivesText: form.objectivesText,
          indicationsText: form.indicationsText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido al guardar.");
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const mealCounts = mealOptions.reduce<Record<string, number>>((acc, o) => {
    acc[o.mealType] = (acc[o.mealType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="container">
      <h1>Ficha del paciente</h1>

      {!loading && !loadError && (
        <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={`/pacientes/${id}/comidas`}>
            <button className="secondary">Configurar comidas &rarr;</button>
          </Link>
          <Link href={`/pacientes/${id}/menu-semanal`}>
            <button className="secondary">Menu semanal &rarr;</button>
          </Link>
          <Link href={`/pacientes/${id}/vista-previa`}>
            <button className="primary">Vista previa / Exportar PDF &rarr;</button>
          </Link>
        </p>
      )}

      {loading && <p>Cargando...</p>}
      {loadError && (
        <div className="card">
          <p style={{ color: "var(--error)" }}>No se pudo cargar el paciente: {loadError}</p>
        </div>
      )}

      {form && (
        <>
          <div className="card">
            <h3>Datos personales</h3>
            <div className="field-row">
              <div className="field">
                <label>Nombre</label>
                <input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
              </div>
              <div className="field">
                <label>Apellido</label>
                <input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
              </div>
              <div className="field">
                <label>DNI</label>
                <input value={form.dni} onChange={(e) => update("dni", e.target.value)} />
              </div>
              <div className="field">
                <label>Fecha de nacimiento</label>
                <input type="date" value={form.birthDate} onChange={(e) => update("birthDate", e.target.value)} />
              </div>
              <div className="field">
                <label>Sexo</label>
                <select value={form.sex} onChange={(e) => update("sex", e.target.value as Sex)}>
                  {SEX_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Fecha de consulta</label>
                <input type="date" value={form.consultDate} onChange={(e) => update("consultDate", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Datos antropometricos y objetivo</h3>
            <div className="field-row">
              <div className="field">
                <label>Talla (cm)</label>
                <input type="number" value={form.height} onChange={(e) => update("height", e.target.value)} />
              </div>
              <div className="field">
                <label>Peso (kg)</label>
                <input type="number" value={form.weight} onChange={(e) => update("weight", e.target.value)} />
              </div>
              <div className="field">
                <label>Nivel de actividad</label>
                <input value={form.activityLevel} onChange={(e) => update("activityLevel", e.target.value)} />
              </div>
              <div className="field">
                <label>Factor de actividad</label>
                <input type="number" step="0.01" value={form.activityFactor} onChange={(e) => update("activityFactor", e.target.value)} />
              </div>
              <div className="field">
                <label>Objetivo</label>
                <select value={form.goal} onChange={(e) => update("goal", e.target.value as Goal)}>
                  {GOAL_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Objetivos e indicaciones</h3>
            <div className="field">
              <label>Objetivos (texto libre)</label>
              <textarea rows={3} value={form.objectivesText} onChange={(e) => update("objectivesText", e.target.value)} />
            </div>
            <div className="field">
              <label>Indicaciones (texto libre)</label>
              <textarea rows={3} value={form.indicationsText} onChange={(e) => update("indicationsText", e.target.value)} />
            </div>
          </div>

          <div className="card">
            <h3>Opciones de comida importadas</h3>
            <p style={{ fontSize: 13, color: "#555" }}>
              De solo lectura en esta version. La edicion de comidas se agrega en la proxima etapa.
            </p>
            <table>
              <tbody>
                {Object.entries(mealCounts).map(([meal, count]) => (
                  <tr key={meal}><td style={{ textTransform: "capitalize" }}>{meal}</td><td>{count} opciones</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <button className="primary" disabled={saving} onClick={handleSave}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            {saved && <p style={{ color: "var(--brand-dark)", fontSize: 13 }}>Guardado.</p>}
            {saveError && <p style={{ color: "var(--error)", fontSize: 13 }}>{saveError}</p>}
          </div>
        </>
      )}
    </div>
  );
}
