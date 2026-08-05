import { NextRequest, NextResponse } from "next/server";
import { listFoods } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const foods = await listFoods();
    return NextResponse.json({ foods });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudo leer el catalogo de alimentos: ${message}` }, { status: 500 });
  }
}
