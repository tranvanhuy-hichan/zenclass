// Tạo/cập nhật tài khoản test cho từng vai trò (gắn vào dữ liệu demo sẵn có).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function setLogin(userId: string, username: string, password: string) {
  const taken = await db.user.findUnique({ where: { username } });
  if (taken && taken.id !== userId) await db.user.update({ where: { id: taken.id }, data: { username: `${username}-cu-${Date.now()}` } });
  await db.user.update({ where: { id: userId }, data: { username, passwordHash: await bcrypt.hash(password, 10), isActive: true, mustChangePwd: false, failedLogins: 0, lockedUntil: null } });
}

async function main() {
  const out: string[] = [];

  // Học viên: người đang học >= 2 lớp, có phụ huynh
  const stu = await db.student.findFirst({ where: { dropped: false, parentId: { not: null }, userId: { not: null }, enrollments: { some: { status: "ACTIVE" } } }, include: { parent: true, enrollments: { where: { status: "ACTIVE" }, include: { class: true } } }, orderBy: { fullName: "asc" } });
  if (stu?.userId) {
    await setLogin(stu.userId, "hocvien", "hocvien123");
    out.push(`hocvien / hocvien123      → Học viên ${stu.fullName} (${stu.code}), lớp: ${stu.enrollments.map((e) => e.class.name).join(", ")}`);
    if (stu.parent?.userId) { await setLogin(stu.parent.userId, "phuhuynh", "phuhuynh123"); out.push(`phuhuynh / phuhuynh123    → Phụ huynh ${stu.parent.fullName} (con: ${stu.fullName})`); }
  }

  // Giáo viên: có lớp đang dạy
  const t = await db.teacher.findFirst({ where: { userId: { not: null }, classes: { some: { finished: false } } }, include: { classes: { where: { finished: false } } }, orderBy: { fullName: "asc" } });
  if (t?.userId) { await setLogin(t.userId, "giaovien", "giaovien123"); out.push(`giaovien / giaovien123    → Giáo viên ${t.fullName}, ${t.classes.length} lớp`); }

  // Trợ giảng: có lớp
  const a = await db.assistant.findFirst({ where: { userId: { not: null }, classes: { some: { finished: false } } }, include: { classes: { where: { finished: false } } }, orderBy: { fullName: "asc" } });
  if (a?.userId) { await setLogin(a.userId, "trogiang", "trogiang123"); out.push(`trogiang / trogiang123    → Trợ giảng ${a.fullName}, ${a.classes.length} lớp`); }

  // Giáo vụ
  const c = await db.coordinator.findFirst({ where: { userId: { not: null }, classes: { some: { finished: false } } }, include: { classes: { where: { finished: false } } }, orderBy: { fullName: "asc" } });
  if (c?.userId) { await setLogin(c.userId, "giaovu", "giaovu123"); out.push(`giaovu / giaovu123        → Giáo vụ ${c.fullName}, ${c.classes.length} lớp`); }

  console.log(out.join("\n"));
}
main().finally(() => db.$disconnect());
