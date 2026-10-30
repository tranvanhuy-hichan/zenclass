"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { syncInvoicePayLinks } from "@/app/(app)/tai-chinh/pay-actions";

/** Sau khi thanh toán PayOS (quay lại với ?paid=1), hỏi trạng thái vài lần rồi tự làm mới trang. */
export function InvoicePayWatcher({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const returned = useSearchParams().get("paid") === "1";
  useEffect(() => {
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop || Date.now() - started > (returned ? 10 : 15) * 60_000) return;
      try { const r = await syncInvoicePayLinks(invoiceId); if (r.paid > 0) { router.refresh(); return; } if (r.pending === 0 && !returned) return; } catch { /* bỏ qua */ }
      setTimeout(tick, 4000);
    };
    const t = setTimeout(tick, 2000);
    return () => { stop = true; clearTimeout(t); };
  }, [invoiceId, returned, router]);
  return returned ? <p className="text-xs text-slate-500">Đang xác nhận thanh toán của bạn...</p> : null;
}
