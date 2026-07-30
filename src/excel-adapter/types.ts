import * as XLSX from "xlsx";

export interface SheetAccess {
  wb: XLSX.WorkBook;
  sheet: (name: string) => XLSX.WorkSheet;
  cell: (sheetName: string, ref: string) => unknown;
  cellNum: (sheetName: string, ref: string) => number | null;
  cellStr: (sheetName: string, ref: string) => string | null;
}

export function makeSheetAccess(wb: XLSX.WorkBook): SheetAccess {
  const sheet = (name: string): XLSX.WorkSheet => {
    const ws = wb.Sheets[name];
    if (!ws) throw new Error(`Hoja no encontrada: ${name}`);
    return ws;
  };
  const cell = (sheetName: string, ref: string): unknown => {
    const ws = sheet(sheetName);
    const c = ws[ref];
    return c ? c.v : undefined;
  };
  const cellNum = (sheetName: string, ref: string): number | null => {
    const v = cell(sheetName, ref);
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const cellStr = (sheetName: string, ref: string): string | null => {
    const v = cell(sheetName, ref);
    if (v === undefined || v === null || v === "") return null;
    return String(v).trim();
  };
  return { wb, sheet, cell, cellNum, cellStr };
}
