import { NextResponse } from "next/server";
import { listPatients } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const patients = await listPatients();
    return NextResponse.json({ patients });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudo leer la lista de pacientes: ${message}` }, { status: 500 });
  }
}
