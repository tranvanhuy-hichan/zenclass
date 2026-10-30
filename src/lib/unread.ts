"use server";
import { db } from "@/lib/db";
import { getMe } from "@/lib/guard";

/** Số thông báo chưa đọc — Shell gọi sau khi trang đã hiện, để việc này không làm chậm lần tải đầu. */
export async function getUnreadCount(): Promise<number> {
  const me = await getMe();
  if (!me || me.role === "SUPERADMIN") return 0;
  return db.notification.count({ where: { userId: me.id, read: false } });
}
