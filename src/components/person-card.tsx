import Link from "next/link";
import { Mail, Phone } from "lucide-react";

type Stat = { label: string; value: React.ReactNode };

/** Thẻ nhân sự gọn (giáo viên / trợ giảng / giáo vụ): dùng cho danh sách trên điện thoại và chế độ "Thẻ". */
export function PersonCard({ href, name, avatarUrl, tag, badge, phone, email, stats }: { href: string; name: string; avatarUrl?: string | null; tag?: string | null; badge?: React.ReactNode; phone?: string | null; email?: string | null; stats: Stat[] }) {
  return (
    <Link href={href} className="block rounded-xl border bg-white p-3.5 shadow-sm transition-colors hover:border-orange-400 active:bg-slate-50">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {avatarUrl ? <img src={avatarUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" /> : <span className="grid size-11 shrink-0 place-items-center rounded-full bg-orange-100 text-base font-bold text-orange-700">{name.split(" ").pop()?.[0]}</span>}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {tag ? <span className="max-w-full truncate rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">{tag}</span> : <span className="text-xs text-slate-400">Chưa có chuyên môn</span>}
            {badge}
          </div>
        </div>
      </div>
      <div className="mt-2.5 space-y-0.5 text-[13px] text-slate-600">
        <div className="flex items-center gap-2"><Phone className="size-3.5 shrink-0 text-slate-400" />{phone ?? "-"}</div>
        <div className="flex items-center gap-2"><Mail className="size-3.5 shrink-0 text-slate-400" /><span className="truncate">{email ?? "-"}</span></div>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t pt-3 text-sm">
        {stats.map((s) => <div key={s.label}><dt className="text-[11px] uppercase tracking-wide text-slate-500">{s.label}</dt><dd className="font-semibold">{s.value}</dd></div>)}
      </dl>
    </Link>
  );
}
