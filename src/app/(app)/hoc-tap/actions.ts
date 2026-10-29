"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertRole } from "@/lib/guard";
import { wrap, str, opt } from "@/lib/action";
import { notifyStudent } from "@/lib/notify";

const TEACH = ["ADMIN", "STAFF", "TEACHER"] as const;

export const saveGrades = wrap(async (fd) => {
  const me = await assertRole(...TEACH);
  const classId = str(fd, "classId");
  const cls = await db.class.findUniqueOrThrow({ where: { id: classId }, include: { gradeTemplate: { include: { columns: true } }, teacher: true, assistant: true } });
  if (!cls.gradeTemplate) throw new Error("Lớp chưa có bộ điểm");
  if (me.role === "TEACHER" && cls.teacher?.userId !== me.id && cls.assistant?.userId !== me.id) throw new Error("Bạn không phụ trách lớp này");
  let rows: { studentId: string; columnId: string; value: number | null; comment?: string | null }[];
  try { rows = JSON.parse(str(fd, "rows")); } catch { throw new Error("Dữ liệu không hợp lệ"); }
  const cols = new Map(cls.gradeTemplate.columns.map((c) => [c.id, c]));
  const enrolled = new Set((await db.enrollment.findMany({ where: { classId }, select: { studentId: true } })).map((e) => e.studentId));
  const touched = new Set<string>();
  for (const r of rows) {
    const col = cols.get(r.columnId);
    if (!col || !enrolled.has(r.studentId)) continue;
    const key = { classId_studentId_columnId: { classId, studentId: r.studentId, columnId: r.columnId } };
    if (r.value == null) { await db.gradeValue.deleteMany({ where: { classId, studentId: r.studentId, columnId: r.columnId } }); }
    else {
      if (!Number.isFinite(r.value) || r.value < 0 || r.value > col.maxScore) throw new Error(`Điểm "${col.name}" phải từ 0 đến ${col.maxScore}`);
      await db.gradeValue.upsert({ where: key, update: { value: r.value }, create: { classId, studentId: r.studentId, columnId: r.columnId, value: r.value } });
    }
    touched.add(r.studentId);
  }
  for (const id of touched) await notifyStudent(id, "SCORE", "Điểm đã cập nhật", `Bảng điểm lớp ${cls.name} có cập nhật mới.`, `score:${classId}:${id}:${new Date().toISOString().slice(0, 13)}`);
  revalidatePath(`/lop-hoc/${classId}/diem`);
  return `Đã lưu điểm (${touched.size} học viên thay đổi)`;
});

export const addRemark = wrap(async (fd) => {
  const me = await assertRole(...TEACH);
  const studentId = str(fd, "studentId");
  const content = str(fd, "content");
  if (!content) throw new Error("Nhập nhận xét");
  await db.remark.create({ data: { studentId, classId: opt(fd, "classId"), content, author: me.name } });
  await notifyStudent(studentId, "REMARK", "Nhận xét mới từ giáo viên", content);
  revalidatePath(`/hoc-vien/${studentId}`);
  return "Đã gửi nhận xét";
});

export const addMaterial = wrap(async (fd) => {
  await assertRole(...TEACH);
  const title = str(fd, "title"), url = str(fd, "url");
  if (!title || !/^https?:\/\//.test(url)) throw new Error("Nhập tên và đường dẫn (http/https)");
  await db.material.create({ data: { title, url, classId: opt(fd, "classId") } });
  revalidatePath("/tai-lieu");
});

export const deleteMaterial = wrap(async (fd) => {
  await assertRole(...TEACH);
  await db.material.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/tai-lieu");
});
