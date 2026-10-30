import bcrypt from "bcryptjs";
import { db, rootDb } from "@/lib/db";
import { genPassword } from "@/lib/password";
import type { Role } from "@prisma/client";

/** Tên đăng nhập duy nhất trên toàn hệ thống (kể cả trung tâm khác). */
export async function usernameTaken(username: string) {
  return !!(await rootDb.user.findUnique({ where: { username }, select: { id: true } }));
}

/** Lấy tên đăng nhập còn trống từ `base` (thêm -2, -3... nếu trùng). */
export async function freeUsername(base: string) {
  for (let i = 1; i < 100; i++) {
    const u = i === 1 ? base : `${base}-${i}`;
    if (!(await usernameTaken(u))) return u;
  }
  throw new Error("Không tạo được tên đăng nhập");
}

export async function createUser(role: Role, username: string, fullName: string) {
  if (await usernameTaken(username)) throw new Error(`Tên đăng nhập "${username}" đã được sử dụng, hãy chọn tên khác`);
  const password = genPassword();
  const user = await db.user.create({
    data: { username, fullName, role, passwordHash: await bcrypt.hash(password, 10), mustChangePwd: true },
  });
  return { user, password };
}

export async function resetPassword(userId: string) {
  const password = genPassword();
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10), mustChangePwd: true, failedLogins: 0, lockedUntil: null },
  });
  return password;
}
