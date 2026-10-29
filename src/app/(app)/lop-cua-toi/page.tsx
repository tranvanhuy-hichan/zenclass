import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { Table, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { WEEKDAYS } from "@/lib/format";

export default async function MyClasses({ searchParams }: { searchParams: Promise<{ page?: string; size?: string }> }) {
  const me = await requireRole("TEACHER", "ADMIN", "STAFF");
  const sp = await searchParams;
  const pg = getPaging(sp);
  const where = { finished: false, ...(me.role === "TEACHER" ? { OR: [{ teacher: { userId: me.id } }, { assistant: { userId: me.id } }] } : {}) };
  const [total, classes] = await Promise.all([
    db.class.count({ where }),
    db.class.findMany({
      where, orderBy: { name: "asc" }, skip: pg.skip, take: pg.take,
      include: { schedules: true, gradeTemplate: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
    }),
  ]);
  return (
    <div className="space-y-4">
      <Title>Lớp của tôi ({total})</Title>
      <Table head={["Lớp", "Lịch học", "Học viên", "Bộ điểm", ""]}>
        {classes.map((c) => (
          <tr key={c.id}>
            <td className="font-medium">{c.name}</td>
            <td>{c.schedules.map((s) => `${WEEKDAYS[s.weekday]} ${s.startTime}-${s.endTime}`).join(" • ")}</td>
            <td>{c._count.enrollments}</td>
            <td>{c.gradeTemplate?.name ?? "chưa chọn"}</td>
            <td>{c.gradeTemplate && <Link href={`/lop-hoc/${c.id}/diem`} className="inline-flex h-8 items-center rounded-md bg-orange-600 px-3 text-sm text-white hover:bg-orange-700">Nhập điểm</Link>}</td>
          </tr>
        ))}
        {!classes.length && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Chưa có lớp nào.</td></tr>}
      </Table>
      <Pagination total={total} page={pg.page} size={pg.size} path="/lop-cua-toi" params={{ size: sp.size }} />
    </div>
  );
}
