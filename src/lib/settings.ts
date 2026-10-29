import { db } from "@/lib/db";
import { DEFAULT_THEME, sanitizeTheme, type Theme } from "@/lib/theme";

export type Bank = { bank: string; account: string; name: string };
export type CenterSettings = { name: string; bank: Bank; maxEditDays: number; theme: Theme };

const DEFAULTS: CenterSettings = {
  name: "Trung tâm của tôi",
  bank: { bank: "SHB", account: "", name: "" },
  maxEditDays: 7,
  theme: DEFAULT_THEME,
};

export async function getSettings(): Promise<CenterSettings> {
  const r = await db.setting.findUnique({ where: { key: "center" } });
  const v = (r?.value ?? {}) as Partial<CenterSettings>;
  return { ...DEFAULTS, ...v, theme: sanitizeTheme(v.theme ?? {}) };
}
export async function saveSettings(v: CenterSettings) {
  await db.setting.upsert({ where: { key: "center" }, update: { value: v }, create: { key: "center", value: v } });
}
