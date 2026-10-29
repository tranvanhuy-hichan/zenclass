import { db } from "@/lib/db";
import { computeTotal } from "@/lib/grade";

export const BANDS = [
  { key: "xs", label: "Xuất sắc", min: 9, color: "#22c55e" },
  { key: "gioi", label: "Giỏi", min: 8, color: "#3b82f6" },
  { key: "kha", label: "Khá", min: 6.5, color: "#06b6d4" },
  { key: "tb", label: "Trung bình", min: 5, color: "#f59e0b" },
  { key: "yeu", label: "Yếu", min: 0, color: "#ef4444" },
] as const;
export const bandOf = (norm: number) => BANDS.find((b) => norm >= b.min)!;

export type ClassStat = {
  id: string; name: string; finished: boolean; teacher: string | null; template: string | null; templateId: string | null;
  students: number; filled: number; expected: number; avgNorm: number | null; graded: number;
  cols: { id: string; name: string; max: number; avg: number | null; filled: number }[];
  rows: { studentId: string; name: string; code: string; norm: number | null }[];
};

/** Thống kê điểm theo lớp. Điểm tổng được quy về thang 10 để so sánh giữa các bộ điểm khác nhau. */
export async function gradeStats(opts: { classIds?: string[]; templateId?: string; q?: string } = {}): Promise<ClassStat[]> {
  const classes = await db.class.findMany({
    where: {
      ...(opts.classIds ? { id: { in: opts.classIds } } : {}),
      ...(opts.templateId ? { gradeTemplateId: opts.templateId } : {}),
      ...(opts.q ? { name: { contains: opts.q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      teacher: true,
      gradeTemplate: { include: { columns: { orderBy: { order: "asc" } } } },
      enrollments: { where: { status: { in: ["ACTIVE", "PAUSED", "FINISHED"] } }, include: { student: { select: { id: true, fullName: true, code: true } } } },
    },
  });
  const values = await db.gradeValue.findMany({ where: { classId: { in: classes.map((c) => c.id) } } });
  const byClass = new Map<string, typeof values>();
  for (const v of values) byClass.set(v.classId, [...(byClass.get(v.classId) ?? []), v]);

  return classes.map((c) => {
    const t = c.gradeTemplate;
    const cols = t?.columns ?? [];
    const seen = new Set<string>();
    const studs = c.enrollments.filter((e) => !seen.has(e.studentId) && seen.add(e.studentId)).map((e) => e.student);
    const vs = byClass.get(c.id) ?? [];
    const rows = studs.map((s) => {
      const m: Record<string, number> = {};
      for (const v of vs) if (v.studentId === s.id) m[v.columnId] = v.value;
      const total = t ? computeTotal(t, cols, m) : null;
      return { studentId: s.id, name: s.fullName, code: s.code, norm: total == null || !t ? null : Math.round((total / t.scale) * 100) / 10 };
    });
    const graded = rows.filter((r) => r.norm != null);
    return {
      id: c.id, name: c.name, finished: c.finished, teacher: c.teacher?.fullName ?? null, template: t?.name ?? null, templateId: t?.id ?? null,
      students: studs.length, filled: vs.filter((v) => studs.some((s) => s.id === v.studentId)).length, expected: studs.length * cols.length,
      avgNorm: graded.length ? Math.round((graded.reduce((a, r) => a + r.norm!, 0) / graded.length) * 100) / 100 : null, graded: graded.length,
      cols: cols.map((col) => {
        const cv = vs.filter((v) => v.columnId === col.id);
        return { id: col.id, name: col.name, max: col.maxScore, avg: cv.length ? Math.round((cv.reduce((a, v) => a + v.value, 0) / cv.length) * 100) / 100 : null, filled: cv.length };
      }),
      rows,
    };
  });
}
