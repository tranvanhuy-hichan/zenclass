"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertRole, STAFF_ROLES } from "@/lib/guard";
import { wrap, str, opt } from "@/lib/action";
import { parseDate } from "@/lib/format";
import { createStudentWithAccount } from "@/server/students";
import { resetPassword } from "@/server/accounts";
import { audit } from "@/lib/audit";

const msg = (c: Awaited<ReturnType<typeof createStudentWithAccount>>) =>
  `${c.fullName}: tài khoản ${c.code} · mật khẩu ${c.password}` +
  (c.parentAccount ? ` | Phụ huynh: ${c.parentAccount.username} · ${c.parentAccount.password}` : "");

function readStudent(fd: FormData) {
  const fullName = str(fd, "fullName");
  if (fullName.length < 2) throw new Error("Nhập họ tên học viên");
  const email = opt(fd, "email"), pemail = opt(fd, "parentEmail");
  if ((email && !/^\S+@\S+\.\S+$/.test(email)) || (pemail && !/^\S+@\S+\.\S+$/.test(pemail))) throw new Error("Email không hợp lệ");
  const pp = opt(fd, "parentPhone")?.replace(/\s/g, "") ?? null;
  if (pp && !/^[0-9+]{8,15}$/.test(pp)) throw new Error("SĐT phụ huynh không hợp lệ");
  const gender = str(fd, "gender");
  return {
    fullName, phone: opt(fd, "phone"), address: opt(fd, "address"), email, school: opt(fd, "school"), gradeLevel: opt(fd, "gradeLevel"),
    source: opt(fd, "source"), emergencyContact: opt(fd, "emergencyContact"), note: opt(fd, "note"), avatarUrl: opt(fd, "avatarUrl"),
    gender: ["MALE", "FEMALE", "OTHER"].includes(gender) ? gender : null,
    dob: str(fd, "dob") ? parseDate(str(fd, "dob")) : null,
    parentName: opt(fd, "parentName"), parentPhone: pp, parentEmail: pemail, parentAddress: opt(fd, "parentAddress"), parentJob: opt(fd, "parentJob"), parentRelation: opt(fd, "parentRelation"),
  };
}

export const createStudent = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const c = await createStudentWithAccount(readStudent(fd));
  await audit(me.id, "create", "Student", c.code);
  revalidatePath("/hoc-vien");
  return `Đã tạo học viên.\n${msg(c)}\n(Mật khẩu chỉ hiện một lần, hãy ghi lại hoặc in phiếu tài khoản)`;
});

/** Mỗi dòng: Họ tên, SĐT học viên, SĐT phụ huynh */
export const importStudents = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const lines = str(fd, "data").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Chưa nhập dữ liệu");
  if (lines.length > 300) throw new Error("Tối đa 300 dòng mỗi lần");
  const out: string[] = [];
  for (const l of lines) {
    const [name, phone, parentPhone] = l.split(/[,;\t]/).map((x) => x.trim());
    if (!name) continue;
    const c = await createStudentWithAccount({ fullName: name, phone: phone || null, parentPhone: parentPhone || null });
    out.push(`${c.fullName}\t${c.code}\t${c.password}` + (c.parentAccount ? `\t${c.parentAccount.username}\t${c.parentAccount.password}` : ""));
  }
  await audit(me.id, "import", "Student", undefined, { n: out.length });
  revalidatePath("/hoc-vien");
  return `Đã tạo ${out.length} học viên (Tên | Mã | Mật khẩu | TK PH | MK PH):\n${out.join("\n")}`;
});

export const updateStudent = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  const d = readStudent(fd);
  let parentId: string | undefined;
  if (d.parentPhone) {
    const pdata = { fullName: d.parentName || "Phụ huynh", email: d.parentEmail, address: d.parentAddress, job: d.parentJob, relation: d.parentRelation };
    const p = await db.parent.upsert({ where: { phone: d.parentPhone }, update: pdata, create: { phone: d.parentPhone, ...pdata } });
    parentId = p.id;
  }
  await db.student.update({
    where: { id },
    data: {
      fullName: d.fullName, phone: d.phone, address: d.address, email: d.email, school: d.school, gradeLevel: d.gradeLevel, source: d.source,
      emergencyContact: d.emergencyContact, note: d.note, avatarUrl: d.avatarUrl, gender: d.gender, dob: d.dob, ...(parentId ? { parentId } : {}),
    },
  });
  await audit(me.id, "update", "Student", id);
  revalidatePath(`/hoc-vien/${id}`);
  revalidatePath("/hoc-vien");
});

export const toggleDropped = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  const s = await db.student.findUniqueOrThrow({ where: { id } });
  await db.student.update({ where: { id }, data: { dropped: !s.dropped } });
  if (s.userId) await db.user.update({ where: { id: s.userId }, data: { isActive: s.dropped } });
  await audit(me.id, s.dropped ? "reactivate" : "drop", "Student", id);
  revalidatePath(`/hoc-vien/${id}`);
  revalidatePath("/hoc-vien");
});

export const resetStudentPassword = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const s = await db.student.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  if (!s.userId) throw new Error("Học viên chưa có tài khoản");
  return `Tài khoản ${s.code} · mật khẩu mới: ${await resetPassword(s.userId)}`;
});

/** Cấp lại mật khẩu cả lớp, trả về danh sách để in. */
export const classAccounts = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const classId = str(fd, "classId");
  const enr = await db.enrollment.findMany({ where: { classId, status: "ACTIVE" }, include: { student: true } });
  const rows: string[] = [];
  for (const e of enr) {
    if (!e.student.userId) continue;
    rows.push(`${e.student.fullName}\t${e.student.code}\t${await resetPassword(e.student.userId)}`);
  }
  await audit(me.id, "class-accounts", "Class", classId);
  return `Danh sách (Tên | Tài khoản | Mật khẩu) — hãy sao chép và in:\n${rows.join("\n")}`;
});

export const deleteStudent = wrap(async (fd) => {
  await assertRole("ADMIN");
  const id = str(fd, "id");
  if ((await db.attendance.count({ where: { studentId: id } })) || (await db.invoice.count({ where: { studentId: id } })))
    throw new Error("Học viên đã có dữ liệu điểm danh/học phí, hãy dùng 'Cho nghỉ học'");
  const s = await db.student.findUniqueOrThrow({ where: { id } });
  await db.enrollment.deleteMany({ where: { studentId: id } });
  await db.student.delete({ where: { id } });
  if (s.userId) await db.user.delete({ where: { id: s.userId } });
  revalidatePath("/hoc-vien");
});
