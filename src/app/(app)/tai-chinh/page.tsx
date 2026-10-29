import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { DialogButton } from "@/components/dialog";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Table, Tabs, Title } from "@/components/ui";
import { fmtDate, fmtMoney, isoDate, todayUTC } from "@/lib/format";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { addExpense, createInvoice, deleteExpense } from "./actions";

const STL = { UNPAID: "Chưa đóng", PARTIAL: "Đóng một phần", PAID: "Đã đóng", VOID: "Huỷ" } as const;

export default async function Finance({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; page?: string; size?: string }> }) {
  const me = await requireRole(...STAFF_ROLES);
  const sp = await searchParams;
  const { tab = "debt", q } = sp;
  const pg = getPaging(sp);
  const today = todayUTC();
  const [students, classes] = await Promise.all([
    db.student.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, code: true } }),
    db.class.findMany({ where: { finished: false }, orderBy: { name: "asc" }, select: { name: true, tuitionFee: true } }),
  ]);
  const where = {
    ...(tab === "debt" ? { status: { in: ["UNPAID", "PARTIAL"] as ("UNPAID" | "PARTIAL")[] } } : {}),
    ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" as const } }, { student: { fullName: { contains: q, mode: "insensitive" as const } } }, { student: { code: { contains: q, mode: "insensitive" as const } } }] } : {}),
  };
  const isExp = tab === "expense";
  const [total, invoices, sums, expTotal, expenses] = await Promise.all([
    isExp ? 0 : db.invoice.count({ where }),
    isExp ? [] : db.invoice.findMany({ where, orderBy: { issueDate: "desc" }, skip: pg.skip, take: pg.take, include: { student: true } }),
    isExp ? null : db.invoice.aggregate({ where: { ...where, status: tab === "debt" ? where.status : { not: "VOID" } }, _sum: { total: true, paid: true } }),
    isExp ? db.expense.count() : 0,
    isExp ? db.expense.findMany({ orderBy: { date: "desc" }, skip: pg.skip, take: pg.take }) : [],
  ]);
  const debt = (sums?._sum.total ?? 0) - (sums?._sum.paid ?? 0);

  return (
    <div className="space-y-4">
      <Title right={<>
        <a href="/api/export/invoices" className="text-sm underline">Xuất CSV</a>
        {tab !== "expense" ? <DialogButton wide label="+ Tạo phiếu thu" title="Tạo phiếu báo học phí"><ActionForm action={createInvoice} submit="Tạo phiếu" className="flex flex-col gap-3 [&>button]:self-start">
              <Field label="Học viên"><select name="studentId" className={inputCls} required><option value="">-- chọn --</option>{students.map((s) => <option key={s.id} value={s.id}>{s.fullName} ({s.code})</option>)}</select></Field>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-2">
                  <input name="desc" list="fees" className={inputCls + " flex-1"} placeholder={i === 0 ? "Khoản thu (vd: Học phí IELTS B1 - Khoá 1/7)" : "Khoản thu khác"} />
                  <input name="amount" inputMode="numeric" className={inputCls + " w-full"} placeholder="Số tiền" />
                </div>
              ))}
              <datalist id="fees">{classes.map((c) => <option key={c.name} value={`Học phí ${c.name}`} />)}</datalist>
              <div className="flex gap-2"><Field label="Hạn đóng"><input type="date" name="dueDate" defaultValue={isoDate(new Date(today.getTime() + 7 * 86400_000))} className={inputCls} /></Field><Field label="Ghi chú"><input name="note" className={inputCls} /></Field></div>
              <p className="text-xs text-gray-500">Gợi ý học phí: {classes.filter((c) => c.tuitionFee).map((c) => `${c.name}: ${fmtMoney(c.tuitionFee)}`).join(" • ")}</p>
            </ActionForm></DialogButton>
        : <DialogButton label="+ Thêm khoản chi" title="Thêm khoản chi"><ActionForm action={addExpense} submit="Thêm khoản chi" className="flex flex-col gap-3 [&>button]:self-start">
              <Field label="Hạng mục"><input name="category" list="cats" className={inputCls + " w-full"} required /></Field>
              <datalist id="cats">{["Lương giáo viên", "Thuê mặt bằng", "Điện nước", "Marketing", "Thiết bị", "Khác"].map((c) => <option key={c} value={c} />)}</datalist>
              <Field label="Số tiền"><input name="amount" inputMode="numeric" className={inputCls + " w-full"} required /></Field>
              <Field label="Ngày"><input type="date" name="date" defaultValue={isoDate(today)} className={inputCls + " w-full"} /></Field>
              <Field label="Ghi chú"><input name="note" className={inputCls + " w-full"} /></Field>
            </ActionForm></DialogButton>}
      </>}>Tài chính</Title>
      <Tabs current={`?tab=${tab}`} items={[["?tab=debt", "Công nợ"], ["?tab=all", "Tất cả phiếu"], ["?tab=expense", "Chi phí"]]} />
      {tab !== "expense" && (
        <>
          <form className="flex gap-2"><input type="hidden" name="tab" value={tab} /><input name="q" defaultValue={q} placeholder="Tìm mã phiếu / học viên..." className={inputCls + " flex-1"} /><button className="px-4 rounded-lg border bg-white text-sm">Tìm</button></form>
          {tab === "debt" && <Card className="text-sm">Tổng công nợ: <b className="text-red-600">{fmtMoney(debt)}</b> ({total} phiếu)</Card>}
          <Table head={["Phiếu", "Học viên", "Ngày", "Hạn", "Tổng", "Còn nợ", "Trạng thái"]}>
            {invoices.map((i) => {
              const late = i.dueDate && i.dueDate < today && ["UNPAID", "PARTIAL"].includes(i.status);
              return (
                <tr key={i.id} className={late ? "bg-red-50" : ""}>
                  <td><Link className="underline" href={`/tai-chinh/${i.id}`}>{i.code}</Link></td>
                  <td>{i.student.fullName}</td><td>{fmtDate(i.issueDate)}</td><td>{fmtDate(i.dueDate)}{late && " ⚠"}</td>
                  <td>{fmtMoney(i.total)}</td><td>{fmtMoney(i.status === "VOID" ? 0 : i.total - i.paid)}</td><td>{STL[i.status]}</td>
                </tr>
              );
            })}
          </Table>
          <Pagination total={total} page={pg.page} size={pg.size} path="/tai-chinh" params={{ tab, q, size: sp.size }} />
        </>
      )}
      {tab === "expense" && (
        <>
          <Table head={["Ngày", "Hạng mục", "Số tiền", "Ghi chú", ""]}>
            {expenses.map((e) => (
              <tr key={e.id}><td>{fmtDate(e.date)}</td><td>{e.category}</td><td>{fmtMoney(e.amount)}</td><td>{e.note}</td>
                <td>{me.role === "ADMIN" && <ActionForm action={deleteExpense} submit="Xoá" danger confirmText="Xoá khoản chi?" className=""><input type="hidden" name="id" value={e.id} /></ActionForm>}</td></tr>
            ))}
          </Table>
          <Pagination total={expTotal} page={pg.page} size={pg.size} path="/tai-chinh" params={{ tab, size: sp.size }} />
        </>
      )}
    </div>
  );
}
