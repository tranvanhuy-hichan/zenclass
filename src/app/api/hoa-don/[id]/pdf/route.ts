import { db } from "@/lib/db";
import { getMe } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { buildReceiptPdf } from "@/server/receipt-pdf";

/**
 * Biên lai thu tiền học phí (PDF). Quản trị/nhân viên xem mọi phiếu; học viên/phụ huynh chỉ xem phiếu của mình.
 * `?payment=<id>` = biên lai của riêng một khoản thu, bỏ trống = biên lai tổng các khoản đã thu của phiếu.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!me) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const scope = me.role === "STUDENT" ? { student: { userId: me.id } } : me.role === "PARENT" ? { student: { parent: { userId: me.id } } } : ["ADMIN", "STAFF"].includes(me.role) ? {} : null;
  if (!scope) return new Response("Forbidden", { status: 403 });

  const inv = await db.invoice.findFirst({ where: { id, ...scope }, include: { student: { include: { parent: true } }, items: true, payments: { orderBy: { paidAt: "asc" } } } });
  if (!inv) return new Response("Not found", { status: 404 });
  if (!inv.payments.length) return new Response("Phiếu này chưa có khoản thu nào nên chưa có biên lai", { status: 409 });

  const payId = new URL(req.url).searchParams.get("payment");
  const one = payId ? inv.payments.find((p) => p.id === payId) : null;
  if (payId && !one) return new Response("Not found", { status: 404 });
  const st = await getSettings();

  const bytes = await buildReceiptPdf({
    center: { name: st.name, address: st.address, phone: st.phone, taxCode: st.taxCode },
    no: one ? `${inv.code}-${inv.payments.indexOf(one) + 1}` : inv.code,
    date: one ? one.paidAt : inv.payments[inv.payments.length - 1].paidAt,
    student: { code: inv.student.code, fullName: inv.student.fullName, gradeLevel: inv.student.gradeLevel },
    payer: inv.student.parent?.fullName ?? inv.student.fullName,
    invoiceCode: inv.code,
    items: inv.items.map((i) => ({ description: i.description, amount: i.amount })),
    total: inv.total,
    paidAll: inv.paid,
    payments: (one ? [one] : inv.payments).map((p) => ({ paidAt: p.paidAt, method: p.method, amount: p.amount })),
    receivedAmount: one ? one.amount : inv.paid,
  });
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="bien-lai-${inv.code}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
