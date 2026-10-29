"use client";
export function PrintButton() {
  return <button onClick={() => window.print()} className="print:hidden border rounded-lg px-4 py-2 text-sm bg-white">In / Lưu PDF</button>;
}
