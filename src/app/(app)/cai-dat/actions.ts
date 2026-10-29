"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertRole } from "@/lib/guard";
import { wrap, str, int } from "@/lib/action";
import { parseDate } from "@/lib/format";
import { getSettings, saveSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";

export const saveCenter = wrap(async (fd) => {
  const me = await assertRole("ADMIN");
  const acc = str(fd, "account").replace(/\s/g, "");
  if (acc && !/^\d{4,20}$/.test(acc)) throw new Error("Số tài khoản không hợp lệ");
  const cur = await getSettings();
  await saveSettings({
    ...cur, name: str(fd, "name") || cur.name, maxEditDays: int(fd, "maxEditDays", 7),
    bank: { bank: str(fd, "bank").toUpperCase(), account: acc, name: str(fd, "accName").toUpperCase() },
  });
  await audit(me.id, "settings", "Setting");
  revalidatePath("/cai-dat");
});

export const addHoliday = wrap(async (fd) => {
  await assertRole("ADMIN");
  if (!str(fd, "date")) throw new Error("Chọn ngày");
  await db.holiday.upsert({ where: { date: parseDate(str(fd, "date")) }, update: { name: str(fd, "name") }, create: { date: parseDate(str(fd, "date")), name: str(fd, "name") || "Nghỉ lễ" } });
  revalidatePath("/cai-dat");
  return "Đã thêm. Lịch các lớp sẽ áp dụng khi sinh lại buổi học.";
});

export const deleteHoliday = wrap(async (fd) => {
  await assertRole("ADMIN");
  await db.holiday.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/cai-dat");
});
