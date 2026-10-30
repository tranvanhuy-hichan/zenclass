import { db } from "@/lib/db";
import { notifyStudent } from "@/lib/notify";
import { refreshInvoice } from "@/app/(app)/tai-chinh/actions";
import { audit } from "@/lib/audit";

/** Ghi nhận một link PayOS đã thanh toán thành khoản thu của phiếu. Gọi lại an toàn (webhook + kiểm tra định kỳ có thể trùng nhau). */
export async function settlePayLink(linkId: string) {
  const l = await db.payLink.findFirst({ where: { id: linkId } });
  if (!l) return { already: true };
  const flip = await db.payLink.updateMany({ where: { id: l.id, status: { not: "PAID" } }, data: { status: "PAID" } });
  if (flip.count === 0) return { already: true };
  const inv = await db.invoice.findFirst({ where: { id: l.invoiceId } });
  if (!inv) return { already: false };
  try {
    // Tiền đã về thật nên LUÔN ghi nhận, kể cả khi phiếu đã được thu tay hoặc huỷ trong lúc khách đang thanh toán (admin xử lý hoàn tiền sau).
    await db.payment.create({ data: { invoiceId: inv.id, amount: l.amount, method: "BANK", bankTxId: `payos:${l.tenantId}:${l.orderCode}`, receivedBy: "payos" } });
    await refreshInvoice(inv.id);
  } catch (e) {
    await db.payLink.update({ where: { id: l.id }, data: { status: "PENDING" } }); // trả về chờ để lần kiểm tra sau xử lý lại, không để mất tiền
    throw e;
  }
  const after = await db.invoice.findFirst({ where: { id: inv.id } });
  if (after && after.paid > after.total) await audit("payos", "payos-overpay", "Invoice", inv.id, { total: after.total, paid: after.paid });
  await notifyStudent(inv.studentId, "PAYMENT", "Đã nhận học phí", `Đã nhận ${l.amount.toLocaleString("vi-VN")}đ cho phiếu ${inv.code}. Cảm ơn!`);
  return { already: false };
}
