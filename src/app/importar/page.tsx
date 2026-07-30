"use client";

import { useState } from "react";
import { PlanDraft } from "@/domain/types";
import { ReviewView } from "./ReviewView";

export default function ImportarPage() {
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("Elegi un archivo .xlsx primero.");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error desconocido al importar.");
        return;
      }
      setDraft(data as PlanDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>Importar Excel</h1>

      {!draft && (
        <form className="card" onSubmit={handleSubmit}>
          <p>Subi el archivo .xlsx del sistema nutricional (Anamnesis + Calculos + Base de datos).</p>
          <input type="file" name="file" accept=".xlsx" required />
          <div style={{ marginTop: 12 }}>
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "Procesando..." : "Importar"}
            </button>
          </div>
          {error && <p style={{ color: "var(--error)" }}>{error}</p>}
        </form>
      )}

      {draft && <ReviewView draft={draft} />}

      {draft && (
        <button className="secondary" onClick={() => setDraft(null)}>
          Importar otro archivo
        </button>
      )}
    </div>
  );
}
