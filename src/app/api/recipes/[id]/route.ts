import { NextRequest, NextResponse } from "next/server";
import { getRecipe, updateRecipe, deleteRecipe, RecipeFields, RecipeIngredientInput } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const recipe = await getRecipe(params.id);
    if (!recipe) return NextResponse.json({ error: "Receta no encontrada." }, { status: 404 });
    return NextResponse.json(recipe);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudo leer la receta: ${message}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as { fields: RecipeFields; ingredients: RecipeIngredientInput[] };
    if (!body.fields?.name?.trim()) {
      return NextResponse.json({ error: "La receta necesita un nombre." }, { status: 400 });
    }
    await updateRecipe(params.id, body.fields, body.ingredients ?? []);
    const recipe = await getRecipe(params.id);
    return NextResponse.json(recipe);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudo guardar la receta: ${message}` }, { status: 422 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteRecipe(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudo borrar la receta: ${message}` }, { status: 422 });
  }
}
