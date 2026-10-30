import { db } from "@/lib/db";
import { createStudentWithAccount } from "@/server/students";

export type ImportRow = { fullName: string; username: string; password: string; parentUsername: string; parentPassword: string; status: string };

/** "Họ tên | SĐT học viên | Tên phụ huynh | SĐT phụ huynh" — tách bằng tab, | hoặc dấu phẩy. */
export function parseStudentLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\t|\||,|;/).map((x) => x.trim()))
    .filter((c) => c[0])
    .map((c) => ({ fullName: c[0], phone: c[1] || null, parentName: c[2] || null, parentPhone: c[3] || null }));
}

/** Tạo học viên + tài khoản rồi ghi danh vào lớp. Học viên vượt sĩ số vẫn được tạo nhưng không ghi danh. */
export async function importStudentsToClass(classId: string, text: string): Promise<ImportRow[]> {
  const cls = await db.class.findUniqueOrThrow({ where: { id: classId } });
  const lines = parseStudentLines(text);
  if (!lines.length) throw new Error("Chưa có học viên nào trong danh sách");
  if (lines.length > 200) throw new Error("Mỗi lần nhập tối đa 200 học viên");
  const done = await db.session.count({ where: { classId, status: "DONE" } });
  let active = await db.enrollment.count({ where: { classId, status: "ACTIVE" } });
  const out: ImportRow[] = [];
  for (const l of lines) {
    const c = await createStudentWithAccount({ fullName: l.fullName, phone: l.phone, parentName: l.parentName, parentPhone: l.parentPhone });
    const student = await db.student.findUniqueOrThrow({ where: { code: c.code } });
    let status = "Đã ghi danh";
    if (active >= cls.maxStudents) status = "Lớp đã đủ sĩ số — chưa ghi danh";
    else {
      await db.enrollment.create({ data: { studentId: student.id, classId, startDate: new Date(), totalSessions: Math.max(cls.totalSessions - done, 1) } });
      active++;
    }
    out.push({ fullName: l.fullName, username: c.code, password: c.password, parentUsername: c.parentAccount?.username ?? "", parentPassword: c.parentAccount?.password ?? "", status });
  }
  return out;
}
