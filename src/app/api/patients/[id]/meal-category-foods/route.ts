import { NextRequest, NextResponse } from "next/server";
import { getMealCategoryFoods } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await getMealCategoryFoods(params.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `No se pudo leer el desglose de Almuerzo/Cena por categoria: ${message}` },
      { status: 500 }
    );
  }
}
