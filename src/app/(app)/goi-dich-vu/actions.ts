"use server";
import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { db, rootDb } from "@/lib/db";
import { assertRole } from "@/lib/guard";
import { wrap, str, int } from "@/lib/action";
import { appUrl, cancelPaymentLink, createPaymentLink, getPaymentInfo, platformKeys } from "@/lib/payos";
import { applyOrder } from "@/server/orders";
import { DURATIONS, getPlatformCfg, PLAN_ORDER, priceFor, type PlanCode } from "@/lib/plans";

/** Trung tâm tạo đơn đăng ký / gia hạn gói; quản trị nền tảng xác nhận sau khi nhận tiền. */
export const createOrder = wrap(async (fd) => {
  const me = await assertRole("ADMIN");
  const cfg = await getPlatformCfg();
  const plan = str(fd, "plan") as PlanCode;
  const months = int(fd, "months", 1);
  if (!PLAN_ORDER.includes(plan) || !cfg.plans[plan].sellable) throw new Error("Gói không hợp lệ");
  if (!(DURATIONS as readonly number[]).includes(months)) throw new Error("Thời hạn không hợp lệ");
  if (await db.tenantOrder.count({ where: { status: "PENDING" } }) >= 3) throw new Error("Bạn đang có nhiều đơn chờ thanh toán. Hãy thanh toán hoặc huỷ bớt trước khi tạo đơn mới.");
  const { total } = priceFor(cfg, plan, months);
  for (let i = 0; i < 6; i++) {
    const code = `GH${randomInt(100000, 1000000)}`;
    try {
      const order = await db.tenantOrder.create({ data: { code, plan, months, amount: total, createdBy: me.name } });
      let note = "";
      const keys = platformKeys();
      if (keys) {
        try {
          const orderCode = Number(code.slice(2));
          const link = await createPaymentLink(keys, { orderCode, amount: total, description: code, returnUrl: `${appUrl()}/goi-dich-vu?paid=1`, cancelUrl: `${appUrl()}/goi-dich-vu` });
          await db.tenantOrder.update({ where: { id: order.id }, data: { checkoutUrl: link.checkoutUrl, payosOrderCode: orderCode } });
        } catch (e) { note = ` (Chưa tạo được link thanh toán tự động: ${(e as Error).message}. Bạn vẫn có thể chuyển khoản tay.)`; }
      }
      revalidatePath("/goi-dich-vu");
      return `Đã tạo đơn ${code}. Bấm "Thanh toán ngay" bên dưới để thanh toán.${note}`;
    } catch (e) { if ((e as { code?: string }).code !== "P2002") throw e; }
  }
  throw new Error("Không tạo được mã đơn, thử lại");
});

export const cancelMyOrder = wrap(async (fd) => {
  await assertRole("ADMIN");
  const o = await db.tenantOrder.findFirst({ where: { id: str(fd, "id") } });
  if (!o || o.status !== "PENDING") throw new Error("Chỉ huỷ được đơn đang chờ thanh toán");
  await db.tenantOrder.update({ where: { id: o.id }, data: { status: "CANCELLED" } });
  const keys = platformKeys();
  if (keys && o.payosOrderCode) await cancelPaymentLink(keys, o.payosOrderCode).catch(() => {});
  revalidatePath("/goi-dich-vu");
});

/** Hỏi PayOS xem các đơn đang chờ đã được thanh toán chưa (dùng khi chưa nhận được webhook). */
export async function syncMyOrders(): Promise<{ paid: number; pending: number }> {
  await assertRole("ADMIN");
  const keys = platformKeys();
  const orders = await db.tenantOrder.findMany({ where: { status: "PENDING", payosOrderCode: { not: null } } });
  if (!keys) return { paid: 0, pending: orders.length };
  let paid = 0;
  for (const o of orders) {
    try {
      const info = await getPaymentInfo(keys, o.payosOrderCode!);
      if (info.status === "PAID" && info.amountPaid >= o.amount) { await applyOrder(o.id); paid++; }
      else if (info.status === "CANCELLED" || info.status === "EXPIRED") await rootDb.tenantOrder.updateMany({ where: { id: o.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    } catch { /* thử lại lần sau */ }
  }
  if (paid) revalidatePath("/", "layout");
  return { paid, pending: orders.length - paid };
}
