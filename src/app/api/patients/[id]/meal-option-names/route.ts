import { NextRequest, NextResponse } from "next/server";
import { getPatientFull, getMealOptionLabels, saveMealOptionLabels, MealOptionLabelRow } from "@/lib/repository";
import { groupMealOptionsByOptionNumber } from "@/lib/mealOptionNaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function buildResponse(patientId: string) {
  const full = await getPatientFull(patientId);
  if (!full) return null;
  const labels = await getMealOptionLabels(patientId);
  const labelByKey = new Map(labels.map((l) => [`${l.mealType}_${l.optionNumber}`, l.name]));

  const build = (mealType: "desayuno" | "merienda") =>
    groupMealOptionsByOptionNumber(full.mealOptions, mealType).map((g) => {
      const manualName = labelByKey.get(`${mealType}_${g.optionNumber}`) ?? null;
      return {
        optionNumber: g.optionNumber,
        autoName: g.autoName,
        manualName,
        resolvedName: manualName ?? g.autoName,
        items: g.items,
      };
    });

  return { desayuno: build("desayuno"), merienda: build("merienda") };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await buildResponse(params.id);
    if (!data) return NextResponse.json({ error: "Paciente no encontrado." }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `No se pudieron leer los nombres de las preparaciones: ${message}` },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as { labels: MealOptionLabelRow[] };
    await saveMealOptionLabels(params.id, body.labels ?? []);
    const data = await buildResponse(params.id);
    if (!data) return NextResponse.json({ error: "Paciente no encontrado." }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `No se pudieron guardar los nombres de las preparaciones: ${message}` },
      { status: 422 }
    );
  }
}
