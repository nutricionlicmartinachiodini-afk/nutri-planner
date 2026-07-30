import { NextRequest, NextResponse } from "next/server";
import { importExcelFile } from "@/excel-adapter/importExcel";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No se recibio ningun archivo." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const draft = importExcelFile(buffer);
    return NextResponse.json(draft);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `No se pudo procesar el archivo: ${message}` },
      { status: 422 }
    );
  }
}
