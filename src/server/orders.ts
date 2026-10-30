import { rootDb } from "@/lib/db";
import { addMonths, getPlatformCfg, type PlanCode } from "@/lib/plans";

/** Áp dụng một đơn đã thanh toán: đổi gói, cộng thời hạn (nối vào hạn hiện tại nếu cùng gói còn hạn). Gọi lại an toàn. */
export async function applyOrder(orderId: string) {
  const o = await rootDb.tenantOrder.findUniqueOrThrow({ where: { id: orderId } });
  if (o.status === "PAID") return { already: true as const, tenantId: o.tenantId, name: "" };
  const cfg = await getPlatformCfg();
  const t = await rootDb.tenant.findUniqueOrThrow({ where: { id: o.tenantId } });
  const plan = o.plan as PlanCode;
  const start = t.expiresAt && t.expiresAt > new Date() && t.plan === plan ? t.expiresAt : new Date();
  // updateMany có điều kiện status để hai lời gọi song song (webhook + kiểm tra tay) không cộng hạn hai lần
  const [flip] = await rootDb.$transaction([
    rootDb.tenantOrder.updateMany({ where: { id: o.id, status: { not: "PAID" } }, data: { status: "PAID", paidAt: new Date() } }),
  ]);
  if (flip.count === 0) return { already: true as const, tenantId: t.id, name: t.name };
  await rootDb.tenant.update({ where: { id: t.id }, data: { plan, status: "ACTIVE", expiresAt: addMonths(start, o.months), maxStudents: cfg.plans[plan].maxStudents, maxBranches: cfg.plans[plan].maxBranches } });
  return { already: false as const, tenantId: t.id, name: t.name };
}
