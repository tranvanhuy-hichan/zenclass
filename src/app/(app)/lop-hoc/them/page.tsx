import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { Title } from "@/components/ui";
import { isoDate, todayUTC } from "@/lib/format";
import { NewClassForm } from "./new-class-form";

export default async function NewClass() {
  const me = await requireRole(...STAFF_ROLES);
  const [teachers, assistants, coordinators, rooms, templates] = await Promise.all([
    db.teacher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, specialty: true } }),
    db.assistant.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    db.coordinator.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    db.room.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, capacity: true } }),
    db.gradeTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="space-y-4">
      <Title right={<Link href="/lop-hoc" className="text-sm underline">← Danh sách lớp</Link>}>Thêm lớp học</Title>
      <NewClassForm
        teachers={teachers.map((t) => ({ id: t.id, label: t.specialty ? `${t.fullName} · ${t.specialty}` : t.fullName }))}
        assistants={assistants.map((t) => ({ id: t.id, label: t.fullName }))}
        coordinators={coordinators.map((t) => ({ id: t.id, label: t.fullName }))}
        rooms={rooms.map((r) => ({ id: r.id, label: `${r.name} (${r.capacity} chỗ)` }))}
        templates={templates.map((t) => ({ id: t.id, label: t.name }))}
        today={isoDate(todayUTC())}
        showRate={me.role === "ADMIN"}
      />
    </div>
  );
}
