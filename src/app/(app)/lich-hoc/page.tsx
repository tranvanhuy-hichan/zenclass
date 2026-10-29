import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutList, Rows3, CalendarRange } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { DialogTrigger } from "@/components/dialog";
import { Field, inputCls, Title } from "@/components/ui";
import { WEEKDAYS, addDays, fmtDate, isoDate, mondayOf, parseDate, todayUTC, toMinutes } from "@/lib/format";
import { updateSession, cancelSession } from "../lop-hoc/actions";

const hue = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
type S = Awaited<ReturnType<typeof load>>[number];

async function load(where: object) {
  return db.session.findMany({
    where, orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { class: { include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } }, teacher: true, room: true },
  });
}

/** Xếp các buổi chồng giờ thành các làn song song. */
function lanes(list: S[]) {
  const out = new Map<string, { lane: number; of: number }>();
  let cluster: S[] = [], end = -1;
  const flush = () => {
    const ends: number[] = [];
    for (const s of cluster) {
      const st = toMinutes(s.startTime);
      let l = ends.findIndex((e) => e <= st);
      if (l < 0) { l = ends.length; ends.push(0); }
      ends[l] = toMinutes(s.endTime);
      out.set(s.id, { lane: l, of: 0 });
    }
    for (const s of cluster) out.get(s.id)!.of = ends.length;
    cluster = [];
  };
  for (const s of [...list].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))) {
    if (cluster.length && toMinutes(s.startTime) >= end) { flush(); end = -1; }
    cluster.push(s); end = Math.max(end, toMinutes(s.endTime));
  }
  if (cluster.length) flush();
  return out;
}

