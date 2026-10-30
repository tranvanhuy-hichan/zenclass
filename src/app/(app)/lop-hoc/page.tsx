import Link from "next/link";
import { AutoForm } from "@/components/auto-form";
import { LayoutGrid, Rows3 } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { Card, inputCls, Table, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { fmtDate, roomLabel } from "@/lib/format";
import { ScheduleChips } from "@/components/schedule-chips";

function Bar({ value, max, tone = "bg-orange-500" }: { value: number; max: number; tone?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${pct}%` }} /></div>;
}

export default async function Classes({ searchParams }: { searchParams: Promise<{ q?: string; all?: string; v?: string; page?: string; size?: string }> }) {
  await requireRole(...STAFF_ROLES);
  const sp = await searchParams;
  const { q, all, v = "table" } = sp;
  const pg = getPaging(sp, v === "cards" ? 12 : 15);
  const where = { ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}), ...(all ? {} : { finished: false }) };
  const [total, classes] = await Promise.all([
    db.class.count({ where }),
    db.class.findMany({
      where, orderBy: { name: "asc" }, skip: pg.skip, take: pg.take,
      include: { teacher: true, room: { include: { branch: true } }, schedules: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
    }),
  ]);
  const doneRows = await db.session.groupBy({ by: ["classId"], where: { status: "DONE", classId: { in: classes.map((c) => c.id) } }, _count: true });
  const done = new Map(doneRows.map((d) => [d.classId, d._count]));
  const params = { q, all, v, size: sp.size };
  const href = (o: Record<string, string>) => `?${new URLSearchParams(Object.entries({ q: q ?? "", all: all ?? "", ...o }).filter(([, x]) => x))}`;
  const status = (finished: boolean) => finished ? <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">Đã kết thúc</span> : <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Đang mở</span>;

  return (
    <div className="space-y-4">
      <Title right={<Link href="/lop-hoc/them" className="inline-flex h-9 items-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700">+ Thêm lớp học</Link>}>Danh sách Lớp học ({total})</Title>
      <AutoForm className="flex flex-wrap gap-2">
        <input type="hidden" name="v" value={v} />
        <input name="q" defaultValue={q} placeholder="Tìm lớp học..." className={inputCls + " min-w-48 flex-1"} />
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="all" value="1" defaultChecked={!!all} /> Gồm lớp đã kết thúc</label>
        <div className="flex overflow-hidden rounded-md border bg-white text-sm">
          <Link href={href({ v: "table" })} className={`inline-flex items-center gap-1 px-3 ${v !== "cards" ? "bg-orange-600 text-white" : "hover:bg-slate-50"}`}><Rows3 className="size-4" /> Bảng</Link>
          <Link href={href({ v: "cards" })} className={`inline-flex items-center gap-1 border-l px-3 ${v === "cards" ? "bg-orange-600 text-white" : "hover:bg-slate-50"}`}><LayoutGrid className="size-4" /> Thẻ</Link>
        </div>
      </AutoForm>

      {v !== "cards" ? (
        <Table head={["Lớp", "Lịch học", "Tiến độ", "Học viên", "Trạng thái"]}>
          {classes.map((c) => {
            const d = done.get(c.id) ?? 0, n = c._count.enrollments;
            return (
              <tr key={c.id} className="align-top [&>td]:!py-3.5">
                <td className="min-w-48">
                  <Link data-row href={`/lop-hoc/${c.id}`} className="text-base font-semibold text-orange-700 hover:underline">{c.name}</Link>
                  <div className="mt-1 text-[13px] text-slate-600">GV: <span className="font-medium" style={{ color: "var(--fg)" }}>{c.teacher?.fullName ?? "chưa có"}</span></div>
                  <div className="text-[13px] text-slate-600">Phòng: <span className="font-medium" style={{ color: "var(--fg)" }}>{roomLabel(c.room) ?? "chưa có"}</span>{c.mode === "ONLINE" ? " · Online" : ""}</div>
                </td>
                <td className="min-w-44"><ScheduleChips list={c.schedules} /></td>
                <td className="min-w-48">
                  <div className="flex items-center justify-between text-xs"><span><b>{d}</b>/{c.totalSessions} buổi</span><span className="text-slate-500">{Math.round((d / Math.max(c.totalSessions, 1)) * 100)}%</span></div>
                  <div className="mt-1"><Bar value={d} max={c.totalSessions} /></div>
                  <div className="mt-1 text-xs text-slate-500">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</div>
                </td>
                <td className="min-w-32">
                  <div className="text-xs"><b className="text-sm">{n}</b>/{c.maxStudents} chỗ</div>
                  <div className="mt-1"><Bar value={n} max={c.maxStudents} tone={n >= c.maxStudents ? "bg-red-500" : "bg-sky-500"} /></div>
                </td>
                <td>{status(c.finished)}</td>
              </tr>
            );
          })}
          {!classes.length && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Chưa có lớp học.</td></tr>}
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => {
            const d = done.get(c.id) ?? 0, n = c._count.enrollments;
            return (
              <Link key={c.id} href={`/lop-hoc/${c.id}`}>
                <Card className="flex h-full flex-col gap-3 transition-colors hover:border-orange-400">
                  <div className="flex items-start justify-between gap-2"><div className="text-base font-semibold">{c.name}</div>{status(c.finished)}</div>
                  <ScheduleChips list={c.schedules} />
                  <div className="text-sm text-slate-600">GV: <b>{c.teacher?.fullName ?? "-"}</b> · Phòng: <b>{roomLabel(c.room) ?? "-"}</b></div>
                  <div className="mt-auto space-y-2 border-t pt-3">
                    <div><div className="flex justify-between text-xs"><span>Tiến độ <b>{d}/{c.totalSessions}</b> buổi</span><span className="text-slate-500">{fmtDate(c.endDate)}</span></div><div className="mt-1"><Bar value={d} max={c.totalSessions} /></div></div>
                    <div><div className="flex justify-between text-xs"><span>Học viên <b>{n}/{c.maxStudents}</b></span></div><div className="mt-1"><Bar value={n} max={c.maxStudents} tone={n >= c.maxStudents ? "bg-red-500" : "bg-sky-500"} /></div></div>
                  </div>
                </Card>
              </Link>
            );
          })}
          {!classes.length && <p className="text-sm text-slate-500">Chưa có lớp học.</p>}
        </div>
      )}
      <Pagination total={total} page={pg.page} size={pg.size} path="/lop-hoc" params={params} />
    </div>
  );
}
