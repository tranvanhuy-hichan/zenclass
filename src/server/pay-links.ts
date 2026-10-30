import { db } from "@/lib/db";
import { notifyStudent } from "@/lib/notify";
import { refreshInvoice } from "@/app/(app)/tai-chinh/actions";

/** Ghi nhận một link PayOS đã thanh toán thành khoản thu của phiếu. Gọi lại an toàn (webhook + kiểm tra định kỳ có thể trùng nhau). */
export async function settlePayLink(linkId: string) {
  const l = await db.payLink.findFirst({ where: { id: linkId } });
  if (!l) return { already: true };
  const flip = await db.payLink.updateMany({ where: { id: l.id, status: { not: "PAID" } }, data: { status: "PAID" } });
  if (flip.count === 0) return { already: true };
  const inv = await db.invoice.findFirst({ where: { id: l.invoiceId } });
  if (!inv || inv.status === "VOID") return { already: false };
  await db.payment.create({ data: { invoiceId: inv.id, amount: l.amount, method: "BANK", bankTxId: `payos:${l.tenantId}:${l.orderCode}`, receivedBy: "payos" } });
  await refreshInvoice(inv.id);
  await notifyStudent(inv.studentId, "PAYMENT", "Đã nhận học phí", `Đã nhận ${l.amount.toLocaleString("vi-VN")}đ cho phiếu ${inv.code}. Cảm ơn!`);
  return { already: false };
}
