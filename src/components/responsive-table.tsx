"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * - Mobile: bảng thành danh sách thẻ; gắn data-label theo tiêu đề cột.
 * - Hàng nào có liên kết đánh dấu data-row thì bấm vào chỗ nào của hàng cũng mở được chi tiết
 *   (trừ khi bấm vào nút, ô nhập, liên kết khác).
 */
export function ResponsiveTable({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLTableElement>(null);
  const router = useRouter();
  useEffect(() => {
    const table = ref.current;
    if (!table) return;
    const label = () => {
      const heads = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent?.trim() ?? "");
      table.querySelectorAll("tbody tr").forEach((tr) => {
        Array.from(tr.children).forEach((td, i) => { if (td.getAttribute("data-label") !== (heads[i] ?? "")) td.setAttribute("data-label", heads[i] ?? ""); });
        const has = !!tr.querySelector("a[data-row]");
        if (has !== tr.hasAttribute("data-clickable")) { if (has) tr.setAttribute("data-clickable", ""); else tr.removeAttribute("data-clickable"); }
      });
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(table, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, []);

  function onClick(e: React.MouseEvent<HTMLTableElement>) {
    const t = e.target as HTMLElement;
    if (t.closest("a, button, input, select, textarea, label, summary, dialog, [role=button]")) return;
    const tr = t.closest("tbody tr");
    const a = tr?.querySelector<HTMLAnchorElement>("a[data-row]");
    if (!a) return;
    if (e.metaKey || e.ctrlKey) window.open(a.href, "_blank");
    else router.push(a.getAttribute("href")!);
  }

  return <table ref={ref} onClick={onClick} className="rtable w-full text-left text-sm">{children}</table>;
}
