import Link from "next/link";
import { AutoForm } from "@/components/auto-form";
import { CalendarClock, Info, Repeat } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { DialogButton } from "@/components/dialog";
import { Card, Field, inputCls, Tabs, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { WEEKDAYS, addDays, fmtDate, fmtMoney, isoDate, overlaps, parseDate, todayUTC, roomLabel } from "@/lib/format";
import { assignRange, assignSubstitute, revertSubstitute } from "./actions";

const V = "flex flex-col gap-3 [&>button]:self-start";
const ic = inputCls + " w-full";

export default async function Assignment({ searchParams }: { searchParams: Promise<{ tab?: string; from?: string; to?: string; classId?: string; teacherId?: string; page?: string; size?: string }> }) {
  const me = await requireRole(...STAFF_ROLES);
  const isAdmin = me.role === "ADMIN";
  const sp = await searchParams;
  const tab = sp.tab === "history" ? "history" : "upcoming";
  const pg = getPaging(sp, 15);
  const today = todayUTC();
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? parseDate(sp.from) : today;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? parseDate(sp.to) : addDays(today, 13);

  const [teachers, classes] = await Promise.all([
    db.teacher.findMany({ orderBy: { fullName: "asc" } }),
    db.class.findMany({ where: { finished: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const tName = new Map(teachers.map((t) => [t.id, t.fullName]));

  const where = tab === "history"
    ? { originalTeacherId: { not: null }, ...(sp.classId ? { classId: sp.classId } : {}), ...(sp.teacherId ? { teacherId: sp.teacherId } : {}) }
    : { status: "PLANNED" as const, date: { gte: from, lte: to }, ...(sp.classId ? { classId: sp.classId } : {}), ...(sp.teacherId ? { teacherId: sp.teacherId } : {}) };
  const [total, rows, subCount] = await Promise.all([
    db.session.count({ where }),
    db.session.findMany({ where, orderBy: tab === "history" ? [{ date: "desc" }, { startTime: "asc" }] : [{ date: "asc" }, { startTime: "asc" }], skip: pg.skip, take: pg.take, include: { class: true, room: { include: { branch: true } }, teacher: true } }),
    db.session.count({ where: { originalTeacherId: { not: null }, status: "PLANNED", date: { gte: today } } }),
  ]);

  // giáo viên nào đang bận vào các ngày hiển thị (để cảnh báo trong ô chọn)
  const dates = [...new Set(rows.map((r) => r.date.getTime()))].map((t) => new Date(t));
  const day = dates.length ? await db.session.findMany({ where: { date: { in: dates }, status: { not: "CANCELLED" }, teacherId: { not: null } }, include: { class: true } }) : [];
  const busyFor = (r: (typeof rows)[number]) => {
    const m = new Map<string, string>();
    for (const o of day) if (o.id !== r.id && o.date.getTime() === r.date.getTime() && o.teacherId && overlaps(r.startTime, r.endTime, o.startTime, o.endTime)) m.set(o.teacherId, `${o.startTime}-${o.endTime} ${o.class.name}`);
    return m;
  };

  const q = (o: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ tab, from: isoDate(from), to: isoDate(to), classId: sp.classId, teacherId: sp.teacherId, ...o }).filter(([, v]) => v) as [string, string][])}`;
  const range = (days: number) => ({ from: isoDate(today), to: isoDate(addDays(today, days)) });
  const chips: [string, number][] = [["Hôm nay", 0], ["7 ngày", 6], ["14 ngày", 13], ["30 ngày", 29]];
  const activeChip = chips.find(([, d]) => isoDate(from) === isoDate(today) && isoDate(to) === isoDate(addDays(today, d)))?.[0];

  // gom theo ngày
  const groups = new Map<number, typeof rows>();
  for (const r of rows) groups.set(r.date.getTime(), [...(groups.get(r.date.getTime()) ?? []), r]);
  const initial = (n?: string | null) => (n ?? "?").split(" ").pop()?.[0] ?? "?";

  return (
    <div className="space-y-4">
      <Title right={
        <DialogButton wide label="+ Dạy thế theo khoảng ngày" title="Phân công dạy thế cho cả lớp trong khoảng ngày">
          <ActionForm action={assignRange} submit="Phân công" className={V}>
            <p className="text-sm text-slate-600">Dùng khi giáo viên nghỉ phép/ốm nhiều ngày: tất cả buổi <b>chưa dạy</b> của lớp trong khoảng này sẽ giao cho giáo viên dạy thế (bỏ qua buổi bị trùng giờ).</p>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Lớp"><select name="classId" className={ic} required><option value="">-- chọn lớp --</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Giáo viên dạy thế"><select name="teacherId" className={ic} required><option value="">-- chọn giáo viên --</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}{t.specialty ? ` · ${t.specialty}` : ""}</option>)}</select></Field>
              <Field label="Từ ngày"><input type="date" name="from" defaultValue={isoDate(today)} className={ic} required /></Field>
              <Field label="Đến ngày"><input type="date" name="to" defaultValue={isoDate(addDays(today, 6))} className={ic} required /></Field>
              <Field label="Lý do"><input name="reason" className={ic} placeholder="vd: GV chính nghỉ phép" /></Field>
              {isAdmin && <Field label="Thù lao riêng mỗi buổi (đ) — để trống = theo đơn giá dạy thế"><input name="payAmount" inputMode="numeric" className={ic} /></Field>}
            </div>
          </ActionForm>
        </DialogButton>
      }>Phân công lịch dạy</Title>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-lg bg-orange-100 text-orange-700"><CalendarClock className="size-5" /></span><div><div className="text-xs text-slate-500">{tab === "history" ? "Tổng buổi dạy thế" : "Buổi trong khoảng đã chọn"}</div><div className="text-xl font-bold">{total}</div></div></Card>
        <Card className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-lg bg-sky-100 text-sky-700"><Repeat className="size-5" /></span><div><div className="text-xs text-slate-500">Buổi dạy thế sắp tới</div><div className="text-xl font-bold">{subCount}</div></div></Card>
        {isAdmin ? <Card className="p-4 text-sm">
          <details>
            <summary className="flex cursor-pointer list-none items-center gap-2 font-medium"><Info className="size-4 text-orange-700" /> Cách tính lương dạy thế</summary>
            <div className="mt-2 space-y-1 text-slate-600">
              <p>Giáo viên dạy thế được <b>tính lương buổi đó</b>; giáo viên gốc không bị tính.</p>
              <p>Đơn giá: <b>thù lao riêng của buổi</b> → <b>đơn giá dạy thế</b> trong hồ sơ giáo viên → mức lương thường.</p>
            </div>
          </details>
        </Card> : <div />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs current={`?tab=${tab}`} items={[["?tab=upcoming", "Buổi sắp tới"], ["?tab=history", "Lịch sử dạy thế"]]} />
      </div>

      <Card className="p-3">
        <AutoForm className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value={tab} />
          {tab === "upcoming" && (
            <>
              <div className="flex gap-1">
                {chips.map(([l, d]) => <Link key={l} href={q({ ...range(d) })} className={`inline-flex h-9 items-center rounded-full border px-3 text-sm ${activeChip === l ? "border-orange-600 bg-orange-600 text-white" : "bg-white hover:bg-slate-50"}`}>{l}</Link>)}
              </div>
              <Field label="Từ ngày"><input type="date" name="from" defaultValue={isoDate(from)} className={inputCls} /></Field>
              <Field label="Đến ngày"><input type="date" name="to" defaultValue={isoDate(to)} className={inputCls} /></Field>
            </>
          )}
          <Field label="Lớp"><select name="classId" defaultValue={sp.classId ?? ""} className={inputCls}><option value="">Tất cả lớp</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Giáo viên đang dạy"><select name="teacherId" defaultValue={sp.teacherId ?? ""} className={inputCls}><option value="">Tất cả</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select></Field>
        </AutoForm>
      </Card>

      <div className="space-y-3">
        {[...groups.entries()].map(([t, list]) => {
          const d = new Date(t);
          const isToday = t === today.getTime();
          return (
            <div key={t} className="overflow-hidden rounded-lg border bg-white">
              <div className={`flex items-center justify-between px-4 py-2 text-sm font-semibold ${isToday ? "bg-orange-100 text-orange-800" : "bg-slate-50"}`}>
                <span>{WEEKDAYS[d.getUTCDay()]}, {fmtDate(d)}{isToday && " · Hôm nay"}</span><span className="font-normal text-slate-500">{list.length} buổi</span>
              </div>
              <ul className="divide-y">
                {list.map((r) => {
                  const busy = busyFor(r);
                  const orig = r.originalTeacherId;
                  return (
                    <li key={r.id} className={`grid items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[112px_minmax(0,1fr)_280px_190px] ${orig ? "bg-sky-50/50 shadow-[inset_4px_0_0_0_#0ea5e9]" : ""}`}>
                      <div className="text-sm font-semibold tabular-nums">{r.startTime} – {r.endTime}</div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.class.name}</div>
                        <div className="text-xs text-slate-500">Phòng {roomLabel(r.room) ?? "-"}</div>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${orig ? "bg-sky-100 text-sky-700" : "bg-orange-100 text-orange-700"}`}>{initial(r.teacher?.fullName)}</span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{r.teacher?.fullName ?? "Chưa có GV"}</div>
                          {orig ? <div className="truncate text-xs text-sky-700">Dạy thế cho {tName.get(orig) ?? "?"}{r.substituteReason ? ` · ${r.substituteReason}` : ""}{isAdmin && r.payAmount != null ? ` · ${fmtMoney(r.payAmount)}` : ""}</div> : <div className="text-xs text-slate-400">Giáo viên phụ trách</div>}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1.5">
                        {r.status === "PLANNED" ? (
                          <>
                            <DialogButton variant="secondary" size="sm" label={orig ? "Đổi người" : "Dạy thế"} title={`${r.class.name} · ${fmtDate(r.date)} ${r.startTime}-${r.endTime}`}>
                              <ActionForm action={assignSubstitute} submit="Xác nhận phân công" className={V}>
                                <input type="hidden" name="sessionId" value={r.id} />
                                <Field label="Giáo viên dạy thế"><select name="teacherId" className={ic} required>
                                  <option value="">-- chọn giáo viên --</option>
                                  {teachers.filter((x) => x.id !== r.teacherId).map((x) => <option key={x.id} value={x.id} disabled={busy.has(x.id)}>{x.fullName}{x.specialty ? ` · ${x.specialty}` : ""}{busy.has(x.id) ? ` — bận: ${busy.get(x.id)}` : ""}</option>)}
                                </select></Field>
                                <Field label="Lý do"><input name="reason" defaultValue={r.substituteReason ?? ""} className={ic} placeholder="vd: GV chính bị ốm" /></Field>
                                {isAdmin && <Field label="Thù lao riêng cho buổi này (đ) — để trống = theo đơn giá dạy thế"><input name="payAmount" defaultValue={r.payAmount ?? ""} inputMode="numeric" className={ic} /></Field>}
                                <p className="text-xs text-slate-500">Giáo viên dạy thế và giáo viên gốc đều nhận thông báo. Giáo viên bận cùng giờ không chọn được.</p>
                              </ActionForm>
                            </DialogButton>
                            {orig && <ActionForm action={revertSubstitute} submit="Hoàn tác" compact ghost danger confirmText="Trả buổi này về giáo viên gốc?" className="inline-flex"><input type="hidden" name="id" value={r.id} /></ActionForm>}
                          </>
                        ) : <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Đã dạy</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {!rows.length && <p className="rounded-lg border bg-white py-12 text-center text-sm text-slate-500">{tab === "history" ? "Chưa có buổi dạy thế nào." : "Không có buổi nào trong khoảng này."}</p>}
      </div>
      <Pagination total={total} page={pg.page} size={pg.size} path="/phan-cong" params={{ tab, from: tab === "upcoming" ? isoDate(from) : undefined, to: tab === "upcoming" ? isoDate(to) : undefined, classId: sp.classId, teacherId: sp.teacherId, size: sp.size }} />
    </div>
  );
}
