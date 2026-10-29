import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { Title } from "@/components/ui";
import { GradeGrid } from "./grid";

export default async function ClassGrades({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("ADMIN", "STAFF", "TEACHER");
  const { id } = await params;
  const c = await db.class.findUnique({
    where: { id },
    include: {
      gradeTemplate: { include: { columns: { orderBy: { order: "asc" } } } },
      teacher: true, assistant: true,
      enrollments: { where: { status: { in: ["ACTIVE", "PAUSED", "FINISHED"] } }, include: { student: true } },
    },
  });
  if (!c) notFound();
  if (me.role === "TEACHER" && c.teacher?.userId !== me.id && c.assistant?.userId !== me.id) notFound();
  const back = me.role === "TEACHER" ? "/lop-cua-toi" : `/lop-hoc/${id}`;
  if (!c.gradeTemplate) {
    return <div className="space-y-3"><Title>Bảng điểm: {c.name}</Title><p>Lớp chưa có bộ điểm. {me.role !== "TEACHER" && <Link className="underline" href={`/lop-hoc/${id}`}>Chọn bộ điểm cho lớp</Link>}</p></div>;
  }
  const t = c.gradeTemplate;
  const values = await db.gradeValue.findMany({ where: { classId: id } });
  const initial: Record<string, number> = {};
  for (const v of values) initial[`${v.studentId}|${v.columnId}`] = v.value;
  const seen = new Set<string>();
  const students = c.enrollments
    .filter((e) => !seen.has(e.studentId) && seen.add(e.studentId))
    .map((e) => ({ id: e.studentId, name: e.student.fullName, code: e.student.code }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  return (
    <div className="space-y-3">
      <Title right={<Link href={back} className="text-sm underline">← Quay lại</Link>}>Bảng điểm: {c.name}</Title>
      <p className="text-sm text-gray-600">
        Bộ điểm <b>{t.name}</b> · Tổng điểm tính theo: <code>{t.formula.trim() || "trung bình theo trọng số"}</code> (thang {t.scale})
      </p>
      <GradeGrid
        classId={id}
        cols={t.columns.map((x) => ({ id: x.id, name: x.name, key: x.key, weight: x.weight, maxScore: x.maxScore }))}
        tpl={{ formula: t.formula, scale: t.scale, missingAsZero: t.missingAsZero, ranks: t.ranks }}
        students={students}
        initial={initial}
      />
    </div>
  );
}
