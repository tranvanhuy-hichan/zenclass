import * as React from "react";
import { unstable_cache } from "next/cache";
import { currentTenantId, db, withTenant } from "@/lib/db";
import { bustSettings } from "@/lib/tenant-cache";
import { DEFAULT_THEME, sanitizeTheme, type Theme } from "@/lib/theme";

export type Bank = { bank: string; account: string; name: string };
export type CenterSettings = { name: string; bank: Bank; maxEditDays: number; theme: Theme; address?: string; phone?: string; taxCode?: string };

const DEFAULTS: CenterSettings = {
  name: "Trung tâm của tôi",
  bank: { bank: "SHB", account: "", name: "" },
  maxEditDays: 7,
  theme: DEFAULT_THEME,
};

// Một request gọi getSettings ở nhiều chỗ (metadata, layout, trang): chỉ truy vấn CSDL một lần.
const once = (typeof React.cache === "function" ? React.cache : <T extends (...a: never[]) => unknown>(f: T) => f) as <T extends (...a: never[]) => unknown>(f: T) => T;

async function loadSettings(): Promise<CenterSettings> {
  const r = await db.setting.findFirst({ where: { key: "center" } });
  const v = (r?.value ?? {}) as Partial<CenterSettings>;
  return { ...DEFAULTS, ...v, theme: sanitizeTheme(v.theme ?? {}) };
}

/**
 * Cài đặt trung tâm (tên, logo, giao diện, ngân hàng) được đọc ở mọi trang. Lưu đệm 60 giây trên máy chủ cho từng trung tâm,
 * saveSettings() xoá đệm ngay. Chưa đăng nhập (trang đăng nhập, quản trị nền tảng) thì dùng mặc định, không chạm CSDL.
 */
export const getSettings = once(async function getSettings(): Promise<CenterSettings> {
  const tid = await currentTenantId();
  if (!tid) return DEFAULTS;
  return unstable_cache(() => withTenant(tid, loadSettings), ["settings", tid], { tags: [`settings:${tid}`], revalidate: 60 })();
});
export async function saveSettings(v: CenterSettings) {
  const tenantId = await currentTenantId();
  if (!tenantId) throw new Error("Chưa xác định trung tâm");
  await db.setting.upsert({ where: { tenantId_key: { tenantId, key: "center" } }, update: { value: v }, create: { tenantId, key: "center", value: v } });
  bustSettings(tenantId);
}
