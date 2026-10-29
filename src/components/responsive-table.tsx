"use client";
import { useEffect, useRef } from "react";

/** Mobile: bảng thành danh sách thẻ; gắn data-label theo tiêu đề cột. */
export function ResponsiveTable({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const table = ref.current;
    if (!table) return;
    const label = () => {
      const heads = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent?.trim() ?? "");
      table.querySelectorAll("tbody tr").forEach((tr) =>
        Array.from(tr.children).forEach((td, i) => { if (td.getAttribute("data-label") !== (heads[i] ?? "")) td.setAttribute("data-label", heads[i] ?? ""); }));
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(table, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, []);
  return <table ref={ref} className="rtable w-full text-left text-sm">{children}</table>;
}
