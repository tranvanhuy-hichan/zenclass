import Link from "next/link";
import { LayoutGrid, Rows3 } from "lucide-react";

export type ListView = "table" | "cards";

/** Đọc chế độ xem từ ?v=; không hợp lệ thì dùng mặc định của trang. */
export const pickView = (v: string | undefined, def: ListView): ListView => (v === "table" || v === "cards" ? v : def);

/** Nút chuyển Bảng / Thẻ (giữ nguyên các tham số lọc khác). */
export function ViewToggle({ path, params, view }: { path: string; params?: Record<string, string | undefined>; view: ListView }) {
  const href = (v: ListView) => {
    const p = new URLSearchParams();
    for (const [k, x] of Object.entries(params ?? {})) if (x && k !== "page" && k !== "v") p.set(k, x);
    p.set("v", v);
    return `${path}?${p}`;
  };
  const cls = (on: boolean) => `inline-flex h-9 flex-1 items-center justify-center gap-1 px-3 md:flex-none ${on ? "bg-orange-600 text-white" : "hover:bg-slate-50"}`;
  return (
    <div className="flex w-full shrink-0 overflow-hidden rounded-md border bg-white text-sm md:w-auto">
      <Link href={href("table")} className={cls(view === "table")}><Rows3 className="size-4" /> Bảng</Link>
      <Link href={href("cards")} className={`${cls(view === "cards")} border-l`}><LayoutGrid className="size-4" /> Thẻ</Link>
    </div>
  );
}
