import { rootDb } from "@/lib/db";
import { platformKeys, verifyWebhook, type PayosWebhook } from "@/lib/payos";
import { applyOrder } from "@/server/orders";

/** Webhook PayOS cho kênh thanh toán gói dịch vụ của nền tảng. Dán địa chỉ này vào cấu hình kênh trên PayOS. */
export async function POST(req: Request) {
  const keys = platformKeys();
  if (!keys) return new Response("PayOS chưa cấu hình", { status: 503 });
  const body = (await req.json().catch(() => null)) as PayosWebhook | null;
  if (!body || !verifyWebhook(body, keys.checksumKey)) return new Response("Invalid signature", { status: 401 });
  // PayOS gọi thử khi lưu webhook (đơn không tồn tại) và cả khi giao dịch lỗi: luôn trả 200 để họ không gọi lại mãi.
  if (!body.success || body.data.code !== "00") return Response.json({ ok: true, ignored: true });
  const order = await rootDb.tenantOrder.findUnique({ where: { payosOrderCode: Number(body.data.orderCode) } });
  if (!order) return Response.json({ ok: true, matched: false });
  if (Number(body.data.amount) < order.amount) return Response.json({ ok: true, matched: true, note: "số tiền chưa đủ" });
  const r = await applyOrder(order.id);
  return Response.json({ ok: true, matched: true, already: r.already });
}
