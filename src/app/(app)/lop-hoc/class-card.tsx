import Link from "next/link";
import { fmtDate, roomLabel } from "@/lib/format";
import { ScheduleChips, hueOf } from "@/components/schedule-chips";

type C = {
  id: string; name: string; finished: boolean; mode: string; totalSessions: number; maxStudents: number; endDate: Date | null;
  teacher: { fullName: string } | null; room: { name: string; branch: { name: string } | null } | null;
  schedules: { weekday: number; startTime: string; endTime: string }[];
};

function Meter({ label, value, max, tone, hint }: { label: string; value: number; max: number; tone: string; hint?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-xs"><span className="text-slate-500">{label}</span><span className="text-slate-500">{hint ?? `${pct}%`}</span></div>
      <div className="mt-0.5 text-sm"><b>{value}</b><span className="text-slate-500">/{max}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/** Thẻ lớp học gọn: dùng cho danh sách trên điện thoại và chế độ "Thẻ". Cả thẻ là một liên kết. */
export function ClassCard({ c, done, students }: { c: C; done: number; students: number }) {
  const full = students >= c.maxStudents;
  return (
    <Link href={`/lop-hoc/${c.id}`} className="block rounded-xl border bg-white p-3.5 shadow-sm transition-colors hover:border-orange-400 active:bg-slate-50" style={{ borderLeft: `4px solid hsl(${hueOf(c.id)} 65% 45%)` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-base font-semibold leading-snug">{c.name}</div>
        {c.finished ? <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs">Đã kết thúc</span> : <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Đang mở</span>}
      </div>
      <div className="mt-0.5 text-[13px] text-slate-600">{c.teacher?.fullName ?? "Chưa có GV"} · {roomLabel(c.room) ?? "Chưa có phòng"}{c.mode === "ONLINE" ? " · Online" : ""}</div>
      <div className="mt-2"><ScheduleChips list={c.schedules} /></div>
      <div className="mt-3 grid grid-cols-2 gap-4 border-t pt-3">
        <Meter label="Tiến độ" value={done} max={c.totalSessions} tone="bg-orange-500" hint={c.endDate ? `đến ${fmtDate(c.endDate)}` : undefined} />
        <Meter label="Học viên" value={students} max={c.maxStudents} tone={full ? "bg-red-500" : "bg-sky-500"} hint={full ? "Đã đầy" : undefined} />
      </div>
    </Link>
  );
}
