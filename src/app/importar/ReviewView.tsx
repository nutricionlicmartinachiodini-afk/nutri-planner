"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlanDraft, WarningSeverity } from "@/domain/types";

const SEVERITY_LABEL: Record<WarningSeverity, string> = {
  bloqueante: "Bloqueante",
  advertencia: "Advertencia",
  info: "Info",
};

export function ReviewView({ draft }: { draft: PlanDraft }) {
  const [resolved, setResolved] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedPatientId, setSavedPatientId] = useState<string | null>(null);

  const bloqueantes = draft.warnings.filter((w) => w.severity === "bloqueante");
  const advertencias = draft.warnings.filter((w) => w.severity === "advertencia");
  const infos = draft.warnings.filter((w) => w.severity === "info");

  const bloqueantesPendientes = bloqueantes.filter((w) => !resolved[w.id]);
  const puedeConfirmar = bloqueantesPendientes.length === 0;

  const mealCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of draft.mealOptions) counts[o.mealType] = (counts[o.mealType] ?? 0) + 1;
    return counts;
  }, [draft.mealOptions]);

  const noMatchCount = draft.mealOptions.filter((o) => o.foodId.startsWith("__no_match__")).length;

  const toggleResolved = (id: string) => setResolved((r) => ({ ...r, [id]: !r[id] }));

  async function handleConfirm() {
    setSaving(true);
    setSaveError(null);
    try {
      const resolvedWarningIds = Object.keys(resolved).filter((id) => resolved[id]);
      const res = await fetch("/api/plan/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, resolvedWarningIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Error desconocido al guardar.");
        return;
      }
      setSavedPatientId(data.patientId);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (savedPatientId) {
    return (
      <div className="card">
        <h2>Importacion confirmada y guardada</h2>
        <p>
          El paciente y sus opciones de comida quedaron guardados en la base de
          datos: no se pierden si recargas la pagina o cerras el navegador.
        </p>
        <Link href={`/pacientes/${savedPatientId}`}>
          <button className="primary">Ver ficha del paciente</button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2>Revision de la importacion</h2>

      <div className="summary-grid" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="num">{draft.foods.length}</div>
          <div className="lbl">alimentos en catalogo</div>
        </div>
        <div className="stat">
          <div className="num">{draft.mealOptions.length}</div>
          <div className="lbl">opciones de comida</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: noMatchCount > 0 ? "var(--error)" : undefined }}>
            {noMatchCount}
          </div>
          <div className="lbl">alimentos sin match</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: "var(--error)" }}>{bloqueantesPendientes.length}</div>
          <div className="lbl">bloqueantes pendientes</div>
        </div>
      </div>

      <div className="card">
        <h3>Datos del paciente encontrados</h3>
        <table>
          <tbody>
            <tr><td>Nombre y apellido</td><td>{fmt(draft.patient.firstName, draft.patient.lastName)}</td></tr>
            <tr><td>Fecha de consulta</td><td>{draft.patient.consultDate ?? faltante()}</td></tr>
            <tr><td>Sexo</td><td>{draft.patient.sex ?? faltante()}</td></tr>
            <tr><td>Talla (cm)</td><td>{draft.patient.height ?? faltante()}</td></tr>
            <tr><td>Peso (kg)</td><td>{draft.patient.weight ?? faltante()}</td></tr>
            <tr><td>Objetivo</td><td>{draft.patient.goal ?? faltante()}</td></tr>
            <tr><td>Nivel de actividad</td><td>{draft.patient.activityLevel ?? faltante()}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Opciones de comida por tipo</h3>
        <table>
          <tbody>
            {Object.entries(mealCounts).map(([meal, count]) => (
              <tr key={meal}><td style={{ textTransform: "capitalize" }}>{meal}</td><td>{count} opciones</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <WarningGroup
        title={`Bloqueantes (${bloqueantes.length})`}
        severity="bloqueante"
        warnings={bloqueantes}
        resolved={resolved}
        onToggle={toggleResolved}
        help="Hay que resolverlos (o marcarlos como revisados) antes de poder confirmar la importacion."
      />
      <WarningGroup
        title={`Advertencias (${advertencias.length})`}
        severity="advertencia"
        warnings={advertencias}
        resolved={resolved}
        onToggle={toggleResolved}
        help="No bloquean, pero conviene revisarlas antes de generar el PDF."
      />
      <WarningGroup
        title={`Informativas (${infos.length})`}
        severity="info"
        warnings={infos}
        resolved={resolved}
        onToggle={toggleResolved}
        help="Transparencia sobre como se leyo el archivo (por ejemplo, secciones que dependen de texto ancla en vez de una Tabla con nombre)."
      />

      <div className="card">
        <button className="primary" disabled={!puedeConfirmar || saving} onClick={handleConfirm}>
          {saving ? "Guardando..." : "Confirmar importacion"}
        </button>
        {!puedeConfirmar && (
          <p style={{ color: "var(--error)", fontSize: 13 }}>
            Quedan {bloqueantesPendientes.length} advertencia(s) bloqueante(s) sin marcar como revisadas.
          </p>
        )}
        {saveError && <p style={{ color: "var(--error)", fontSize: 13 }}>{saveError}</p>}
      </div>
    </div>
  );
}

function fmt(a?: string, b?: string) {
  const s = [a, b].filter(Boolean).join(" ");
  return s || faltante();
}
function faltante() {
  return <span style={{ color: "var(--error)" }}>falta cargar</span>;
}

function WarningGroup({
  title,
  severity,
  warnings,
  resolved,
  onToggle,
  help,
}: {
  title: string;
  severity: WarningSeverity;
  warnings: PlanDraft["warnings"];
  resolved: Record<string, boolean>;
  onToggle: (id: string) => void;
  help: string;
}) {
  if (warnings.length === 0) return null;
  return (
    <div className="card">
      <h3>
        {title} <span className={`badge badge-${severity}`}>{SEVERITY_LABEL[severity]}</span>
      </h3>
      <p style={{ fontSize: 13, color: "#555" }}>{help}</p>
      {warnings.map((w) => (
        <div key={w.id} className={`warning-row ${severity}`}>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            {severity === "bloqueante" && (
              <input type="checkbox" checked={!!resolved[w.id]} onChange={() => onToggle(w.id)} />
            )}
            <span>
              <strong>
                {w.sheet}
                {w.cellRef ? ` ${w.cellRef}` : ""}:
              </strong>{" "}
              {w.message}
            </span>
          </label>
        </div>
      ))}
    </div>
  );
}
