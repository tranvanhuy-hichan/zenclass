import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { Table, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { fmtMoney } from "@/lib/format";

const PAY = { PER_SESSION: "Theo buổi", PER_HOUR: "Theo giờ", FIXED: "Cố định/tháng" } as Record<string, string>;

export default async function Teachers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; size?: string }> }) {
  await requireRole(...STAFF_ROLES);
  const sp = await searchParams;
  const { q } = sp;
  const pg = getPaging(sp);
  const where = q ? { OR: [{ fullName: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q } }, { specialty: { contains: q, mode: "insensitive" as const } }] } : {};
  const [total, list] = await Promise.all([db.teacher.count({ where }), db.teacher.findMany({
    where, orderBy: { fullName: "asc" }, skip: pg.skip, take: pg.take, include: { user: true, _count: { select: { classes: true } } },
  })]);
  return (
    <div className="space-y-4">
      <Title right={<Link href="/giao-vien/them" className="inline-flex h-9 items-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700">+ Thêm giáo viên</Link>}>Giáo viên ({total})</Title>
      <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Tìm theo tên, SĐT, chuyên môn..." className="h-9 flex-1 rounded-md border bg-white px-3 text-sm" /><button className="h-9 rounded-md border bg-white px-4 text-sm">Tìm</button></form>
      <Table head={["Họ tên", "SĐT", "Chuyên môn", "Số lớp", "Lương", "Tài khoản"]}>
        {list.map((t) => (
          <tr key={t.id}>
            <td><Link className="font-medium text-orange-700 hover:underline" href={`/giao-vien/${t.id}`}>{t.fullName}</Link></td>
            <td>{t.phone ?? "-"}</td><td>{t.specialty ?? "-"}</td><td>{t._count.classes}</td>
            <td>{PAY[t.payType]} · {fmtMoney(t.payRate)}</td><td>{t.user?.username ?? "chưa có"}</td>
          </tr>
        ))}
      </Table>
      {!list.length && <p className="text-sm text-slate-500">Chưa có giáo viên.</p>}
      <Pagination total={total} page={pg.page} size={pg.size} path="/giao-vien" params={{ q, size: sp.size }} />
    </div>
  );
}
