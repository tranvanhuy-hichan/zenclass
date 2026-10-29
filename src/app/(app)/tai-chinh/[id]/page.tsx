import { notFound } from "next/navigation";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { InvoiceDetail, loadInvoice } from "@/components/invoice-detail";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const inv = await loadInvoice({ id });
  if (!inv) notFound();
  return <InvoiceDetail inv={inv} staff admin={me.role === "ADMIN"} back={{ href: "/tai-chinh", label: "Tài chính" }} />;
}
