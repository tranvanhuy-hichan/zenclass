"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertRole, STAFF_ROLES } from "@/lib/guard";
import { wrap, str } from "@/lib/action";
import { notifyStudent } from "@/lib/notify";

export const markAllRead = wrap(async () => {
  const me = await assertRole("ADMIN", "STAFF", "TEACHER", "STUDENT", "PARENT");
  await db.notification.updateMany({ where: { userId: me.id, read: false }, data: { read: true } });
  revalidatePath("/thong-bao");
});

export const sendAnnouncement = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const title = str(fd, "title"), body = str(fd, "body"), classId = str(fd, "classId");
  if (!title || !body) throw new Error("Nhập tiêu đề và nội dung");
  const students = await db.student.findMany({
    where: { dropped: false, ...(classId ? { enrollments: { some: { classId, status: "ACTIVE" } } } : {}) },
    select: { id: true },
  });
  for (const s of students) await notifyStudent(s.id, "ANNOUNCE", title, body);
  return `Đã gửi tới ${students.length} học viên & phụ huynh`;
});
