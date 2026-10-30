import { rootDb } from "@/lib/db";

export type PlanCode = "TRIAL" | "BASIC" | "PRO" | "ENTERPRISE";
export type PlanDef = { name: string; monthlyPrice: number; maxStudents: number; maxBranches: number; features: string[]; sellable: boolean };
export type PlatformCfg = {
  plans: Record<PlanCode, PlanDef>;
  /** % giảm theo số tháng đăng ký */
  discounts: Record<"1" | "3" | "6" | "12", number>;
  bank: { bank: string; account: string; name: string };
};

export const DURATIONS = [1, 3, 6, 12] as const;
export const PLAN_ORDER: PlanCode[] = ["TRIAL", "BASIC", "PRO", "ENTERPRISE"];

export const DEFAULT_CFG: PlatformCfg = {
  plans: {
    TRIAL: { name: "Dùng thử", monthlyPrice: 0, maxStudents: 50, maxBranches: 1, features: ["Đầy đủ tính năng cơ bản", "Tối đa 50 học viên"], sellable: false },
    BASIC: { name: "Cơ bản", monthlyPrice: 299_000, maxStudents: 150, maxBranches: 1, features: ["Tối đa 150 học viên", "1 cơ sở", "Điểm danh, học phí, bảng điểm", "Cổng học viên & phụ huynh"], sellable: true },
    PRO: { name: "Nâng cao", monthlyPrice: 699_000, maxStudents: 600, maxBranches: 5, features: ["Tối đa 600 học viên", "Tối đa 5 cơ sở", "Lương giáo viên, dạy thế", "Báo cáo & thống kê điểm"], sellable: true },
    ENTERPRISE: { name: "Doanh nghiệp", monthlyPrice: 1_490_000, maxStudents: 100000, maxBranches: 100, features: ["Không giới hạn học viên", "Nhiều cơ sở", "Hỗ trợ ưu tiên"], sellable: true },
  },
  discounts: { "1": 0, "3": 5, "6": 10, "12": 20 },
  bank: { bank: "SHB", account: "", name: "" },
};

export async function getPlatformCfg(): Promise<PlatformCfg> {
  const r = await rootDb.platformConfig.findUnique({ where: { key: "main" } });
  const v = (r?.value ?? {}) as Partial<PlatformCfg>;
  const plans = { ...DEFAULT_CFG.plans };
  for (const k of PLAN_ORDER) plans[k] = { ...DEFAULT_CFG.plans[k], ...(v.plans?.[k] ?? {}) };
  return { plans, discounts: { ...DEFAULT_CFG.discounts, ...(v.discounts ?? {}) }, bank: { ...DEFAULT_CFG.bank, ...(v.bank ?? {}) } };
}

/** Thành tiền = giá tháng × số tháng × (1 − giảm giá theo kỳ hạn). */
export function priceFor(cfg: PlatformCfg, plan: PlanCode, months: number) {
  const base = cfg.plans[plan].monthlyPrice * months;
  const pct = cfg.discounts[String(months) as "1"] ?? 0;
  return { base, pct, total: Math.round((base * (100 - pct)) / 100 / 1000) * 1000 };
}

export function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

export const daysLeft = (d: Date | null) => (d ? Math.ceil((d.getTime() - Date.now()) / 86400_000) : null);
export const fmtVnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`;
