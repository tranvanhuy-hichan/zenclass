import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, Title } from "@/components/ui";
import { WEEKDAYS, fmtDate, roomLabel } from "@/lib/format";
import { saveAttendance } from "../actions";

const OPTS: [string, string, string][] = [
  ["PRESENT", "Có mặt", "bg-green-100"],
  ["LATE", "Muộn", "bg-yellow-100"],
  ["ABSENT_EXCUSED", "Vắng có phép", "bg-sky-100"],
  ["ABSENT", "Vắng", "bg-red-100"],
];

export default async function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN", "STAFF", "TEACHER");
  const { id } = await params;
  const s = await db.session.findUnique({
    where: { id },
    include: { class: { include: { enrollments: { where: { status: "ACTIVE" }, include: { student: true } } } }, attendances: { include: { student: true } }, teacher: true, room: { include: { branch: true } } },
  });
  if (!s) notFound();
  const map = new Map(s.attendances.map((a) => [a.studentId, a]));
  const people = new Map<string, { id: string; name: string; code: string; makeup: boolean }>();
  for (const e of s.class.enrollments) people.set(e.studentId, { id: e.studentId, name: e.student.fullName, code: e.student.code, makeup: false });
  for (const a of s.attendances) if (!people.has(a.studentId)) people.set(a.studentId, { id: a.studentId, name: a.student.fullName, code: a.student.code, makeup: true });
  const list = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));

  return (
    <div className="space-y-4">
      <Title right={<Link href="/" className="hidden text-sm underline md:inline">← Quay lại</Link>}>Điểm danh: {s.class.name}</Title>
      <div className="text-sm text-gray-600">
        {WEEKDAYS[s.date.getUTCDay()]} {fmtDate(s.date)} · {s.startTime}-{s.endTime} · GV: {s.teacher?.fullName ?? "-"} · Phòng: {roomLabel(s.room) ?? "-"}
        {s.status === "CANCELLED" && <b className="text-red-600"> · BUỔI NGHỈ</b>}
      </div>
      <Card>
        <ActionForm action={saveAttendance} submit="Lưu điểm danh" reset={false} className="space-y-2">
          <input type="hidden" name="sessionId" value={s.id} />
          {list.map((p) => {
            const a = map.get(p.id);
            return (
              <div key={p.id} className="flex flex-wrap gap-2 items-center border-b pb-2">
                <input type="hidden" name="studentId" value={p.id} />
                <div className="w-48 text-sm font-medium">{p.name} <span className="text-xs text-gray-500">{p.code}</span>{p.makeup && <span className="ml-1 text-xs bg-purple-100 px-1 rounded">Học bù</span>}</div>
                <div className="flex gap-1 flex-wrap">
                  {OPTS.map(([v, l, c]) => (
                    <label key={v} className={`text-xs px-2 py-1 rounded-full border cursor-pointer has-[:checked]:ring-2 has-[:checked]:ring-orange-500 ${c}`}>
                      <input type="radio" className="sr-only" name={`st_${p.id}`} value={v} defaultChecked={a ? a.status === v : v === "PRESENT" && s.status !== "DONE" && !a} /> {l}
                    </label>
                  ))}
                </div>
                <input name={`note_${p.id}`} defaultValue={a?.note ?? ""} placeholder="Ghi chú" className="border rounded px-2 py-1 text-xs flex-1 min-w-24" />
              </div>
            );
          })}
          {!list.length && <p className="text-sm text-gray-500">Lớp chưa có học viên.</p>}
        </ActionForm>
      </Card>
    </div>
  );
}
