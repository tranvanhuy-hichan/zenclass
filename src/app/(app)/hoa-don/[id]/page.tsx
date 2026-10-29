import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { InvoiceDetail, loadInvoice } from "@/components/invoice-detail";

/** Phiếu học phí cho học viên / phụ huynh: cùng giao diện với quản trị, chỉ xem phiếu của mình. */
export default async function MyInvoice({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("STUDENT", "PARENT");
  const { id } = await params;
  const inv = await loadInvoice({ id, student: me.role === "STUDENT" ? { userId: me.id } : { parent: { userId: me.id } } });
  if (!inv) notFound();
  return <InvoiceDetail inv={inv} staff={false} admin={false} back={{ href: "/hoc-phi-cua-toi", label: "Học phí" }} />;
}
