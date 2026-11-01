import Link from "next/link";
import { CalendarClock, CheckCircle2, CircleDollarSign, FileDown, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { DialogButton } from "@/components/dialog";
import { Card, Field, inputCls, Title } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { vietQrUrl } from "@/lib/vietqr";
import { getTenantPayos } from "@/lib/tenant-payos";
import { payInvoice } from "@/app/(app)/tai-chinh/pay-actions";
import { InvoicePayWatcher } from "@/components/invoice-pay-watcher";
import { fmtDate, fmtMoney, moneyToWords, todayUTC } from "@/lib/format";
import { addPayment, refundPayment, voidInvoice } from "@/app/(app)/tai-chinh/actions";

const ST = {
  UNPAID: ["Chưa đóng", "bg-red-100 text-red-600"], PARTIAL: ["Đóng một phần", "bg-yellow-100 text-yellow-800"],
  PAID: ["Đã đóng đủ", "bg-green-100 text-green-800"], VOID: ["Đã huỷ", "bg-slate-200 text-slate-600"],
} as const;
const METHOD = { CASH: "Tiền mặt", BANK: "Chuyển khoản", QR: "Quét QR" } as const;
const V = "flex flex-col gap-3 [&>button]:self-start";

type Inv = NonNullable<Awaited<ReturnType<typeof loadInvoice>>>;

export async function loadInvoice(where: object) {
  return db.invoice.findFirst({ where, include: { student: { include: { parent: true } }, items: true, payments: { orderBy: { paidAt: "asc" } } } });
}

/** Chi tiết phiếu học phí — dùng chung cho quản trị (có thao tác) và học viên/phụ huynh (chỉ xem). */
export async function InvoiceDetail({ inv, staff, admin, back }: { inv: Inv; staff: boolean; admin: boolean; back: { href: string; label: string } }) {
  const st = await getSettings();
  const online = !!(await getTenantPayos());
  const owed = Math.max(inv.total - inv.paid, 0);
  const overdue = !!inv.dueDate && inv.dueDate < todayUTC() && ["UNPAID", "PARTIAL"].includes(inv.status);
  const hasBank = !!(st.bank.account && st.bank.bank);
  const info = `HP ${inv.student.code} ${inv.code}`;
  const [label, tone] = ST[inv.status];

  const Stat = ({ icon: I, label, value, tone = "bg-orange-100 text-orange-700", vt = "" }: { icon: typeof Wallet; label: string; value: React.ReactNode; tone?: string; vt?: string }) => (
    <Card className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4"><span className={`grid size-9 shrink-0 place-items-center rounded-lg sm:size-10 ${tone}`}><I className="size-4 sm:size-5" /></span><div className="min-w-0"><div className="text-xs leading-tight text-slate-500">{label}</div><div className={`truncate text-lg font-bold sm:text-xl ${vt}`}>{value}</div></div></Card>
  );

  return (
    <div className="space-y-4">
      <Title right={
        <>
          {inv.payments.length > 0 && (
            <a href={`/api/hoa-don/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-white px-4 text-sm hover:bg-slate-50"><FileDown className="size-4" />Tải biên lai PDF</a>
          )}
          {staff && inv.status !== "VOID" && owed > 0 && (
            <DialogButton label="+ Ghi nhận thu tiền" title={`Thu tiền · ${inv.code}`}>
              <ActionForm action={addPayment} submit="Ghi nhận" className={V}>
                <input type="hidden" name="invoiceId" value={inv.id} />
                <p className="text-sm text-slate-600">Còn nợ <b>{fmtMoney(owed)}</b>. Có thể thu một phần.</p>
                <Field label="Số tiền (đ)"><input name="amount" defaultValue={owed} inputMode="numeric" className={inputCls + " w-full"} /></Field>
                <Field label="Hình thức"><select name="method" className={inputCls + " w-full"}><option value="CASH">Tiền mặt</option><option value="BANK">Chuyển khoản</option><option value="QR">Quét QR</option></select></Field>
              </ActionForm>
            </DialogButton>
          )}
          <Link href={back.href} className="hidden text-sm underline md:inline">← {back.label}</Link>
        </>
      }>
        Phiếu {inv.code} <span className={`ml-2 rounded-full px-2.5 py-0.5 align-middle text-xs font-medium ${tone}`}>{label}</span>
      </Title>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={Wallet} label="Tổng tiền" value={fmtMoney(inv.total)} />
        <Stat icon={CheckCircle2} label="Đã thu" value={fmtMoney(inv.paid)} tone="bg-green-100 text-green-700" vt="text-green-700" />
        <Stat icon={CircleDollarSign} label="Còn nợ" value={fmtMoney(owed)} tone="bg-red-100 text-red-700" vt={owed ? "text-red-600" : ""} />
        <Stat icon={CalendarClock} label="Hạn đóng" value={inv.dueDate ? fmtDate(inv.dueDate) : "-"} tone="bg-sky-100 text-sky-700" vt={overdue ? "text-red-600" : ""} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {/* ===== Chi tiết phiếu ===== */}
          <Card className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phiếu báo học phí</div>
                <div className="text-xl font-bold">{inv.code}</div>
                <div className="text-sm text-slate-500">{st.name}</div>
              </div>
              <div className="text-right text-sm"><div className="text-slate-500">Ngày tạo</div><b>{fmtDate(inv.issueDate)}</b></div>
            </div>

            <div className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-slate-500">Học viên</div>
                <Link href={`/hoc-vien/${inv.studentId}`} className="font-semibold text-orange-700 hover:underline">{inv.student.fullName}</Link>
                <div className="text-xs text-slate-500">{inv.student.code}{inv.student.gradeLevel ? ` · ${inv.student.gradeLevel}` : ""}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Phụ huynh</div>
                {inv.student.parent ? <><div className="font-medium">{inv.student.parent.fullName}</div><div className="text-xs text-slate-500">{inv.student.parent.phone}</div></> : <span className="text-slate-400">—</span>}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Chi tiết khoản thu</div>
              <div className="divide-y rounded-lg border">
                {inv.items.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <span>{i.description}</span>
                    <b className={`shrink-0 tabular-nums ${i.amount < 0 ? "text-green-700" : ""}`}>{i.amount < 0 ? "-" : ""}{fmtMoney(Math.abs(i.amount))}</b>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 bg-slate-50 px-4 py-3">
                  <span className="font-semibold">Tổng cộng</span><b className="text-lg tabular-nums">{fmtMoney(inv.total)}</b>
                </div>
              </div>
              <div className="mt-2 text-sm"><span className="text-slate-500">Bằng chữ: </span><b>{moneyToWords(inv.total)}</b></div>
              {inv.note && <div className="mt-1 text-sm text-slate-500">Ghi chú: {inv.note}</div>}
            </div>
          </Card>

          {/* ===== Lịch sử thanh toán ===== */}
          <Card className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">Lịch sử thanh toán</h2>
              {staff && inv.status !== "VOID" && inv.payments.length === 0 && (
                <ActionForm action={voidInvoice} submit="Huỷ phiếu" danger compact ghost confirmText="Huỷ phiếu này?" className="inline-flex"><input type="hidden" name="id" value={inv.id} /></ActionForm>
              )}
            </div>
            <ul className="divide-y text-sm">
              {inv.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <span className="grid size-8 place-items-center rounded-full bg-green-100 text-green-700"><CheckCircle2 className="size-4" /></span>
                  <div className="min-w-0 flex-1"><div className="font-semibold tabular-nums text-green-700">+{fmtMoney(p.amount)}</div><div className="text-xs text-slate-500">{METHOD[p.method]} · {fmtDate(p.paidAt)}</div></div>
                  <a href={`/api/hoa-don/${inv.id}/pdf?payment=${p.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-orange-700 hover:underline"><FileDown className="size-3.5" />Biên lai PDF</a>
                  {admin && <ActionForm action={refundPayment} submit="Hoàn" compact ghost danger confirmText="Hoàn/xoá khoản thu này?" className="inline-flex"><input type="hidden" name="id" value={p.id} /></ActionForm>}
                </li>
              ))}
              {!inv.payments.length && <li className="px-4 py-8 text-center text-slate-500">Chưa có khoản thanh toán nào.</li>}
            </ul>
          </Card>
        </div>

        {/* ===== Mã QR chuyển khoản ===== */}
        <aside className="xl:sticky xl:top-20 xl:self-start">
          <Card className="space-y-3 text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Thanh toán bằng QR</div>
            {inv.status === "VOID" ? <p className="py-10 font-semibold text-slate-500">Phiếu đã huỷ</p>
            : owed === 0 ? <div className="py-10"><CheckCircle2 className="mx-auto mb-2 size-12 text-green-600" /><p className="font-semibold text-green-700">Đã thanh toán đủ</p></div>
            : online ? (
              <>
                <div className="text-2xl font-bold text-orange-700">{fmtMoney(owed)}</div>
                <ActionForm action={payInvoice} submit="Thanh toán ngay" reset={false} className="flex flex-col gap-2 [&>button]:w-full [&>button]:!h-11 [&>button]:justify-self-stretch">
                  <input type="hidden" name="invoiceId" value={inv.id} />
                </ActionForm>
                <p className="text-xs text-slate-500">Thanh toán qua QR ngân hàng hoặc ví điện tử bằng PayOS. Hệ thống tự gạch nợ ngay khi nhận được tiền.</p>
                <InvoicePayWatcher invoiceId={inv.id} />
                {hasBank && (
                  <details className="rounded-lg border bg-slate-50 p-3 text-left text-sm">
                    <summary className="cursor-pointer font-medium">Hoặc chuyển khoản thủ công</summary>
                    <div className="mt-2 space-y-2 text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="VietQR" className="mx-auto w-48" src={vietQrUrl({ bank: st.bank.bank, account: st.bank.account, name: st.bank.name, amount: owed, info })} />
                      <div className="text-xs text-slate-600">{st.bank.name} · {st.bank.account} · {st.bank.bank}<br />Nội dung CK: <b>{info}</b></div>
                      <p className="text-xs text-slate-500">Chuyển khoản tay sẽ được trung tâm gạch nợ thủ công.</p>
                    </div>
                  </details>
                )}
              </>
            ) : hasBank ? (
              <>
                <div className="mx-auto w-fit rounded-lg bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="VietQR" className="w-64" src={vietQrUrl({ bank: st.bank.bank, account: st.bank.account, name: st.bank.name, amount: owed, info })} />
                </div>
                <div className="text-2xl font-bold text-orange-700">{fmtMoney(owed)}</div>
                <dl className="space-y-1 rounded-lg bg-slate-50 p-3 text-left text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Ngân hàng</dt><dd className="font-medium">{st.bank.bank}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Số tài khoản</dt><dd className="font-medium tabular-nums">{st.bank.account}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Chủ tài khoản</dt><dd className="font-medium">{st.bank.name}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Nội dung CK</dt><dd className="font-semibold">{info}</dd></div>
                </dl>
                <p className="text-xs text-slate-500">Quét bằng app ngân hàng để tự điền số tiền và nội dung. Hệ thống tự gạch nợ khi nhận được giao dịch (nếu đã bật đối soát).</p>
              </>
            ) : <p className="py-8 text-sm text-slate-500">Chưa cài tài khoản ngân hàng nên chưa có mã QR. {staff ? <>Vào <Link href="/cai-dat" className="text-orange-700 underline">Cài đặt</Link> để khai báo.</> : "Vui lòng liên hệ trung tâm để được hướng dẫn thanh toán."}</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
