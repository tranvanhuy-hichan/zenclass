"use server";
import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/guard";
import { wrap, str } from "@/lib/action";
import { getSettings, saveSettings } from "@/lib/settings";
import { sanitizeTheme, DEFAULT_THEME } from "@/lib/theme";

export const saveTheme = wrap(async (fd) => {
  await assertRole("ADMIN");
  let raw: unknown;
  try { raw = JSON.parse(str(fd, "theme")); } catch { throw new Error("Dữ liệu giao diện không hợp lệ"); }
  const cur = await getSettings();
  await saveSettings({ ...cur, name: str(fd, "name") || cur.name, theme: sanitizeTheme(raw as object) });
  revalidatePath("/", "layout");
  return "Đã lưu giao diện cho toàn hệ thống";
});

export const resetTheme = wrap(async () => {
  await assertRole("ADMIN");
  const cur = await getSettings();
  await saveSettings({ ...cur, theme: DEFAULT_THEME });
  revalidatePath("/", "layout");
  return "Đã khôi phục giao diện mặc định";
});
