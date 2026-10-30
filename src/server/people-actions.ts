import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertRole, STAFF_ROLES } from "@/lib/guard";
import { wrap, str, int, opt } from "@/lib/action";
import { parseDate } from "@/lib/format";
import { createUser, resetPassword } from "@/server/accounts";
import { KINDS, repo, type Kind } from "@/server/people";

function read(kind: Kind, fd: FormData, isAdmin: boolean) {
  const fullName = str(fd, "fullName");
  if (fullName.length < 2) throw new Error("Nhập họ tên");
  const email = opt(fd, "email");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Email không hợp lệ");
  const g = str(fd, "gender");
  const base = {
    fullName, phone: opt(fd, "phone"), email, address: opt(fd, "address"), idNumber: opt(fd, "idNumber"), note: opt(fd, "note"), avatarUrl: opt(fd, "avatarUrl"),
    ...(isAdmin ? { bankName: opt(fd, "bankName"), bankAccount: opt(fd, "bankAccount") } : {}),
    gender: ["MALE", "FEMALE", "OTHER"].includes(g) ? g : null,
    dob: str(fd, "dob") ? parseDate(str(fd, "dob")) : null,
    startDate: str(fd, "startDate") ? parseDate(str(fd, "startDate")) : null,
  };
  if (kind === "assistant") {
    const pt = str(fd, "payType");
    return { ...base, degree: opt(fd, "degree"), specialty: opt(fd, "specialty"), ...(isAdmin ? { payType: ["PER_SESSION", "PER_HOUR", "FIXED"].includes(pt) ? pt : "PER_SESSION", payRate: int(fd, "payRate") } : {}) };
  }
  return { ...base, position: opt(fd, "position"), ...(isAdmin ? { salary: int(fd, "salary") } : {}) };
}

export function peopleActions(kind: Kind) {
  const K = KINDS[kind];
  const create = wrap(async (fd) => {
    const me = await assertRole(...STAFF_ROLES);
    const d = read(kind, fd, me.role === "ADMIN");
    const username = str(fd, "username") || (d.phone as string | null);
    let msg = `Đã thêm ${K.label.toLowerCase()}`;
    let userId: string | undefined;
    if (username) {
      if (await db.user.findFirst({ where: { username } })) throw new Error("Tên đăng nhập đã tồn tại");
      const { user, password } = await createUser(K.role, username, d.fullName);
      userId = user.id;
      msg += `\nTài khoản: ${username} · Mật khẩu: ${password} (chỉ hiện một lần)`;
    }
    await repo(kind).create({ data: { ...d, userId } });
    revalidatePath(K.base);
    return msg;
  });

  const update = wrap(async (fd) => {
    const me = await assertRole(...STAFF_ROLES);
    const id = str(fd, "id");
    const d = read(kind, fd, me.role === "ADMIN");
    const p = await repo(kind).update({ where: { id }, data: d });
    if (p.userId) await db.user.update({ where: { id: p.userId }, data: { fullName: d.fullName } });
    revalidatePath(K.base);
    revalidatePath(`${K.base}/${id}`);
  });

  const remove = wrap(async (fd) => {
    await assertRole("ADMIN");
    const id = str(fd, "id");
    if (await db.class.count({ where: { [K.classKey]: id } })) throw new Error(`${K.label} đang được gán vào lớp, hãy đổi người phụ trách trước`);
    const p = await repo(kind).delete({ where: { id } });
    if (p.userId) await db.user.update({ where: { id: p.userId }, data: { isActive: false } });
    revalidatePath(K.base);
    redirect(K.base);
  });

  const reset = wrap(async (fd) => {
    await assertRole(...STAFF_ROLES);
    return `Mật khẩu mới: ${await resetPassword(str(fd, "userId"))}`;
  });

  return { create, update, remove, reset };
}
