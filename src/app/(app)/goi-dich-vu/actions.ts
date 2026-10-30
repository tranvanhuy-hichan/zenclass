"use server";
import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertRole } from "@/lib/guard";
import { wrap, str, int } from "@/lib/action";
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
      await db.tenantOrder.create({ data: { code, plan, months, amount: total, createdBy: me.name } });
      revalidatePath("/goi-dich-vu");
      return `Đã tạo đơn ${code}. Vui lòng chuyển khoản đúng số tiền và nội dung bên dưới.`;
    } catch (e) { if ((e as { code?: string }).code !== "P2002") throw e; }
  }
  throw new Error("Không tạo được mã đơn, thử lại");
});

export const cancelMyOrder = wrap(async (fd) => {
  await assertRole("ADMIN");
  const o = await db.tenantOrder.findFirst({ where: { id: str(fd, "id") } });
  if (!o || o.status !== "PENDING") throw new Error("Chỉ huỷ được đơn đang chờ thanh toán");
  await db.tenantOrder.update({ where: { id: o.id }, data: { status: "CANCELLED" } });
  revalidatePath("/goi-dich-vu");
});
