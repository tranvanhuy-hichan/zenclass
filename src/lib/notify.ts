import { db } from "@/lib/db";

/** Gửi thông báo trong app cho học viên + phụ huynh. dedupe: tránh gửi lặp. */
export async function notifyStudent(studentId: string, type: string, title: string, body: string, dedupe?: string) {
  const s = await db.student.findUnique({ where: { id: studentId }, include: { parent: true } });
  if (!s) return;
  const userIds = [s.userId, s.parent?.userId].filter(Boolean) as string[];
  for (const userId of userIds) {
    try {
      await db.notification.create({
        data: { userId, type, title, body, dedupe: dedupe ? `${dedupe}:${userId}` : undefined },
      });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
}
