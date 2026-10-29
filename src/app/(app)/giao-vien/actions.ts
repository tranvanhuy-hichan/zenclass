"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertRole, STAFF_ROLES } from "@/lib/guard";
import { wrap, str, int, opt } from "@/lib/action";
import { parseDate } from "@/lib/format";
import { createUser, resetPassword } from "@/server/accounts";

function readTeacher(fd: FormData) {
  const fullName = str(fd, "fullName");
  if (fullName.length < 2) throw new Error("Nhập họ tên");
  const email = opt(fd, "email");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Email không hợp lệ");
  const g = str(fd, "gender");
  const payType = ["PER_SESSION", "PER_HOUR", "FIXED"].includes(str(fd, "payType")) ? str(fd, "payType") : "PER_SESSION";
  return {
    fullName, phone: opt(fd, "phone"), email, address: opt(fd, "address"), idNumber: opt(fd, "idNumber"), degree: opt(fd, "degree"),
    specialty: opt(fd, "specialty"), bankName: opt(fd, "bankName"), bankAccount: opt(fd, "bankAccount"), note: opt(fd, "note"), avatarUrl: opt(fd, "avatarUrl"),
    gender: ["MALE", "FEMALE", "OTHER"].includes(g) ? g : null,
    dob: str(fd, "dob") ? parseDate(str(fd, "dob")) : null,
    startDate: str(fd, "startDate") ? parseDate(str(fd, "startDate")) : null,
    payType, payRate: int(fd, "payRate"),
  };
}

export const createTeacher = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const d = readTeacher(fd);
  const username = str(fd, "username") || d.phone;
  let msg = "Đã thêm giáo viên";
  let userId: string | undefined;
  if (username) {
    if (await db.user.findUnique({ where: { username } })) throw new Error("Tên đăng nhập đã tồn tại");
    const { user, password } = await createUser("TEACHER", username, d.fullName);
    userId = user.id;
    msg += `\nTài khoản: ${username} · Mật khẩu: ${password} (chỉ hiện một lần)`;
  }
  await db.teacher.create({ data: { ...d, userId } });
  revalidatePath("/giao-vien");
  return msg;
});

export const updateTeacher = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  const d = readTeacher(fd);
  const t = await db.teacher.update({ where: { id }, data: d });
  if (t.userId) await db.user.update({ where: { id: t.userId }, data: { fullName: d.fullName } });
  revalidatePath("/giao-vien");
  revalidatePath(`/giao-vien/${id}`);
});

export const deleteTeacher = wrap(async (fd) => {
  await assertRole("ADMIN");
  const id = str(fd, "id");
  if ((await db.class.count({ where: { OR: [{ teacherId: id }, { assistantId: id }] } })) > 0)
    throw new Error("Giáo viên đang được gán vào lớp");
  await db.session.updateMany({ where: { teacherId: id }, data: { teacherId: null } });
  const t = await db.teacher.delete({ where: { id } });
  if (t.userId) await db.user.update({ where: { id: t.userId }, data: { isActive: false } });
  revalidatePath("/giao-vien");
  redirect("/giao-vien");
});

export const resetUserPassword = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const pw = await resetPassword(str(fd, "userId"));
  return `Mật khẩu mới: ${pw}`;
});
