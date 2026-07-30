import { NextRequest, NextResponse } from "next/server";
import { confirmImport } from "@/lib/repository";
import { PlanDraft } from "@/domain/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const draft = body.draft as PlanDraft;
  const resolvedWarningIds = (body.resolvedWarningIds as string[]) ?? [];

  if (!draft || !draft.importId) {
    return NextResponse.json({ error: "Falta el borrador a confirmar." }, { status: 400 });
  }

  try {
    const patientId = await confirmImport(draft, resolvedWarningIds);
    return NextResponse.json({ patientId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No se pudo guardar la importacion: ${message}` }, { status: 422 });
  }
}
