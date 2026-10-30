import { db, rootDb, withTenant } from "@/lib/db";
import { verifyWebhook, type PayosWebhook } from "@/lib/payos";
import { getTenantPayos } from "@/lib/tenant-payos";
import { settlePayLink } from "@/server/pay-links";

/** Webhook PayOS cho kênh thanh toán học phí của MỘT trung tâm: /api/webhook/payos/t/<mã trung tâm nội bộ>. */
export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await ctx.params;
  const tenant = await rootDb.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || tenant.status !== "ACTIVE") return new Response("Unknown center", { status: 404 });
  const body = (await req.json().catch(() => null)) as PayosWebhook | null;
  return withTenant(tenantId, async () => {
    const cfg = await getTenantPayos({ includeDisabled: true });
    if (!cfg || !body || !verifyWebhook(body, cfg.keys.checksumKey)) return new Response("Invalid signature", { status: 401 });
    // PayOS gọi thử khi lưu webhook (đơn không tồn tại) và cả khi giao dịch lỗi: luôn trả 200 để họ không gọi lại mãi.
    if (!body.success || body.data.code !== "00") return Response.json({ ok: true, ignored: true });
    const link = await db.payLink.findFirst({ where: { orderCode: Number(body.data.orderCode) } });
    if (!link) return Response.json({ ok: true, matched: false });
    if (Number(body.data.amount) < link.amount) return Response.json({ ok: true, matched: true, note: "số tiền chưa đủ" });
    const r = await settlePayLink(link.id);
    return Response.json({ ok: true, matched: true, already: r.already });
  });
}
