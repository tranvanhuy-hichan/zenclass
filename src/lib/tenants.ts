export { PLAN_ORDER } from "@/lib/plans";
export const PLAN_LABEL: Record<string, string> = { TRIAL: "Dùng thử", BASIC: "Cơ bản", PRO: "Nâng cao", ENTERPRISE: "Doanh nghiệp" };
export const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ thanh toán", cls: "bg-yellow-100 text-yellow-800" },
  PAID: { label: "Đã thanh toán", cls: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Đã huỷ", cls: "bg-slate-200 text-slate-600" },
};

export function tenantState(t: { status: string; expiresAt: Date | null }) {
  if (t.status !== "ACTIVE") return { label: "Tạm khoá", cls: "bg-red-100 text-red-600", key: "suspended" };
  if (t.expiresAt && t.expiresAt < new Date()) return { label: "Hết hạn", cls: "bg-yellow-100 text-yellow-800", key: "expired" };
  if (t.expiresAt && t.expiresAt.getTime() - Date.now() < 7 * 86400_000) return { label: "Sắp hết hạn", cls: "bg-orange-100 text-orange-800", key: "soon" };
  return { label: "Hoạt động", cls: "bg-green-100 text-green-800", key: "active" };
}
