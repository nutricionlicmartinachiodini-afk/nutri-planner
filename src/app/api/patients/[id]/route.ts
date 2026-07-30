import { NextRequest, NextResponse } from "next/server";
import { getPatientFull, updatePatient, PatientEditableFields } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const full = await getPatientFull(params.id);
    if (!full) {
      return NextResponse.json({ error: "Paciente no encontrado." }, { status: 404 });
    }
    return NextResponse.json(full);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudo leer el paciente: ${message}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const fields = (await req.json()) as PatientEditableFields;
    await updatePatient(params.id, fields);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudo guardar los cambios: ${message}` }, { status: 422 });
  }
}
