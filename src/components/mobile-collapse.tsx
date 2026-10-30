"use client";
import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

/**
 * Trên điện thoại: bộ lọc thu gọn sẵn sau một nút "Bộ lọc (n)", bấm mới bung ra (lưới 2 cột).
 * Trên máy tính (md trở lên): luôn hiện, xếp hàng ngang như bình thường.
 */
export function MobileCollapse({ children, active = 0, label = "Bộ lọc" }: { children: React.ReactNode; active?: number; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full md:contents">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 text-sm md:hidden">
        <span className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-slate-500" />{label}{active > 0 && <span className="rounded-full bg-orange-600 px-1.5 text-[11px] font-semibold text-white">{active}</span>}</span>
        <ChevronDown className={`size-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`${open ? "grid" : "hidden"} grid-cols-2 gap-2 pt-2 md:contents [&>select]:w-full md:[&>select]:w-auto`}>{children}</div>
    </div>
  );
}
