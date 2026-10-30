import { db } from "@/lib/db";
import { cancelPaymentLink } from "@/lib/payos";
import { getTenantPayos } from "@/lib/tenant-payos";

/** Huỷ các link PayOS đang chờ của một phiếu (khi đã thu tay hoặc huỷ phiếu) để không ai trả tiền vào link cũ. */
export async function cancelPendingLinks(invoiceId: string) {
  const links = await db.payLink.findMany({ where: { invoiceId, status: "PENDING" } });
  if (!links.length) return;
  const cfg = await getTenantPayos({ includeDisabled: true });
  for (const l of links) {
    if (cfg) await cancelPaymentLink(cfg.keys, Number(l.orderCode)).catch(() => {});
    await db.payLink.update({ where: { id: l.id }, data: { status: "CANCELLED" } });
  }
}
