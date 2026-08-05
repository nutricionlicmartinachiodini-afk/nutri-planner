"use client";

import Link from "next/link";
import { RecipeForm } from "../RecipeForm";

export default function NuevaRecetaPage() {
  return (
    <div className="container">
      <h1>Nueva receta</h1>
      <p>
        <Link href="/recetas">&larr; Volver a recetas</Link>
      </p>
      <RecipeForm />
    </div>
  );
}
