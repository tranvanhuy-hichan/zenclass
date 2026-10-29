import { db } from "@/lib/db";
import { refreshInvoice } from "@/app/(app)/tai-chinh/actions";
import { notifyStudent } from "@/lib/notify";

/** Webhook SePay: Authorization: Apikey $SEPAY_API_KEY. Nội dung CK chứa mã phiếu (PT00001). */
export async function POST(req: Request) {
  if (!process.env.SEPAY_API_KEY || req.headers.get("authorization") !== `Apikey ${process.env.SEPAY_API_KEY}`)
    return new Response("Unauthorized", { status: 401 });
  const b = (await req.json()) as { id?: number | string; content?: string; transferAmount?: number; transferType?: string };
  if (b.transferType !== "in" || !b.transferAmount) return Response.json({ ok: true, skipped: true });
  const code = (b.content ?? "").toUpperCase().match(/PT\d{5}/)?.[0];
  const inv = code ? await db.invoice.findUnique({ where: { code } }) : null;
  if (!inv || inv.status === "VOID") return Response.json({ ok: true, matched: false });
  const amount = Math.min(b.transferAmount, inv.total - inv.paid);
  if (amount <= 0) return Response.json({ ok: true, matched: true, note: "đã đủ" });
  try {
    await db.payment.create({ data: { invoiceId: inv.id, amount, method: "BANK", bankTxId: String(b.id ?? `${code}-${Date.now()}`) } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return Response.json({ ok: true, duplicate: true });
    throw e;
  }
  await refreshInvoice(inv.id);
  await notifyStudent(inv.studentId, "PAYMENT", "Đã nhận học phí", `Đã nhận ${amount.toLocaleString("vi-VN")}đ cho phiếu ${inv.code}. Cảm ơn!`);
  return Response.json({ ok: true, matched: true });
}
