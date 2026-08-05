"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  desayuno: "Desayuno",
  merienda: "Merienda",
  almuerzo: "Almuerzo",
  cena_con_hidratos: "Cena (con hidratos)",
  cena_sin_hidratos: "Cena (sin hidratos)",
  colacion: "Colación",
  preparacion_base: "Preparación base",
};

interface RecipeSummary {
  id: string;
  name: string;
  category: string;
  status: string;
  servings: number;
  prepTimeMin: number | null;
}

export default function RecetasPage() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/recipes")
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Error desconocido.");
        setRecipes(d.recipes);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const byCategory: Record<string, RecipeSummary[]> = {};
  for (const r of recipes) {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category]!.push(r);
  }

  return (
    <div className="container">
      <h1>Recetas</h1>
      <p>
        <Link href="/">&larr; Volver al panel</Link>
      </p>
      <div className="card">
        <Link href="/recetas/nueva">
          <button className="primary">+ Nueva receta</button>
        </Link>
      </div>

      {loading && <p>Cargando...</p>}
      {error && (
        <div className="card">
          <p style={{ color: "var(--error)" }}>No se pudo cargar: {error}</p>
        </div>
      )}

      {!loading && !error && recipes.length === 0 && (
        <div className="card">
          <p>Todavía no cargaste ninguna receta.</p>
        </div>
      )}

      {Object.entries(byCategory).map(([cat, list]) => (
        <div className="card" key={cat}>
          <h3>{CATEGORY_LABELS[cat] ?? cat}</h3>
          {list.map((r) => (
            <div className="patient-list-item" key={r.id}>
              <span>
                <strong>{r.name}</strong>{" "}
                <span style={{ color: "#666", fontSize: 13 }}>
                  &middot; {r.servings} porción{r.servings !== 1 ? "es" : ""}
                  {r.prepTimeMin != null ? ` · ${r.prepTimeMin} min` : ""}
                  {r.status === "archivado" ? " · archivada" : ""}
                </span>
              </span>
              <Link href={`/recetas/${r.id}`}>
                <button className="secondary">Editar</button>
              </Link>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
