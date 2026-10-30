import Link from "next/link";
import { PersonCard } from "@/components/person-card";
import { ViewToggle, pickView } from "@/components/view-toggle";
import { AutoForm } from "@/components/auto-form";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { inputCls, Table, Title } from "@/components/ui";
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
      <AutoForm className="flex gap-2"><input type="hidden" name="v" value={view} /><input name="q" defaultValue={q} placeholder="Tìm theo tên, SĐT, chuyên môn..." className={inputCls + " min-w-0 flex-1"} /><div className="hidden md:block"><ViewToggle path="/giao-vien" params={{ q, size: sp.size }} view={view} /></div></AutoForm>

      {view !== "cards" && (
        <div className="space-y-2 md:hidden">
          {list.map((t) => <div key={t.id}><PersonCard href={`/giao-vien/${t.id}`} name={t.fullName} avatarUrl={t.avatarUrl} tag={t.specialty} badge={t.user && !t.user.isActive ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">TK bị khoá</span> : null} phone={t.phone} email={t.email} stats={[{ label: "Đang dạy", value: `${t._count.classes} lớp` }, { label: "Buổi dạy tháng này", value: `${monthCount.get(t.id) ?? 0} buổi` }, ...(isAdmin ? [{ label: "Mức lương", value: <>{fmtMoney(t.payRate)}<span className="font-normal text-slate-500">{UNIT[t.payType]}</span></> }] : [])]} /></div>)}
          {!list.length && <p className="py-8 text-center text-sm text-slate-500">Không tìm thấy giáo viên.</p>}
        </div>
      )}
      {view === "cards" ? (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-3 2xl:grid-cols-4">
        {list.map((t) => <div key={t.id}><PersonCard href={`/giao-vien/${t.id}`} name={t.fullName} avatarUrl={t.avatarUrl} tag={t.specialty} badge={t.user && !t.user.isActive ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">TK bị khoá</span> : null} phone={t.phone} email={t.email} stats={[{ label: "Đang dạy", value: `${t._count.classes} lớp` }, { label: "Buổi dạy tháng này", value: `${monthCount.get(t.id) ?? 0} buổi` }, ...(isAdmin ? [{ label: "Mức lương", value: <>{fmtMoney(t.payRate)}<span className="font-normal text-slate-500">{UNIT[t.payType]}</span></> }] : [])]} /></div>)}
        {!list.length && <p className="text-sm text-slate-500">Không tìm thấy giáo viên.</p>}
      </div>
      ) : (
        <div className="hidden md:block"><Table head={["Giáo viên", "Chuyên môn", "Điện thoại", "Đang dạy", "Buổi dạy tháng này", ...(isAdmin ? ["Mức lương"] : [])]}>
          {list.map((t) => (
            <tr key={t.id} className="align-middle [&>td]:!py-3">
              <td><Link data-row href={`/giao-vien/${t.id}`} className="font-semibold text-orange-700 hover:underline">{t.fullName}</Link>{t.user && !t.user.isActive && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">TK bị khoá</span>}</td>
              <td>{t.specialty ?? "-"}</td><td>{t.phone ?? "-"}</td><td>{t._count.classes} lớp</td><td>{monthCount.get(t.id) ?? 0} buổi</td>
              {isAdmin && <td className="tabular-nums">{fmtMoney(t.payRate)}<span className="text-slate-500">{UNIT[t.payType]}</span></td>}
            </tr>
          ))}
          {!list.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Không tìm thấy giáo viên.</td></tr>}
        </Table></div>
      )}
      <Pagination total={total} page={pg.page} size={pg.size} path="/giao-vien" params={{ q, size: sp.size, v: sp.v }} />
    </div>
  );
}
