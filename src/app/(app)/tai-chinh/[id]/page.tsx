import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { DialogButton } from "@/components/dialog";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Table, Title } from "@/components/ui";
import { InvoiceView } from "@/components/invoice-view";
import { PrintButton } from "@/components/print-button";
import { fmtDate, fmtMoney } from "@/lib/format";
import { addPayment, refundPayment, voidInvoice } from "../actions";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { student: true, items: true, payments: { orderBy: { paidAt: "asc" } } } });
  if (!inv) notFound();
  const owed = inv.total - inv.paid;
  const M = { CASH: "Tiền mặt", BANK: "Chuyển khoản", QR: "QR" };
  return (
    <div className="space-y-4">
      <Title right={<Link href="/tai-chinh" className="text-sm underline print:hidden">← Tài chính</Link>}>Phiếu {inv.code}</Title>
      <PrintButton />
      <InvoiceView inv={inv} />
      <div className="max-w-md mx-auto space-y-3 print:hidden">
        <Card>
          <h3 className="font-semibold mb-2">Thanh toán (đã thu {fmtMoney(inv.paid)} · còn nợ {fmtMoney(Math.max(owed, 0))})</h3>
          {inv.status !== "VOID" && owed > 0 && (
            <DialogButton label="+ Ghi nhận thu tiền" title="Ghi nhận thu tiền">
            <ActionForm action={addPayment} submit="Ghi nhận" className="flex flex-col gap-3 [&>button]:self-start">
              <input type="hidden" name="invoiceId" value={inv.id} />
              <Field label="Số tiền"><input name="amount" defaultValue={owed} className={inputCls + " w-full"} /></Field>
              <Field label="Hình thức"><select name="method" className={inputCls + " w-full"}><option value="CASH">Tiền mặt</option><option value="BANK">Chuyển khoản</option><option value="QR">QR</option></select></Field>
            </ActionForm>
            </DialogButton>
          )}
          <Table head={["Ngày", "Số tiền", "Hình thức", ""]}>
            {inv.payments.map((p) => (
              <tr key={p.id}><td>{fmtDate(p.paidAt)}</td><td>{fmtMoney(p.amount)}</td><td>{M[p.method]}</td>
                <td>{me.role === "ADMIN" && <ActionForm action={refundPayment} submit="Hoàn" danger confirmText="Hoàn/xoá khoản thu này?" className=""><input type="hidden" name="id" value={p.id} /></ActionForm>}</td></tr>
            ))}
          </Table>
        </Card>
        {inv.status !== "VOID" && inv.payments.length === 0 && <ActionForm action={voidInvoice} submit="Huỷ phiếu" danger confirmText="Huỷ phiếu này?"><input type="hidden" name="id" value={inv.id} /></ActionForm>}
      </div>
    </div>
  );
}
