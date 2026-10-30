import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, DoorOpen, LayoutList, Table2, User, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, teachingIds } from "@/lib/guard";
import { portalKids } from "@/server/portal";
import { AutoForm } from "@/components/auto-form";
import { ActionForm } from "@/components/action-form";
import { DialogTrigger } from "@/components/dialog";
import { MobileCollapse } from "@/components/mobile-collapse";
import { Field, inputCls, Title } from "@/components/ui";
import { WEEKDAYS, addDays, fmtDate, isoDate, mondayOf, parseDate, sessionEnded, todayUTC, roomLabel } from "@/lib/format";
import { updateSession, cancelSession } from "../lop-hoc/actions";

const hue = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
type S = Awaited<ReturnType<typeof load>>[number];

async function load(where: object, kidId?: string) {
  return db.session.findMany({
    where, orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { class: { include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } }, teacher: true, room: { include: { branch: true } }, attendances: kidId ? { where: { studentId: kidId } } : false },
  });
}

export default async function Schedule({ searchParams }: { searchParams: Promise<{ w?: string; branch?: string; class?: string; teacher?: string; room?: string; view?: string; child?: string; scope?: string; d?: string }> }) {
  const me = await requireRole("ADMIN", "STAFF", "TEACHER", "STUDENT", "PARENT");
  const sp = await searchParams;
  const { w, child } = sp;
  const view = sp.view === "list" ? "list" : "matrix";
  const fBranch = sp.branch ?? "", fClass = sp.class ?? "", fTeacher = sp.teacher ?? "", fRoom = sp.room ?? "";
  const isLearner = me.role === "STUDENT" || me.role === "PARENT";
  const portal = isLearner ? await portalKids(me, child) : null;
  const staff = me.role === "ADMIN" || me.role === "STAFF";
  const today = todayUTC();
  const base = w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? parseDate(w) : today;

  const start = mondayOf(base), end = addDays(start, 6);
  const step = (n: number) => addDays(start, 7 * n);
  const label = `${fmtDate(start)} - ${fmtDate(end)}`;

  const prof = me.role === "TEACHER" || me.role === "STAFF" ? await teachingIds(me.id) : null;
  const hasMine = !!(prof && (prof.teacherId || prof.assistantId || prof.coordinatorId));
  const scope = hasMine && sp.scope !== "all" ? "mine" : "all";
  const canFilter = me.role === "ADMIN" || me.role === "STAFF" || me.role === "TEACHER";
  const mineOr = prof ? [
    ...(prof.teacherId ? [{ teacherId: prof.teacherId }] : []),
    ...(prof.assistantId ? [{ class: { assistantId: prof.assistantId } }] : []),
    ...(prof.coordinatorId ? [{ class: { coordinatorId: prof.coordinatorId } }] : []),
  ] : [];
  const isMine = (s: { teacherId: string | null; class: { assistantId?: string | null; coordinatorId?: string | null } }) =>
    !!prof && ((!!prof.teacherId && s.teacherId === prof.teacherId) || (!!prof.assistantId && s.class.assistantId === prof.assistantId) || (!!prof.coordinatorId && s.class.coordinatorId === prof.coordinatorId));
  const where: Record<string, unknown> = { date: { gte: start, lte: end } };
  if (isLearner) {
    if (!portal?.kid) where.id = "-";
    else where.OR = [{ class: { enrollments: { some: { studentId: portal.kid.id, status: { in: ["ACTIVE", "PAUSED", "FINISHED"] } } } } }, { attendances: { some: { studentId: portal.kid.id } } }];
  } else {
    if (scope === "mine") where.OR = mineOr;
    if (fClass) where.classId = fClass;
    if (fTeacher) where.teacherId = fTeacher;
    if (fRoom) where.roomId = fRoom;
    else if (fBranch) where.room = { branchId: fBranch };
  }
  const [sessions, classes, teachers, rooms, branches] = await Promise.all([
    load(where, portal?.kid?.id),
    db.class.findMany({ where: { finished: false, ...(fBranch ? { room: { branchId: fBranch } } : {}) }, orderBy: { name: "asc" } }),
    db.teacher.findMany({ where: fBranch ? { classes: { some: { room: { branchId: fBranch } } } } : {}, orderBy: { fullName: "asc" } }),
    db.room.findMany({ where: fBranch ? { branchId: fBranch } : {}, orderBy: { name: "asc" }, include: { branch: true } }),
    db.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const q = (o: Record<string, string>) => `?${new URLSearchParams({ view, w: isoDate(base), ...(fBranch ? { branch: fBranch } : {}), ...(fClass ? { class: fClass } : {}), ...(fTeacher ? { teacher: fTeacher } : {}), ...(fRoom ? { room: fRoom } : {}), ...(hasMine ? { scope } : {}), ...(portal?.kid ? { child: portal.kid.id } : {}), ...o })}`;
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  // ---- chi tiết một buổi (dùng trong hộp thoại)
  const STATUS_BADGE = { PLANNED: ["Chưa dạy", "bg-slate-100 text-slate-600"], DONE: ["Đã điểm danh", "bg-green-100 text-green-800"], CANCELLED: ["Lớp nghỉ", "bg-red-100 text-red-600"] } as const;
  const ATT_LABEL: Record<string, string> = { PRESENT: "Có mặt", LATE: "Đi muộn", ABSENT_EXCUSED: "Vắng có phép", ABSENT: "Vắng", PENDING: "Học bù (chờ)" };
  const Detail = ({ s }: { s: S }) => {
    const [stLabel, stTone] = STATUS_BADGE[s.status];
    const myAtt = (s as unknown as { attendances?: { status: string }[] }).attendances?.[0]?.status;
    const Row = ({ icon: I, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) => (
      <div className="flex items-start gap-3"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-orange-100 text-orange-700"><I className="size-4" /></span><div className="min-w-0"><div className="text-xs text-slate-500">{label}</div><div className="font-medium">{children}</div></div></div>
    );
    return (
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {isOverdue(s) ? <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">Quá giờ, chưa điểm danh</span> : <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stTone}`}>{stLabel}</span>}
          {s.originalTeacherId && <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">Dạy thế</span>}
          {s.class.mode === "ONLINE" && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">Online</span>}
        </div>
        <div className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
          <Row icon={CalendarDays} label="Ngày học">{WEEKDAYS[s.date.getUTCDay()]}, {fmtDate(s.date)}</Row>
          <Row icon={Clock} label="Giờ học">{s.startTime} – {s.endTime}</Row>
          <Row icon={User} label="Giáo viên">{s.teacher?.fullName ?? "Chưa có"}</Row>
          <Row icon={DoorOpen} label="Phòng">{roomLabel(s.room) ?? "Chưa có"}</Row>
          {!isLearner && <Row icon={Users} label="Học viên">{s.class._count.enrollments} học viên</Row>}
          {isLearner && portal?.kid && <Row icon={Users} label={`Điểm danh của ${portal.kid.fullName.split(" ").pop()}`}>{(myAtt && ATT_LABEL[myAtt]) ?? (s.status === "PLANNED" ? "Chưa học" : "-")}</Row>}
        </div>
        {!isLearner && isOverdue(s) && (
          <div className="space-y-2 rounded-lg border border-red-300/70 bg-red-50 p-3">
            <div className="font-medium text-red-600">Buổi này đã qua giờ nhưng chưa được điểm danh cũng chưa cho nghỉ</div>
            <ul className="list-disc pl-5 text-xs text-slate-600">
              <li><b>Buổi đã diễn ra:</b> bấm “Điểm danh bù” để ghi nhận. Chỉ buổi đã điểm danh mới được tính công cho giáo viên.</li>
              <li><b>Buổi không diễn ra:</b> mở mục “Đổi lịch / Cho lớp nghỉ” bên dưới và bấm “Cho nghỉ”, buổi sẽ được lùi về cuối khoá.</li>
            </ul>
          </div>
        )}
        {!isLearner && s.status !== "CANCELLED" && (staff || isMine(s)) && (
          <Link href={`/diem-danh/${s.id}`} className="inline-flex h-9 items-center rounded-md bg-orange-600 px-4 font-medium text-white hover:bg-orange-700">{isOverdue(s) ? "Điểm danh bù" : "Mở điểm danh"}</Link>
        )}
        {staff && s.status === "PLANNED" && (
          <details className="group border-t pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-1 py-1.5 font-semibold hover:bg-slate-50">
              <span>Đổi lịch / Cho lớp nghỉ</span>
              <ChevronDown className="size-4 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 space-y-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Đổi lịch buổi này</div>
            <ActionForm action={updateSession} submit="Lưu thay đổi" reset={false} className="grid grid-cols-6 gap-3 [&>button]:col-span-6 [&>button]:!justify-self-end">
              <input type="hidden" name="id" value={s.id} />
              <div className="col-span-6 sm:col-span-2"><Field label="Ngày"><input type="date" name="date" defaultValue={isoDate(s.date)} className={inputCls + " w-full"} /></Field></div>
              <div className="col-span-3 sm:col-span-2"><Field label="Từ giờ"><input type="time" name="startTime" defaultValue={s.startTime} className={inputCls + " w-full"} /></Field></div>
              <div className="col-span-3 sm:col-span-2"><Field label="Đến giờ"><input type="time" name="endTime" defaultValue={s.endTime} className={inputCls + " w-full"} /></Field></div>
              <div className="col-span-6 sm:col-span-3"><Field label="Giáo viên"><select name="teacherId" defaultValue={s.teacherId ?? ""} className={inputCls + " w-full"}><option value="">-- chưa có --</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select></Field></div>
              <div className="col-span-6 sm:col-span-3"><Field label="Phòng"><select name="roomId" defaultValue={s.roomId ?? ""} className={inputCls + " w-full"}><option value="">-- chưa có --</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field></div>
            </ActionForm>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300/70 bg-red-50 p-3">
              <div><div className="font-medium text-red-600">Cho lớp nghỉ buổi này</div><div className="text-xs text-slate-600">Buổi được lùi về cuối khoá và học viên sẽ được báo.</div></div>
              <ActionForm action={cancelSession} submit="Cho nghỉ" danger compact confirmText="Cho lớp nghỉ buổi này? Học viên sẽ được báo." className="inline-flex"><input type="hidden" name="id" value={s.id} /></ActionForm>
            </div>
            </div>
          </details>
        )}
      </div>
    );
  };
  const isOverdue = (s: S) => s.status === "PLANNED" && sessionEnded(s.date, s.endTime);
  const tone = (s: S) => {
    const h = hue(s.classId);
    if (isOverdue(s)) return { background: "#fee2e2", borderLeft: "4px solid #dc2626", color: "#7f1d1d", outline: "1.5px dashed #dc2626", outlineOffset: "-2px" } as React.CSSProperties;
    return s.status === "CANCELLED"
      ? { background: "#f1f5f9", borderLeft: "4px solid #94a3b8", color: "#94a3b8" }
      : { background: `hsl(${h} 85% ${s.status === "DONE" ? 90 : 94}%)`, borderLeft: `4px solid hsl(${h} 65% 42%)`, color: `hsl(${h} 60% 18%)` };
  };

  const tab = (v: string, text: React.ReactNode, Icon: typeof Table2) => (
    <Link href={q({ view: v })} className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border px-3 text-sm md:flex-none ${view === v ? "border-orange-600 bg-orange-600 text-white" : "bg-white hover:bg-slate-50"}`}><Icon className="size-4" />{text}</Link>
  );

  return (
    <div className="space-y-4">
      <Title right={<div className="flex items-center gap-2 text-sm">
        <Link className="inline-flex size-9 items-center justify-center rounded-md border bg-white hover:bg-slate-50" href={q({ w: isoDate(step(-1)) })} aria-label="Trước"><ChevronLeft className="size-4" /></Link>
        <span className="min-w-44 text-center font-medium">{label}</span>
        <Link className="inline-flex size-9 items-center justify-center rounded-md border bg-white hover:bg-slate-50" href={q({ w: isoDate(step(1)) })} aria-label="Sau"><ChevronRight className="size-4" /></Link>
        <Link className="inline-flex h-9 items-center rounded-md bg-orange-600 px-3 font-medium text-white hover:bg-orange-700" href={q({ w: isoDate(today) })}>Hôm nay</Link>
      </div>}>Lịch học{portal?.kid ? <span className="ml-2 text-sm font-normal text-slate-500">· {portal.kid.fullName} ({portal.kid.code})</span> : null}</Title>
      {portal && portal.kids.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-500">Xem của:</span>{portal.kids.map((k) => <Link key={k.id} href={`/lich-hoc?child=${k.id}`} className={`rounded-full border px-3 py-1 ${k.id === portal.kid?.id ? "border-orange-600 bg-orange-600 text-white" : "bg-white hover:bg-slate-50"}`}>{k.fullName}</Link>)}</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {hasMine && (
          <div className="mr-2 flex overflow-hidden rounded-md border bg-white text-sm">
            <Link href={q({ scope: "mine" })} className={`inline-flex h-9 items-center px-3 ${scope === "mine" ? "bg-orange-600 text-white" : "hover:bg-slate-50"}`}>Lịch của tôi</Link>
            <Link href={q({ scope: "all" })} className={`inline-flex h-9 items-center border-l px-3 ${scope === "all" ? "bg-orange-600 text-white" : "hover:bg-slate-50"}`}>Tất cả</Link>
          </div>
        )}
        {tab("matrix", <><span className="md:hidden">Theo ngày</span><span className="hidden md:inline">Theo lớp</span></>, Table2)}{tab("list", "Danh sách", LayoutList)}
        {canFilter && (
          <AutoForm className="contents md:ml-auto md:flex md:flex-wrap md:items-center md:gap-2" resets={{ branch: ["class", "room", "teacher"] }}>
            <input type="hidden" name="view" value={view} /><input type="hidden" name="w" value={isoDate(base)} />{hasMine && <input type="hidden" name="scope" value={scope} />}
            <MobileCollapse active={[fBranch, fRoom, fClass, fTeacher].filter(Boolean).length}>
            <select name="branch" defaultValue={fBranch} className={inputCls} aria-label="Cơ sở"><option value="">Tất cả cơ sở</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <select name="room" defaultValue={fRoom} className={inputCls} aria-label="Phòng"><option value="">Tất cả phòng</option>{rooms.map((r) => <option key={r.id} value={r.id}>{fBranch ? r.name : roomLabel(r)}</option>)}</select>
            <select name="class" defaultValue={fClass} className={inputCls} aria-label="Lớp"><option value="">Tất cả lớp</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select name="teacher" defaultValue={fTeacher} className={inputCls} aria-label="Giáo viên"><option value="">Tất cả giáo viên</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select>
            {(fBranch || fRoom || fClass || fTeacher) && <Link href={`/lich-hoc?view=${view}&w=${isoDate(base)}${hasMine ? `&scope=${scope}` : ""}`} className="inline-flex h-9 items-center rounded-md px-2 text-sm text-slate-500 hover:text-orange-700">Xoá lọc</Link>}
            </MobileCollapse>
          </AutoForm>
        )}
      </div>

      {/* ===== THEO LỚP (ma trận lớp × thứ) ===== */}
      {view === "matrix" && (() => {
        const cols = days.slice(0, 7);
        const rows = [...new Map(sessions.map((x) => [x.classId, x.class])).values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
        const byKey = new Map<string, S[]>();
        for (const x of sessions) { const k = `${x.classId}|${x.date.getTime()}`; byKey.set(k, [...(byKey.get(k) ?? []), x]); }
        const info = new Map(sessions.map((x) => [x.classId, x]));
        const selIso = sp.d && days.some((x) => isoDate(x) === sp.d) ? sp.d : days.some((x) => x.getTime() === today.getTime()) ? isoDate(today) : isoDate(days[0]);
        const selDay = days.find((x) => isoDate(x) === selIso)!;
        const dayList = sessions.filter((x) => isoDate(x.date) === selIso).sort((a, b) => a.startTime.localeCompare(b.startTime));
        const SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
        return (
          <>
          {/* Điện thoại: chọn ngày rồi xem danh sách buổi của ngày đó (thay cho bảng lớp × thứ quá rộng) */}
          <div className="space-y-3 md:hidden">
            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => {
                const n = sessions.filter((x) => x.date.getTime() === d.getTime()).length;
                const on = isoDate(d) === selIso, isToday = d.getTime() === today.getTime();
                return (
                  <Link key={d.getTime()} href={q({ d: isoDate(d) })} scroll={false} className={`flex flex-col items-center rounded-lg border py-1.5 text-center ${on ? "border-orange-600 bg-orange-600 text-white" : isToday ? "border-orange-300 bg-orange-50" : "bg-white"}`}>
                    <span className="text-[11px]">{SHORT[d.getUTCDay()]}</span>
                    <span className="text-base font-bold leading-tight">{d.getUTCDate()}</span>
                    <span className={`text-[10px] ${on ? "text-orange-100" : "text-slate-500"}`}>{n ? `${n} buổi` : "—"}</span>
                  </Link>
                );
              })}
            </div>
            <div className="text-sm font-semibold">{WEEKDAYS[selDay.getUTCDay()]}, {fmtDate(selDay)}{selDay.getTime() === today.getTime() ? " · Hôm nay" : ""} <span className="font-normal text-slate-500">· {dayList.length} buổi</span></div>
            <ul className="space-y-2">
              {dayList.map((s) => {
                const [stLabel, stTone] = isOverdue(s) ? ["Quá giờ", "bg-red-100 text-red-600"] : STATUS_BADGE[s.status];
                const bar = s.status === "CANCELLED" ? "#94a3b8" : isOverdue(s) ? "#dc2626" : `hsl(${hue(s.classId)} 65% 42%)`;
                return (
                  <li key={s.id}>
                    <DialogTrigger title={s.class.name} className="block w-full overflow-hidden rounded-lg border bg-white text-left" style={{ borderLeft: `4px solid ${bar}` }}
                      trigger={<span className="flex items-start justify-between gap-2 p-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold tabular-nums">{s.startTime} – {s.endTime}</span>
                          <span className={`block font-medium ${s.status === "CANCELLED" ? "text-slate-400 line-through" : ""}`}>{s.class.name}</span>
                          <span className="block text-xs text-slate-500">{s.teacher?.fullName ?? "Chưa có GV"} · {roomLabel(s.room) ?? "Chưa có phòng"}</span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${stTone}`}>{stLabel}</span>
                      </span>}>
                      <Detail s={s} />
                    </DialogTrigger>
                  </li>
                );
              })}
              {!dayList.length && <li className="rounded-lg border bg-white py-8 text-center text-sm text-slate-500">Không có buổi học nào trong ngày này.</li>}
            </ul>
          </div>
          <div className="hidden max-h-[calc(100vh-12rem)] overflow-auto rounded-lg border bg-white md:block">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs">
                  <th className="sticky left-0 top-0 z-30 w-56 border-b bg-slate-50 px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500">Lớp ({rows.length})</th>
                  {cols.map((d) => {
                    const isToday = d.getTime() === today.getTime();
                    const n = sessions.filter((x) => x.date.getTime() === d.getTime()).length;
                    return (
                      <th key={d.getTime()} className={`sticky top-0 z-20 border-b border-l px-1 py-1.5 text-center font-normal ${isToday ? "bg-orange-100" : "bg-slate-50"}`}>
                        <div className="block">
                          <div className="text-slate-500">{WEEKDAYS[d.getUTCDay()]}</div>
                          <div className={`text-base font-bold leading-tight ${isToday ? "text-orange-700" : ""}`}>{d.getUTCDate()}/{d.getUTCMonth() + 1}</div>
                          <div className="text-[11px] text-slate-500">{n} buổi</div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const any = info.get(c.id)!;
                  return (
                    <tr key={c.id} className="border-t hover:bg-slate-50/60">
                      <td className="sticky left-0 z-10 border-r bg-white px-3 py-1.5 align-middle">
                        {staff ? <Link href={`/lop-hoc/${c.id}`} className="block truncate font-semibold hover:text-orange-700" title={c.name}>{c.name}</Link> : <span className="block truncate font-semibold" title={c.name}>{c.name}</span>}
                        <div className="truncate text-[11px] text-slate-500">{any.teacher?.fullName ?? "-"} · {roomLabel(any.room) ?? "-"}</div>
                      </td>
                      {cols.map((d) => {
                        const list = byKey.get(`${c.id}|${d.getTime()}`) ?? [];
                        const isToday = d.getTime() === today.getTime();
                        return (
                          <td key={d.getTime()} className={`border-l px-1 py-1 align-middle ${isToday ? "bg-orange-50/60" : ""}`}>
                            {list.map((x) => (
                              <DialogTrigger key={x.id} title={x.class.name} className="mb-0.5 block w-full rounded px-1.5 py-1 text-center text-xs font-medium tabular-nums last:mb-0" style={tone(x)}
                                trigger={<span className={x.status === "CANCELLED" ? "line-through" : ""}>{isOverdue(x) ? "⚠ " : ""}{x.startTime}–{x.endTime}{x.status === "DONE" ? " ✓" : ""}</span>}>
                                <Detail s={x} />
                              </DialogTrigger>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={8} className="py-10 text-center text-slate-500">Không có buổi học nào trong tuần này.</td></tr>}
              </tbody>
            </table>
          </div>
          </>
        );
      })()}

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
                      <div className="min-w-0 flex-1"><div className={`truncate font-medium ${s.status === "CANCELLED" ? "line-through text-slate-400" : ""}`}>{s.class.name}</div><div className="truncate text-xs text-slate-500">{s.teacher?.fullName ?? "Chưa có GV"} · {roomLabel(s.room) ?? "Chưa có phòng"} {isLearner ? "" : `· ${s.class._count.enrollments} HV`}</div></div>
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
    </div>
  );
}
