"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { RecipeForm } from "../RecipeForm";

export default function EditarRecetaPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="container">
      <h1>Editar receta</h1>
      <p>
        <Link href="/recetas">&larr; Volver a recetas</Link>
      </p>
      <RecipeForm recipeId={params.id} />
    </div>
  );
}
