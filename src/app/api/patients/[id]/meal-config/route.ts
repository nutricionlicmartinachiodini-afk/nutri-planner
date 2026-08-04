import { NextRequest, NextResponse } from "next/server";
import { getPatientFull, getMealConfigOverride, saveMealConfigOverride, MealConfigOverrideRow } from "@/lib/repository";
import { resolveMealConfig } from "@/lib/mealConfigLogic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const full = await getPatientFull(params.id);
    if (!full) {
      return NextResponse.json({ error: "Paciente no encontrado." }, { status: 404 });
    }
    const override = await getMealConfigOverride(params.id);
    const resolved = resolveMealConfig(full.mealOptions, override);
    return NextResponse.json(resolved);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudo leer la configuracion de comidas: ${message}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as MealConfigOverrideRow;
    await saveMealConfigOverride(params.id, body);
    const full = await getPatientFull(params.id);
    const override = await getMealConfigOverride(params.id);
    const resolved = resolveMealConfig(full?.mealOptions ?? [], override);
    return NextResponse.json(resolved);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudo guardar la configuracion de comidas: ${message}` }, { status: 422 });
  }
}
