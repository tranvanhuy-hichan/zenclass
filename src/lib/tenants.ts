export const PLAN_LABEL: Record<string, string> = { TRIAL: "Dùng thử", BASIC: "Cơ bản", PRO: "Nâng cao", ENTERPRISE: "Doanh nghiệp" };

export function tenantState(t: { status: string; expiresAt: Date | null }) {
  if (t.status !== "ACTIVE") return { label: "Tạm khoá", cls: "bg-red-100 text-red-600" };
  if (t.expiresAt && t.expiresAt < new Date()) return { label: "Hết hạn", cls: "bg-yellow-100 text-yellow-800" };
  return { label: "Hoạt động", cls: "bg-green-100 text-green-800" };
}

