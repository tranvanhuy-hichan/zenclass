"use client";
import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

/**
 * Trên điện thoại: bộ lọc thu gọn sẵn sau một nút "Bộ lọc (n)", bấm mới bung ra (lưới 2 cột).
 * Trên máy tính (md trở lên): luôn hiện, xếp hàng ngang như bình thường.
 */
export function MobileCollapse({ children, active = 0, label = "Bộ lọc", block = false }: { children: React.ReactNode; active?: number; label?: string; block?: boolean }) {
  const [open, setOpen] = useState(false);
  // Thẻ gốc dùng `contents` để nút "Bộ lọc" nằm cùng hàng với các nút bên cạnh; khung lọc thì xuống hàng riêng, rộng hết cỡ.
  return (
    <div className="contents">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm md:hidden ${block ? "w-full justify-between" : ""}`}>
        <span className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-slate-500" />{label}{active > 0 && <span className="rounded-full bg-orange-600 px-1.5 text-[11px] font-semibold text-white">{active}</span>}</span>
        <ChevronDown className={`size-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`${open ? "grid" : "hidden"} w-full basis-full grid-cols-2 gap-2 md:contents [&>select]:w-full md:[&>select]:w-auto`}>{children}</div>
    </div>
  );
}
