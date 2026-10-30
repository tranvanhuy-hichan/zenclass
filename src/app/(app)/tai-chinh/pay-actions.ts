"use server";
import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getMe, STAFF_ROLES } from "@/lib/guard";
import { wrap, str } from "@/lib/action";
import { appUrl, cancelPaymentLink, createPaymentLink, getPaymentInfo } from "@/lib/payos";
import { getTenantPayos } from "@/lib/tenant-payos";
import { settlePayLink } from "@/server/pay-links";

/** Chỉ nhân viên, hoặc đúng học viên / phụ huynh của phiếu, mới thanh toán được. */
async function loadAllowed(invoiceId: string) {
  const me = await getMe();
  if (!me) throw new Error("Chưa đăng nhập");
  const inv = await db.invoice.findFirst({ where: { id: invoiceId }, include: { student: { include: { parent: true } } } });
  if (!inv) throw new Error("Không tìm thấy phiếu");
  const staff = STAFF_ROLES.includes(me.role);
  const own = (me.role === "STUDENT" && inv.student.userId === me.id) || (me.role === "PARENT" && inv.student.parent?.userId === me.id);
  if (!staff && !own) throw new Error("Không có quyền");
  return { me, inv, staff };
}

/** Tạo link PayOS cho số tiền còn nợ rồi chuyển người dùng sang trang thanh toán. */
export const payInvoice = wrap(async (fd) => {
  const { me, inv, staff } = await loadAllowed(str(fd, "invoiceId"));
  const cfg = await getTenantPayos();
  if (!cfg) throw new Error("Trung tâm chưa bật thanh toán online");
  const owed = inv.total - inv.paid;
  if (inv.status === "VOID" || owed <= 0) throw new Error("Phiếu này không còn khoản cần thanh toán");
  // huỷ các link cũ chưa trả để mỗi phiếu chỉ có một link còn hiệu lực
  for (const old of await db.payLink.findMany({ where: { invoiceId: inv.id, status: "PENDING" } })) {
    await cancelPaymentLink(cfg.keys, Number(old.orderCode)).catch(() => {});
    await db.payLink.update({ where: { id: old.id }, data: { status: "CANCELLED" } });
  }
  const base = `${appUrl()}${staff ? "/tai-chinh/" : "/hoa-don/"}${inv.id}`;
  const orderCode = Date.now() * 1000 + randomInt(1000);
  const link = await createPaymentLink(cfg.keys, { orderCode, amount: owed, description: `HP ${inv.code}`.slice(0, 25), returnUrl: `${base}?paid=1`, cancelUrl: base });
  await db.payLink.create({ data: { invoiceId: inv.id, orderCode: BigInt(orderCode), amount: owed, checkoutUrl: link.checkoutUrl, createdBy: me.name } });
  redirect(link.checkoutUrl);
});

/** Hỏi PayOS các link đang chờ của phiếu (dùng khi chưa nhận được webhook). */
export async function syncInvoicePayLinks(invoiceId: string): Promise<{ paid: number; pending: number }> {
  const { inv } = await loadAllowed(invoiceId);
  const cfg = await getTenantPayos({ includeDisabled: true });
  const links = await db.payLink.findMany({ where: { invoiceId: inv.id, status: "PENDING" } });
  if (!cfg) return { paid: 0, pending: links.length };
  let paid = 0;
  for (const l of links) {
    try {
      const info = await getPaymentInfo(cfg.keys, Number(l.orderCode));
      if (info.status === "PAID" && info.amountPaid >= l.amount) { await settlePayLink(l.id); paid++; }
      else if (info.status === "CANCELLED" || info.status === "EXPIRED") await db.payLink.update({ where: { id: l.id }, data: { status: "CANCELLED" } });
    } catch { /* thử lại lần sau */ }
  }
  if (paid) { revalidatePath(`/tai-chinh/${inv.id}`); revalidatePath(`/hoa-don/${inv.id}`); revalidatePath("/hoc-phi-cua-toi"); }
  return { paid, pending: links.length - paid };
}
