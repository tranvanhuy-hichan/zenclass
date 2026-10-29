import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZES } from "@/lib/paging";

type Params = Record<string, string | undefined>;

export function Pagination({ total, page, size, path, params = {}, pageKey = "page" }: { total: number; page: number; size: number; path: string; params?: Params; pageKey?: string }) {
  if (total <= 0) return null;
  const pages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(page, pages);
  const href = (over: Params) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...over })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - cur) <= 1) nums.push(i); else if (nums[nums.length - 1] !== "…") nums.push("…");
  const from = (cur - 1) * size + 1, to = Math.min(cur * size, total);
  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm";
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="text-slate-500">Hiển thị <b>{from}–{to}</b> / {total}</div>
      <div className="flex flex-wrap items-center gap-1">
        {cur > 1 ? <Link href={href({ [pageKey]: String(cur - 1) })} className={`${btn} bg-white hover:bg-slate-50`} aria-label="Trang trước"><ChevronLeft className="size-4" /></Link> : <span className={`${btn} opacity-40`}><ChevronLeft className="size-4" /></span>}
        {nums.map((n, i) => n === "…" ? <span key={i} className="px-1 text-slate-400">…</span> : (
          <Link key={i} href={href({ [pageKey]: String(n) })} className={`${btn} ${n === cur ? "border-orange-600 bg-orange-600 font-semibold text-white" : "bg-white hover:bg-slate-50"}`}>{n}</Link>
        ))}
        {cur < pages ? <Link href={href({ [pageKey]: String(cur + 1) })} className={`${btn} bg-white hover:bg-slate-50`} aria-label="Trang sau"><ChevronRight className="size-4" /></Link> : <span className={`${btn} opacity-40`}><ChevronRight className="size-4" /></span>}
      </div>
      <div className="flex items-center gap-1 text-slate-500">
        Mỗi trang:
        {PAGE_SIZES.map((s) => <Link key={s} href={href({ size: String(s), [pageKey]: "1" })} className={`${btn} ${s === size ? "border-orange-600 text-orange-700 font-semibold" : "bg-white hover:bg-slate-50"}`}>{s}</Link>)}
      </div>
    </div>
  );
}
