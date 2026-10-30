import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, DoorOpen, School, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Table, Tabs } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { DAY_FULL, DAY_ORDER, ScheduleChips, hueOf } from "@/components/schedule-chips";
import { WEEKDAYS, addDays, fmtDate, mondayOf, todayUTC, toMinutes } from "@/lib/format";
import { deleteRoom, updateRoom } from "../actions";

const TABS = [["overview", "Tổng quan"], ["classes", "Lớp sử dụng"], ["schedule", "Lịch sử dụng"], ["settings", "Thông tin & Xoá"]] as const;

export default async function RoomDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; page?: string; size?: string }> }) {
  await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "overview";
  const pg = getPaging(sp, 12);
  const [room, branches] = await Promise.all([db.room.findUnique({ where: { id }, include: { branch: true } }), db.branch.findMany({ orderBy: { name: "asc" } })]);
  if (!room) notFound();

  const today = todayUTC();
  const nowVN = new Date(Date.now() + 7 * 3600_000);
  const nowMin = nowVN.getUTCHours() * 60 + nowVN.getUTCMinutes();
  const wkStart = mondayOf(today), wkEnd = addDays(wkStart, 6);
  const live = { roomId: id, status: { not: "CANCELLED" as const } };
  const [classes, todaySessions, weekCount, classCount] = await Promise.all([
    db.class.findMany({ where: { roomId: id, finished: false }, orderBy: { name: "asc" }, include: { teacher: true, schedules: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } }),
    db.session.findMany({ where: { ...live, date: today }, orderBy: { startTime: "asc" }, include: { class: true, teacher: true } }),
    db.session.count({ where: { ...live, date: { gte: wkStart, lte: wkEnd } } }),
    db.class.count({ where: { roomId: id } }),
  ]);

  const Stat = ({ icon: I, label, value, tone = "bg-orange-100 text-orange-700" }: { icon: typeof Users; label: string; value: React.ReactNode; tone?: string }) => (
    <Card className="flex items-center gap-3 p-4">
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone}`}><I className="size-5" /></span>
      <div className="min-w-0"><div className="truncate text-xs text-slate-500">{label}</div><div className="truncate text-xl font-bold">{value}</div></div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700"><DoorOpen className="size-7" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{room.name}</h1>
            {todaySessions.some((x) => toMinutes(x.startTime) <= nowMin && nowMin < toMinutes(x.endTime)) ? <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"><i className="inline-block size-1.5 animate-pulse rounded-full bg-blue-500" />Đang học</span> : <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${todaySessions.length ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}`}>{todaySessions.length ? `${todaySessions.length} buổi hôm nay` : "Trống hôm nay"}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600"><span className="font-medium text-orange-700">{room.branch?.name ?? "Chưa gán cơ sở"}</span><span className="flex items-center gap-1"><Users className="size-4" /> Sức chứa {room.capacity} chỗ</span></div>
        </div>
        <Link href={`/lich-hoc?room=${id}`} className="inline-flex h-9 items-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700">Xem lịch phòng</Link>
        <Link href="/phong-hoc" className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm hover:bg-slate-50">← Danh sách</Link>
      </Card>

      <Tabs current={`?tab=${tab}`} items={TABS.map(([k, l]) => [`?tab=${k}`, l] as [string, string])} />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat icon={School} label="Lớp đang sử dụng" value={classes.length} />
            <Stat icon={CalendarClock} label="Buổi hôm nay" value={todaySessions.length} tone="bg-sky-100 text-sky-700" />
            <Stat icon={CalendarClock} label="Buổi tuần này" value={weekCount} tone="bg-green-100 text-green-700" />
            <Stat icon={Users} label="Sức chứa" value={`${room.capacity} chỗ`} tone="bg-yellow-100 text-yellow-700" />
          </div>
          <Card className="p-0">
            <div className="border-b px-4 py-3"><h2 className="font-semibold">Lịch sử dụng hôm nay</h2></div>
            <ul className="divide-y text-sm">
              {todaySessions.map((s) => (
                <li key={s.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 ${toMinutes(s.startTime) <= nowMin && nowMin < toMinutes(s.endTime) ? "bg-blue-50" : nowMin >= toMinutes(s.endTime) ? "opacity-50" : ""}`}>
                  <span><b className="tabular-nums">{s.startTime} – {s.endTime}</b> · {s.class.name}{toMinutes(s.startTime) <= nowMin && nowMin < toMinutes(s.endTime) && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"><i className="inline-block size-1.5 animate-pulse rounded-full bg-blue-500" />Đang học</span>}</span>
                  <span className="text-slate-500">{s.teacher?.fullName ?? "-"}</span>
                </li>
              ))}
              {!todaySessions.length && <li className="px-4 py-8 text-center text-slate-500">Hôm nay phòng này trống.</li>}
            </ul>
          </Card>
        </div>
      )}

      {tab === "classes" && (() => {
        // thời khoá biểu cố định theo tuần của phòng
        const byDay = DAY_ORDER.map((wd) => ({
          wd,
          items: classes.flatMap((c) => c.schedules.filter((x) => x.weekday === wd).map((x) => ({ c, start: x.startTime, end: x.endTime }))).sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
        }));
        const clash = (a: { start: string; end: string }, list: { start: string; end: string }[]) => list.some((o) => o !== a && toMinutes(a.start) < toMinutes(o.end) && toMinutes(o.start) < toMinutes(a.end));
        const nClash = byDay.reduce((n, d) => n + d.items.filter((i) => clash(i, d.items)).length, 0);
        return (
          <div className="space-y-4">
            {nClash > 0 && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-600">Có {nClash} khung giờ bị trùng trong phòng này (viền đỏ). Hãy đổi phòng hoặc giờ học của lớp.</div>}
            <div>
              <h2 className="mb-2 font-semibold">Thời khoá biểu tuần của phòng</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {byDay.map(({ wd, items }) => (
                  <div key={wd} className="rounded-lg border bg-white">
                    <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2 text-sm font-semibold">{DAY_FULL[wd]}<span className="text-xs font-normal text-slate-500">{items.length} lớp</span></div>
                    <div className="space-y-1.5 p-2">
                      {items.map((i) => {
                        const bad = clash(i, items);
                        const h = hueOf(i.c.id);
                        return (
                          <Link key={`${i.c.id}-${i.start}`} href={`/lop-hoc/${i.c.id}`} className={`block rounded-md px-2 py-1.5 text-xs ${bad ? "ring-2 ring-red-500" : ""}`} style={{ background: `hsl(${h} 85% 94%)`, borderLeft: `4px solid hsl(${h} 65% 42%)`, color: `hsl(${h} 60% 18%)` }}>
                            <div className="font-semibold tabular-nums">{i.start}–{i.end}</div>
                            <div className="text-[13px] font-semibold leading-tight">{i.c.name}</div>
                            <div className="opacity-80">{i.c.teacher?.fullName ?? "-"}</div>
                          </Link>
                        );
                      })}
                      {!items.length && <div className="py-4 text-center text-xs text-slate-400">Trống</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-2 font-semibold">Danh sách lớp ({classes.length})</h2>
              <Table head={["Lớp", "Giáo viên", "Lịch học", "Học viên"]}>
                {classes.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td><Link data-row href={`/lop-hoc/${c.id}`} className="font-medium text-orange-700 hover:underline">{c.name}</Link></td>
                    <td>{c.teacher?.fullName ?? "-"}</td>
                    <td><ScheduleChips list={c.schedules} /></td>
                    <td>{c._count.enrollments}/{c.maxStudents}</td>
                  </tr>
                ))}
                {!classes.length && <tr><td colSpan={4} className="py-8 text-center text-slate-500">Chưa có lớp nào dùng phòng này.</td></tr>}
              </Table>
            </div>
          </div>
        );
      })()}

      {tab === "schedule" && await (async () => {
        const where = { ...live, date: { gte: today } };
        const [total, list] = await Promise.all([
          db.session.count({ where }),
          db.session.findMany({ where, orderBy: [{ date: "asc" }, { startTime: "asc" }], skip: pg.skip, take: pg.take, include: { class: true, teacher: true } }),
        ]);
        return (
          <div className="space-y-3">
            <Table head={["Ngày", "Giờ", "Lớp", "Giáo viên"]}>
              {list.map((s) => (
                <tr key={s.id} className={s.date.getTime() === today.getTime() ? "bg-orange-50" : ""}>
                  <td className="whitespace-nowrap">{WEEKDAYS[s.date.getUTCDay()]}, {fmtDate(s.date)}</td><td className="whitespace-nowrap">{s.startTime}-{s.endTime}</td>
                  <td>{s.class.name}</td><td>{s.teacher?.fullName ?? "-"}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={4} className="py-8 text-center text-slate-500">Không có buổi nào sắp tới.</td></tr>}
            </Table>
            <Pagination total={total} page={pg.page} size={pg.size} path={`/phong-hoc/${id}`} params={{ tab: "schedule", size: sp.size }} />
          </div>
        );
      })()}

      {tab === "settings" && (
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-semibold">Thông tin phòng</h2>
            <ActionForm action={updateRoom} submit="Lưu thông tin" reset={false} className="grid max-w-2xl grid-cols-1 items-end gap-3 sm:grid-cols-2 [&>button]:justify-self-start">
              <input type="hidden" name="id" value={room.id} />
              <Field label="Cơ sở"><select name="branchId" defaultValue={room.branchId ?? ""} className={inputCls + " w-full"} required><option value="">-- chọn cơ sở --</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
              <Field label="Tên phòng"><input name="name" defaultValue={room.name} className={inputCls + " w-full"} required /></Field>
              <Field label="Sức chứa"><input name="capacity" defaultValue={room.capacity} className={inputCls + " w-full"} /></Field>
            </ActionForm>
          </Card>
          <Card className="space-y-2 border-red-300">
            <h2 className="font-semibold text-red-600">Xoá phòng</h2>
            <p className="text-sm text-slate-600">Phòng đang gán cho lớp ({classCount} lớp) thì không xoá được. Hãy chuyển các lớp sang phòng khác trước. Các buổi học cũ của phòng sẽ được gỡ khỏi phòng này.</p>
            <ActionForm action={deleteRoom} submit="Xoá phòng này" danger confirmText={`Xoá phòng ${room.name}?`} className="inline-flex"><input type="hidden" name="id" value={room.id} /></ActionForm>
          </Card>
        </div>
      )}
    </div>
  );
}
