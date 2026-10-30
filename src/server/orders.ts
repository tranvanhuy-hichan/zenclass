import { rootDb } from "@/lib/db";
import { addMonths, getPlatformCfg, type PlanCode } from "@/lib/plans";

const DAY = 86400_000;

/**
 * Áp dụng một đơn đã thanh toán. Toàn bộ trong MỘT giao dịch: hoặc đơn được đánh dấu đã trả VÀ gói được cập nhật, hoặc không gì cả.
 * Quy tắc thời hạn:
 *  - Cùng gói còn hạn: cộng nối vào hạn hiện tại.
 *  - Nâng lên gói đắt hơn khi còn hạn: bắt đầu từ hôm nay, phần thời gian còn lại của gói cũ được quy đổi thành
 *    ngày của gói mới theo tỉ lệ giá (khách không mất tiền đã trả).
 *  - Gói rẻ hơn (đơn tạo trước khi có quy tắc chặn): giữ nguyên hạn hiện tại rồi cộng nối, không làm mất thời gian đã trả.
 *  - Hết hạn / dùng thử: bắt đầu từ hôm nay.
 * Gọi lại nhiều lần an toàn (webhook + kiểm tra định kỳ có thể trùng nhau).
 */
export async function applyOrder(orderId: string) {
  const cfg = await getPlatformCfg();
  return rootDb.$transaction(async (tx) => {
    const o = await tx.tenantOrder.findUniqueOrThrow({ where: { id: orderId } });
    const flip = await tx.tenantOrder.updateMany({ where: { id: o.id, status: { not: "PAID" } }, data: { status: "PAID", paidAt: new Date() } });
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: o.tenantId } });
    if (flip.count === 0) return { already: true as const, tenantId: t.id, name: t.name };

    const plan = o.plan as PlanCode;
    const now = new Date();
    const hasTime = !!t.expiresAt && t.expiresAt > now;
    let start = now, bonusDays = 0;
    if (hasTime) {
      if (t.plan === plan) start = t.expiresAt!;
      else {
        const oldPrice = cfg.plans[t.plan as PlanCode]?.monthlyPrice ?? 0, newPrice = cfg.plans[plan].monthlyPrice;
        if (newPrice > oldPrice) bonusDays = oldPrice > 0 ? Math.floor(((t.expiresAt!.getTime() - now.getTime()) / DAY) * oldPrice / newPrice) : 0;
        else start = t.expiresAt!;
      }
    }
    const expiresAt = new Date(addMonths(start, o.months).getTime() + bonusDays * DAY);
    await tx.tenant.update({ where: { id: t.id }, data: { plan, status: "ACTIVE", expiresAt, maxStudents: cfg.plans[plan].maxStudents, maxBranches: cfg.plans[plan].maxBranches } });
    return { already: false as const, tenantId: t.id, name: t.name, bonusDays };
  });
}
