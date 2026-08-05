import { NextRequest, NextResponse } from "next/server";
import { listRecipes, createRecipe, RecipeFields, RecipeIngredientInput } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get("category") ?? undefined;
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const recipes = await listRecipes({ category, status });
    return NextResponse.json({ recipes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudieron leer las recetas: ${message}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { fields: RecipeFields; ingredients: RecipeIngredientInput[] };
    if (!body.fields?.name?.trim()) {
      return NextResponse.json({ error: "La receta necesita un nombre." }, { status: 400 });
    }
    const id = await createRecipe(body.fields, body.ingredients ?? []);
    return NextResponse.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudo crear la receta: ${message}` }, { status: 422 });
  }
}
