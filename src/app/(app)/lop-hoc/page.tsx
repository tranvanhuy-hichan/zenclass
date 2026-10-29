import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { inputCls, Table, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { WEEKDAYS, fmtDate } from "@/lib/format";

export default async function Classes({ searchParams }: { searchParams: Promise<{ q?: string; all?: string; page?: string; size?: string }> }) {
  await requireRole(...STAFF_ROLES);
  const sp = await searchParams;
  const { q, all } = sp;
  const pg = getPaging(sp);
  const where = { ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}), ...(all ? {} : { finished: false }) };
  const [total, classes] = await Promise.all([
    db.class.count({ where }),
    db.class.findMany({
      where, orderBy: { name: "asc" }, skip: pg.skip, take: pg.take,
      include: { teacher: true, room: true, schedules: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
    }),
  ]);
  return (
    <div className="space-y-4">
      <Title right={<Link href="/lop-hoc/them" className="inline-flex h-9 items-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700">+ Thêm lớp học</Link>}>Danh sách Lớp học ({total})</Title>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Tìm lớp học..." className={inputCls + " flex-1"} />
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="all" value="1" defaultChecked={!!all} /> Gồm lớp đã kết thúc</label>
        <button className="h-9 rounded-md border bg-white px-4 text-sm">Tìm</button>
      </form>
      <Table head={["Lớp", "Lịch học", "Thời gian", "Giáo viên", "Phòng", "Học viên", "Trạng thái"]}>
        {classes.map((c) => (
          <tr key={c.id}>
            <td><Link href={`/lop-hoc/${c.id}`} className="font-medium text-orange-700 hover:underline">{c.name}</Link></td>
            <td>{c.schedules.map((s) => `${WEEKDAYS[s.weekday]} ${s.startTime}-${s.endTime}`).join(" • ")}</td>
            <td className="whitespace-nowrap">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</td>
            <td>{c.teacher?.fullName ?? "-"}</td><td>{c.room?.name ?? "-"}</td>
            <td>{c._count.enrollments}/{c.maxStudents}</td>
            <td>{c.finished ? <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">Đã kết thúc</span> : <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Đang mở</span>}</td>
          </tr>
        ))}
        {!classes.length && <tr><td colSpan={7} className="py-8 text-center text-slate-500">Chưa có lớp học.</td></tr>}
      </Table>
      <Pagination total={total} page={pg.page} size={pg.size} path="/lop-hoc" params={{ q, all, size: sp.size }} />
    </div>
  );
}
