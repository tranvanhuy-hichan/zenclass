import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { InvoiceView } from "@/components/invoice-view";
import { PrintButton } from "@/components/print-button";

/** Phiếu học phí cho học viên / phụ huynh (chỉ xem phiếu của mình). */
export default async function MyInvoice({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("STUDENT", "PARENT");
  const { id } = await params;
  const inv = await db.invoice.findFirst({
    where: { id, student: me.role === "STUDENT" ? { userId: me.id } : { parent: { userId: me.id } } },
    include: { student: true, items: true },
  });
  if (!inv) notFound();
  return <div className="space-y-3"><PrintButton /><InvoiceView inv={inv} /></div>;
}
