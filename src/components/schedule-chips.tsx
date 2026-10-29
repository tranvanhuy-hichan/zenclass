const DAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_FULL = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

type Sch = { weekday: number; startTime: string; endTime: string };

/** Gom các ngày cùng khung giờ: "T2 T4 · 17:00–18:30". */
export function groupSchedule(list: Sch[]) {
  const m = new Map<string, number[]>();
  for (const s of list) { const k = `${s.startTime}–${s.endTime}`; m.set(k, [...(m.get(k) ?? []), s.weekday]); }
  return [...m.entries()].map(([time, days]) => ({ time, days: days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)) }));
}

export function ScheduleChips({ list }: { list: Sch[] }) {
  const g = groupSchedule(list);
  if (!g.length) return <span className="text-slate-400">Chưa có lịch</span>;
  return (
    <div className="space-y-1">
      {g.map((x) => (
        <div key={x.time} className="flex flex-wrap items-center gap-1">
          {x.days.map((d) => <span key={d} className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-800">{DAY[d]}</span>)}
          <span className="text-sm tabular-nums">{x.time}</span>
        </div>
      ))}
    </div>
  );
}

export const hueOf = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
