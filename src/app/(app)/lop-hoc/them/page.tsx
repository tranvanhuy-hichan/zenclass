import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { Title } from "@/components/ui";
import { isoDate, todayUTC } from "@/lib/format";
import { NewClassForm } from "./new-class-form";

export default async function NewClass() {
  const me = await requireRole(...STAFF_ROLES);
  const [teachers, assistants, coordinators, rooms, templates, courses, branches] = await Promise.all([
    db.teacher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, specialty: true } }),
    db.assistant.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    db.coordinator.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    db.room.findMany({ orderBy: [{ branch: { name: "asc" } }, { name: "asc" }], select: { id: true, name: true, capacity: true, branchId: true } }),
    db.gradeTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.course.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.branch.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="space-y-4">
      <Title right={<Link href="/lop-hoc" className="text-sm underline">← Danh sách lớp</Link>}>Thêm lớp học</Title>
      <NewClassForm
        teachers={teachers.map((t) => ({ id: t.id, label: t.specialty ? `${t.fullName} · ${t.specialty}` : t.fullName }))}
        assistants={assistants.map((t) => ({ id: t.id, label: t.fullName }))}
        coordinators={coordinators.map((t) => ({ id: t.id, label: t.fullName }))}
        courses={courses.map((c) => ({ id: c.id, label: c.name }))}
        branches={branches}
        rooms={rooms.map((r) => ({ id: r.id, name: r.name, branchId: r.branchId, capacity: r.capacity }))}
        templates={templates.map((t) => ({ id: t.id, label: t.name }))}
        today={isoDate(todayUTC())}
        showRate={me.role === "ADMIN"}
      />
    </div>
  );
}
