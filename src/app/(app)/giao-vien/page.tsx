import Link from "next/link";
import { ViewToggle, pickView } from "@/components/view-toggle";
import { AutoForm } from "@/components/auto-form";
import { Mail, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { Card, inputCls, Table, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { fmtMoney } from "@/lib/format";
import { monthRange } from "@/server/payroll";

const UNIT: Record<string, string> = { PER_SESSION: "/buổi", PER_HOUR: "/giờ", FIXED: "/tháng" };

export default async function Teachers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; size?: string; v?: string }> }) {
  const me = await requireRole(...STAFF_ROLES);
  const isAdmin = me.role === "ADMIN";
  const sp = await searchParams;
  const { q } = sp;
  const view = pickView(sp.v, "cards");
  const pg = getPaging(sp, 12);
  const where = q ? { OR: [{ fullName: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q } }, { specialty: { contains: q, mode: "insensitive" as const } }] } : {};
  const [total, list] = await Promise.all([
    db.teacher.count({ where }),
    db.teacher.findMany({ where, orderBy: { fullName: "asc" }, skip: pg.skip, take: pg.take, include: { user: true, _count: { select: { classes: { where: { finished: false } } } } } }),
  ]);
  const nowVN = new Date(Date.now() + 7 * 3600_000);
  const { from, to } = monthRange(`${nowVN.getUTCFullYear()}-${String(nowVN.getUTCMonth() + 1).padStart(2, "0")}`);
  const taught = await db.session.groupBy({ by: ["teacherId"], where: { status: "DONE", date: { gte: from, lt: to }, teacherId: { in: list.map((t) => t.id) } }, _count: true });
  const monthCount = new Map(taught.map((x) => [x.teacherId, x._count]));
  return (
    <div className="space-y-4">
      <Title right={<Link href="/giao-vien/them" className="inline-flex h-9 items-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700">+ Thêm giáo viên</Link>}>Giáo viên ({total})</Title>
      <AutoForm className="flex gap-2"><input type="hidden" name="v" value={view} /><input name="q" defaultValue={q} placeholder="Tìm theo tên, SĐT, chuyên môn..." className={inputCls + " flex-1"} /><ViewToggle path="/giao-vien" params={{ q, size: sp.size }} view={view} /></AutoForm>

      {view === "cards" ? (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {list.map((t) => (
          <Link key={t.id} href={`/giao-vien/${t.id}`}>
            <Card className="flex h-full flex-col gap-3 transition-colors hover:border-orange-400">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {t.avatarUrl ? <img src={t.avatarUrl} alt="" className="size-12 rounded-full object-cover" /> : <span className="grid size-12 shrink-0 place-items-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">{t.fullName.split(" ").pop()?.[0]}</span>}
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold">{t.fullName}</div>
                  {t.specialty ? <span className="inline-block max-w-full truncate rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">{t.specialty}</span> : <span className="text-xs text-slate-400">Chưa có chuyên môn</span>}
                </div>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <div className="flex items-center gap-2"><Phone className="size-4 shrink-0 text-slate-400" />{t.phone ?? "-"}</div>
                <div className="flex items-center gap-2 truncate"><Mail className="size-4 shrink-0 text-slate-400" /><span className="truncate">{t.email ?? "-"}</span></div>
              </div>
              <div className="mt-auto grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-3 text-sm">
                <div><div className="text-xs text-slate-500">Đang dạy</div><b>{t._count.classes}</b> lớp</div>
                <div><div className="text-xs text-slate-500">Buổi dạy tháng này</div><b>{monthCount.get(t.id) ?? 0}</b> buổi</div>
                {isAdmin && <div className="col-span-2"><div className="text-xs text-slate-500">Mức lương</div><b>{fmtMoney(t.payRate)}</b><span className="text-slate-500">{UNIT[t.payType]}</span>
                  {t.user && !t.user.isActive && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">TK bị khoá</span>}
                </div>}
              </div>
            </Card>
          </Link>
        ))}
        {!list.length && <p className="text-sm text-slate-500">Không tìm thấy giáo viên.</p>}
      </div>
      ) : (
        <Table head={["Giáo viên", "Chuyên môn", "Điện thoại", "Đang dạy", "Buổi dạy tháng này", ...(isAdmin ? ["Mức lương"] : [])]}>
          {list.map((t) => (
            <tr key={t.id} className="align-middle [&>td]:!py-3">
              <td><Link data-row href={`/giao-vien/${t.id}`} className="font-semibold text-orange-700 hover:underline">{t.fullName}</Link>{t.user && !t.user.isActive && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">TK bị khoá</span>}</td>
              <td>{t.specialty ?? "-"}</td><td>{t.phone ?? "-"}</td><td>{t._count.classes} lớp</td><td>{monthCount.get(t.id) ?? 0} buổi</td>
              {isAdmin && <td className="tabular-nums">{fmtMoney(t.payRate)}<span className="text-slate-500">{UNIT[t.payType]}</span></td>}
            </tr>
          ))}
          {!list.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Không tìm thấy giáo viên.</td></tr>}
        </Table>
      )}
      <Pagination total={total} page={pg.page} size={pg.size} path="/giao-vien" params={{ q, size: sp.size, v: sp.v }} />
    </div>
  );
}
