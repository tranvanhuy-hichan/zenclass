"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, rootDb } from "@/lib/db";
import { assertRole } from "@/lib/guard";
import { wrap, str } from "@/lib/action";
import { createUser, resetPassword } from "@/server/accounts";
import { audit } from "@/lib/audit";
import type { Role } from "@prisma/client";

export const createStaff = wrap(async (fd) => {
  const me = await assertRole("ADMIN");
  const username = str(fd, "username");
  const fullName = str(fd, "fullName");
  const role = str(fd, "role") as Role;
  if (!username || !fullName || !["ADMIN", "STAFF"].includes(role)) throw new Error("Thiếu thông tin");
  if (await db.user.findFirst({ where: { username } })) throw new Error("Tên đăng nhập đã tồn tại");
  const { user, password } = await createUser(role, username, fullName);
  await audit(me.id, "create", "User", user.id);
  revalidatePath("/nhan-vien");
  return `Đã tạo. Tài khoản: ${username} · Mật khẩu: ${password} (chỉ hiện một lần)`;
});

export const adminResetPassword = wrap(async (fd) => {
  const me = await assertRole("ADMIN");
  const id = str(fd, "userId");
  const pw = await resetPassword(id);
  await audit(me.id, "reset-password", "User", id);
  return `Mật khẩu mới: ${pw}`;
});

export const toggleUser = wrap(async (fd) => {
  const me = await assertRole("ADMIN");
  const id = str(fd, "userId");
  if (id === me.id) throw new Error("Không thể khoá chính mình");
  const u = await db.user.findUniqueOrThrow({ where: { id } });
  await db.user.update({ where: { id }, data: { isActive: !u.isActive } });
  revalidatePath("/nhan-vien");
});

export const changeMyPassword = wrap(async (fd) => {
  const me = await assertRole("SUPERADMIN", "ADMIN", "STAFF", "TEACHER", "STUDENT", "PARENT");
  const bcrypt = (await import("bcryptjs")).default;
  const store = me.role === "SUPERADMIN" ? rootDb : db;
  const u = await store.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(str(fd, "old"), u.passwordHash))) throw new Error("Mật khẩu cũ không đúng");
  const nw = str(fd, "new");
  if (nw.length < 6) throw new Error("Mật khẩu mới tối thiểu 6 ký tự");
  await store.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(nw, 10), mustChangePwd: false } });
  redirect("/");
});
