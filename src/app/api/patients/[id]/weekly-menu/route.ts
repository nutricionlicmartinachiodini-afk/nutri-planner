import { NextRequest, NextResponse } from "next/server";
import { getWeeklyMenu, saveWeeklyMenu, WeeklyMenuData } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await getWeeklyMenu(params.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudo leer el menu semanal: ${message}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as WeeklyMenuData;
    if (body.daysCount !== 5 && body.daysCount !== 7) {
      return NextResponse.json({ error: 'daysCount debe ser 5 o 7.' }, { status: 400 });
    }
    await saveWeeklyMenu(params.id, body);
    const data = await getWeeklyMenu(params.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudo guardar el menu semanal: ${message}` }, { status: 422 });
  }
}
