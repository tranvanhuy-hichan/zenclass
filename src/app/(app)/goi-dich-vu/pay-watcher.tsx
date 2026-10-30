"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncMyOrders } from "./actions";

/** Trong lúc có đơn chờ thanh toán PayOS: cứ vài giây hỏi trạng thái, thanh toán xong thì tự làm mới trang. */
export function PayWatcher() {
  const router = useRouter();
  useEffect(() => {
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop || Date.now() - started > 15 * 60_000) return;
      try { const r = await syncMyOrders(); if (r.paid > 0) { router.refresh(); return; } } catch { /* bỏ qua */ }
      setTimeout(tick, 4000);
    };
    const t = setTimeout(tick, 3000);
    return () => { stop = true; clearTimeout(t); };
  }, [router]);
  return <p className="text-xs text-slate-500">Hệ thống đang tự kiểm tra thanh toán, trang sẽ cập nhật ngay khi bạn thanh toán xong.</p>;
}
