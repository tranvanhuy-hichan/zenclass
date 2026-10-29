"use client";
export function PrintButton() {
  return <button onClick={() => window.print()} className="print:hidden inline-flex h-9 items-center rounded-md border bg-white px-4 text-sm hover:bg-slate-50">In / Lưu PDF</button>;
}