export default async function Schedule({ searchParams }: { searchParams: Promise<{ w?: string; by?: string; f?: string; view?: string; z?: string }> }) {
  const me = await requireRole("ADMIN", "STAFF", "TEACHER");
  const { w, by = "all", f = "", view = "grid", z = "wide" } = await searchParams;
  const compact = z === "compact";
  const PPM = compact ? 1.15 : 1.5; // px mỗi phút
  const LANE = compact ? 104 : 132;
  const staff = me.role !== "TEACHER";
  const today = todayUTC();
  const base = w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? parseDate(w) : today;

  let start: Date, end: Date, step: (n: number) => Date, label: string;
  if (view === "month") {
    const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
    start = mondayOf(first);
    const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
    end = addDays(mondayOf(last), 6);
    step = (n) => new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + n, 1));
    label = `Tháng ${base.getUTCMonth() + 1}/${base.getUTCFullYear()}`;
  } else if (view === "day") {
    start = base; end = base; step = (n) => addDays(base, n);
    label = `${WEEKDAYS[base.getUTCDay()]}, ${fmtDate(base)}`;
  } else {
    start = mondayOf(base); end = addDays(start, 6); step = (n) => addDays(start, 7 * n);
    label = `${fmtDate(start)} - ${fmtDate(end)}`;
  }

  const myTeacher = me.role === "TEACHER" ? await db.teacher.findUnique({ where: { userId: me.id } }) : null;
  const where: Record<string, unknown> = { date: { gte: start, lte: end } };
  if (me.role === "TEACHER") where.OR = [{ teacherId: myTeacher?.id ?? "-" }, { class: { assistantId: myTeacher?.id ?? "-" } }];
  else if (f) { if (by === "class") where.classId = f; if (by === "teacher") where.teacherId = f; if (by === "room") where.roomId = f; }
  const [sessions, classes, teachers, rooms] = await Promise.all([
    load(where),
    db.class.findMany({ where: { finished: false }, orderBy: { name: "asc" } }),
    db.teacher.findMany({ orderBy: { fullName: "asc" } }),
    db.room.findMany({ orderBy: { name: "asc" } }),
  ]);

  const q = (o: Record<string, string>) => `?${new URLSearchParams({ by, f, view, z, w: isoDate(base), ...o })}`;
  const opts = by === "class" ? classes : by === "teacher" ? teachers : by === "room" ? rooms : [];
  const days = view === "month" ? Array.from({ length: Math.round((end.getTime() - start.getTime()) / 86400000) + 1 }, (_, i) => addDays(start, i)) : view === "day" ? [start] : Array.from({ length: 7 }, (_, i) => addDays(start, i));

  // ---- chi tiết một buổi (dùng trong hộp thoại)
  const Detail = ({ s }: { s: S }) => (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div><div className="text-xs text-slate-500">Lớp</div><b>{s.class.name}</b></div>
        <div><div className="text-xs text-slate-500">Thời gian</div><b>{WEEKDAYS[s.date.getUTCDay()]} {fmtDate(s.date)} · {s.startTime}-{s.endTime}</b></div>
        <div><div className="text-xs text-slate-500">Giáo viên</div>{s.teacher?.fullName ?? "-"}</div>
        <div><div className="text-xs text-slate-500">Phòng</div>{s.room?.name ?? "Chưa có"}</div>
        <div><div className="text-xs text-slate-500">Học viên</div>{s.class._count.enrollments}</div>
        <div><div className="text-xs text-slate-500">Trạng thái</div>{{ PLANNED: "Chưa dạy", DONE: "Đã điểm danh", CANCELLED: "Nghỉ" }[s.status]}</div>
      </div>
      {s.status !== "CANCELLED" && <Link href={`/diem-danh/${s.id}`} className="inline-flex h-9 items-center rounded-md bg-orange-600 px-4 font-medium text-white hover:bg-orange-700">Điểm danh</Link>}
      {staff && s.status === "PLANNED" && (
        <div className="space-y-3 border-t pt-3">
          <div className="font-medium">Đổi lịch buổi này</div>
          <ActionForm action={updateSession} submit="Lưu thay đổi" reset={false} className="grid grid-cols-2 gap-3 [&>button]:justify-self-start">
            <input type="hidden" name="id" value={s.id} />
            <Field label="Ngày"><input type="date" name="date" defaultValue={isoDate(s.date)} className={inputCls + " w-full"} /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Từ"><input type="time" name="startTime" defaultValue={s.startTime} className={inputCls + " w-full"} /></Field><Field label="Đến"><input type="time" name="endTime" defaultValue={s.endTime} className={inputCls + " w-full"} /></Field></div>
            <Field label="Giáo viên"><select name="teacherId" defaultValue={s.teacherId ?? ""} className={inputCls + " w-full"}><option value="">--</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select></Field>
            <Field label="Phòng"><select name="roomId" defaultValue={s.roomId ?? ""} className={inputCls + " w-full"}><option value="">--</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
          </ActionForm>
          <ActionForm action={cancelSession} submit="Cho lớp nghỉ buổi này" danger confirmText="Cho lớp nghỉ buổi này? Học viên sẽ được báo." className="inline-flex"><input type="hidden" name="id" value={s.id} /></ActionForm>
        </div>
      )}
    </div>
  );
  const tone = (s: S) => {
    const h = hue(s.classId);
    return s.status === "CANCELLED"
      ? { background: "#f1f5f9", borderLeft: "4px solid #94a3b8", color: "#94a3b8" }
      : { background: `hsl(${h} 85% ${s.status === "DONE" ? 90 : 94}%)`, borderLeft: `4px solid hsl(${h} 65% 42%)`, color: `hsl(${h} 60% 18%)` };
  };

  // ---- lưới giờ: chỉ hiện các khung giờ có buổi học, khoảng trống được nén lại
  const used = new Set<number>();
  for (const x of sessions) for (let h = Math.floor(toMinutes(x.startTime) / 60); h < Math.ceil(toMinutes(x.endTime) / 60); h++) used.add(h);
  const vis = used.size ? [...used].sort((x, y) => x - y) : [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const GAP = 26;
  const hourTop = new Map<number, number>();
  const gaps: { top: number; from: number; to: number }[] = [];
  let acc = 0;
  vis.forEach((h, i) => {
    if (i > 0 && h !== vis[i - 1] + 1) { gaps.push({ top: acc, from: vis[i - 1] + 1, to: h }); acc += GAP; }
    hourTop.set(h, acc); acc += 60 * PPM;
  });
  const gridH = acc;
  const yOf = (min: number, isEnd = false) => {
    let h = Math.floor(min / 60);
    if (isEnd && min % 60 === 0 && !hourTop.has(h)) h -= 1, min = (h + 1) * 60;
    const t = hourTop.get(h);
    return t == null ? null : t + (min - h * 60) * PPM;
  };
  const perDay = days.map((d) => {
    const list = sessions.filter((x) => x.date.getTime() === d.getTime());
    const ln = lanes(list);
    const of = Math.max(1, ...[...ln.values()].map((v) => v.of));
    return { d, list, ln, of };
  });
  const colW = (of: number) => Math.max(view === "day" ? 300 : compact ? 130 : 170, of * LANE);
  const template = `60px ${perDay.map((x) => `minmax(${colW(x.of)}px, ${x.of}fr)`).join(" ")}`;
  const totalW = 60 + perDay.reduce((n, x) => n + colW(x.of), 0);
  const nowVN = new Date(Date.now() + 7 * 3600_000);
  const nowMin = nowVN.getUTCHours() * 60 + nowVN.getUTCMinutes();

  const tab = (v: string, text: string, Icon: typeof Rows3) => (
    <Link href={q({ view: v })} className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm ${view === v ? "border-orange-600 bg-orange-600 text-white" : "bg-white hover:bg-slate-50"}`}><Icon className="size-4" />{text}</Link>
  );

  return (
    <div className="space-y-4">
      <Title right={<div className="flex items-center gap-2 text-sm">
        <Link className="inline-flex size-9 items-center justify-center rounded-md border bg-white hover:bg-slate-50" href={q({ w: isoDate(step(-1)) })} aria-label="Trước"><ChevronLeft className="size-4" /></Link>
        <span className="min-w-44 text-center font-medium">{label}</span>
        <Link className="inline-flex size-9 items-center justify-center rounded-md border bg-white hover:bg-slate-50" href={q({ w: isoDate(step(1)) })} aria-label="Sau"><ChevronRight className="size-4" /></Link>
        <Link className="inline-flex h-9 items-center rounded-md bg-orange-600 px-3 font-medium text-white hover:bg-orange-700" href={q({ w: isoDate(today) })}>Hôm nay</Link>
      </div>}>Lịch học</Title>

      <div className="flex flex-wrap items-center gap-2">
        {tab("grid", "Lưới giờ", Rows3)}{tab("list", "Danh sách", LayoutList)}{tab("month", "Tháng", CalendarRange)}{tab("day", "Ngày", CalendarDays)}
        {(view === "grid" || view === "day") && (
          <div className="flex overflow-hidden rounded-md border bg-white text-sm">
            <Link href={q({ z: "compact" })} className={`px-3 py-2 ${compact ? "bg-orange-600 text-white" : "hover:bg-slate-50"}`}>Gọn</Link>
            <Link href={q({ z: "wide" })} className={`border-l px-3 py-2 ${!compact ? "bg-orange-600 text-white" : "hover:bg-slate-50"}`}>Rộng</Link>
          </div>
        )}
        {staff && (
          <form className="ml-auto flex flex-wrap gap-2">
            <input type="hidden" name="z" value={z} />
            <input type="hidden" name="w" value={isoDate(base)} /><input type="hidden" name="view" value={view} />
            <select name="by" defaultValue={by} className={inputCls}><option value="all">Tất cả</option><option value="class">Theo lớp</option><option value="teacher">Theo giáo viên</option><option value="room">Theo phòng</option></select>
            {by !== "all" && <select name="f" defaultValue={f} className={inputCls}><option value="">-- tất cả --</option>{opts.map((o) => <option key={o.id} value={o.id}>{(o as { fullName?: string; name?: string }).fullName ?? (o as { name?: string }).name}</option>)}</select>}
            <button className="h-9 rounded-md border bg-white px-4 text-sm">Xem</button>
          </form>
        )}
      </div>

      {/* ===== LƯỚI GIỜ (tuần / ngày) ===== */}
      {(view === "grid" || view === "day") && (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <div style={{ minWidth: totalW }}>
            <div className="grid border-b bg-slate-50" style={{ gridTemplateColumns: template }}>
              <div className="sticky left-0 z-20 bg-slate-50" />
              {perDay.map(({ d, list }) => {
                const n = list.length;
                const isToday = d.getTime() === today.getTime();
                return (
                  <Link key={d.getTime()} href={q({ view: "day", w: isoDate(d) })} className={`border-l px-2 py-2 text-center ${isToday ? "bg-orange-100" : "hover:bg-slate-100"}`}>
                    <div className="text-xs text-slate-500">{WEEKDAYS[d.getUTCDay()]}</div>
                    <div className={`text-lg font-bold leading-tight ${isToday ? "text-orange-700" : ""}`}>{d.getUTCDate()}</div>
                    <div className="text-[11px] text-slate-500">{n} buổi</div>
                  </Link>
                );
              })}
            </div>
            <div className="relative grid" style={{ gridTemplateColumns: template, height: gridH }}>
              <div className="sticky left-0 z-20 bg-white">
                {vis.map((h) => <div key={h} className="absolute right-2 text-xs text-slate-500" style={{ top: hourTop.get(h)! + 2 }}>{String(h).padStart(2, "0")}:00</div>)}
                {gaps.map((g) => <div key={g.top} className="absolute right-2 text-[10px] text-slate-300" style={{ top: g.top + 6 }}>⋯</div>)}
              </div>
              {perDay.map(({ d, list, ln }) => {
                const isToday = d.getTime() === today.getTime();
                return (
                  <div key={d.getTime()} className={`relative border-l ${isToday ? "bg-orange-50/50" : ""}`}>
                    {vis.map((h) => <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: hourTop.get(h)! }} />)}
                    {gaps.map((g) => <div key={g.top} className="absolute inset-x-0 bg-slate-100/80" style={{ top: g.top, height: GAP }} title={`${g.from}:00 – ${g.to}:00 không có lớp`} />)}
                    {isToday && yOf(nowMin) != null && <div className="absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: yOf(nowMin)! }}><i className="absolute -left-1 -top-1.5 size-2.5 rounded-full bg-red-500" /></div>}
                    {list.map((s) => {
                      const L = ln.get(s.id)!;
                      const top = yOf(toMinutes(s.startTime)) ?? 0;
                      const h = Math.max((yOf(toMinutes(s.endTime), true) ?? top) - top, 28);
                      return (
                        <DialogTrigger
                          key={s.id} title={s.class.name} trigger={
                            <>
                              <div className={`line-clamp-2 break-words text-sm font-semibold leading-snug ${s.status === "CANCELLED" ? "line-through" : ""}`}>{s.class.name}</div>
                              <div className="truncate text-xs opacity-80">{s.startTime} - {s.endTime}{s.status === "DONE" ? " ✓" : ""}</div>
                              {h > 62 && <div className="truncate text-xs opacity-80">{s.teacher?.fullName ?? ""}</div>}
                              {h > 84 && <div className="truncate text-xs opacity-80">{s.room ? `${s.room.name} · ` : ""}{s.class._count.enrollments} HV</div>}
                            </>
                          }
                          className="absolute overflow-hidden rounded-md px-1.5 py-1 text-left shadow-sm transition-shadow hover:shadow-md hover:ring-2 hover:ring-orange-400"
                          style={{ top, height: h - 2, left: `calc(${(L.lane / L.of) * 100}% + 2px)`, width: `calc(${100 / L.of}% - 4px)`, ...tone(s) }}
                        ><Detail s={s} /></DialogTrigger>
                      );
                    })}
                  </div>
                );
              })}
              <div className="pointer-events-none absolute inset-x-0 bottom-0" />
            </div>
          </div>
        </div>
      )}

      {/* ===== DANH SÁCH (tuần) ===== */}
      {view === "list" && (
        <div className="space-y-3">
          {days.map((d) => {
            const list = sessions.filter((s) => s.date.getTime() === d.getTime());
            if (!list.length) return null;
            const isToday = d.getTime() === today.getTime();
            return (
              <div key={d.getTime()} className="overflow-hidden rounded-lg border bg-white">
                <div className={`flex items-center justify-between px-4 py-2 text-sm font-semibold ${isToday ? "bg-orange-100 text-orange-800" : "bg-slate-50"}`}>
                  <span>{WEEKDAYS[d.getUTCDay()]}, {fmtDate(d)}{isToday && " · Hôm nay"}</span><span className="font-normal text-slate-500">{list.length} buổi</span>
                </div>
                <ul className="divide-y">
                  {list.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5" style={{ borderLeft: `4px solid ${s.status === "CANCELLED" ? "#94a3b8" : `hsl(${hue(s.classId)} 65% 42%)`}` }}>
                      <div className="w-28 text-sm font-semibold tabular-nums">{s.startTime} – {s.endTime}</div>
                      <div className="min-w-0 flex-1"><div className={`truncate font-medium ${s.status === "CANCELLED" ? "line-through text-slate-400" : ""}`}>{s.class.name}</div><div className="truncate text-xs text-slate-500">{s.teacher?.fullName ?? "Chưa có GV"} · {s.room?.name ?? "Chưa có phòng"} · {s.class._count.enrollments} HV</div></div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "DONE" ? "bg-green-100 text-green-800" : s.status === "CANCELLED" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}>{{ PLANNED: "Chưa dạy", DONE: "Đã điểm danh", CANCELLED: "Nghỉ" }[s.status]}</span>
                      <DialogTrigger title={s.class.name} trigger="Chi tiết" className="h-8 rounded-md border bg-white px-3 text-sm hover:bg-slate-50"><Detail s={s} /></DialogTrigger>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {!sessions.length && <p className="rounded-lg border bg-white py-10 text-center text-sm text-slate-500">Không có buổi học nào trong tuần này.</p>}
        </div>
      )}

      {/* ===== THÁNG ===== */}
      {view === "month" && (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 border-b bg-slate-50 text-center text-xs font-semibold text-slate-500">{["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"].map((d) => <div key={d} className="py-2">{d}</div>)}</div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const list = sessions.filter((s) => s.date.getTime() === d.getTime());
                const other = d.getUTCMonth() !== base.getUTCMonth();
                const isToday = d.getTime() === today.getTime();
                return (
                  <div key={d.getTime()} className={`min-h-28 border-b border-l p-1.5 ${other ? "bg-slate-50/70 text-slate-400" : ""} ${isToday ? "bg-orange-50" : ""}`}>
                    <Link href={q({ view: "day", w: isoDate(d) })} className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-orange-600 text-white" : "hover:bg-slate-200"}`}>{d.getUTCDate()}</Link>
                    <div className="space-y-0.5">
                      {list.slice(0, 3).map((s) => (
                        <DialogTrigger key={s.id} title={s.class.name} trigger={<span className="block truncate">{s.startTime} {s.class.name}</span>} className="block w-full rounded px-1.5 py-0.5 text-left text-[11px]" style={tone(s)}><Detail s={s} /></DialogTrigger>
                      ))}
                      {list.length > 3 && <Link href={q({ view: "day", w: isoDate(d) })} className="block px-1 text-[11px] text-orange-700 hover:underline">+{list.length - 3} buổi nữa</Link>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
