import { db } from "@/lib/db";
import { getMe } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { todayUTC, WEEKDAYS } from "@/lib/format";
import { buildSchedulePdf } from "@/server/schedule-pdf";

/** Lịch học của một học viên dạng PDF (quản trị / nhân viên). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!me || !["ADMIN", "STAFF"].includes(me.role)) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const s = await db.student.findUnique({ where: { id } });
  if (!s) return new Response("Not found", { status: 404 });
  const [st, enr] = await Promise.all([
    getSettings(),
    db.enrollment.findMany({ where: { studentId: id, status: { in: ["ACTIVE", "PAUSED"] } }, include: { class: { include: { teacher: true, schedules: true } } }, orderBy: { startDate: "desc" } }),
  ]);
  const sessions = await db.session.findMany({
    where: { date: { gte: todayUTC() }, status: { not: "CANCELLED" }, classId: { in: enr.map((e) => e.classId) } },
    include: { class: true, room: { include: { branch: true } }, teacher: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 60,
  });
  const bytes = await buildSchedulePdf({
    centerName: st.name,
    student: { code: s.code, fullName: s.fullName, gradeLevel: s.gradeLevel },
    classes: enr.map((e) => ({ name: e.class.name, teacher: e.class.teacher?.fullName ?? "", status: e.status, weekly: e.class.schedules.map((x) => `${WEEKDAYS[x.weekday]} ${x.startTime}-${x.endTime}`).join(", ") })),
    sessions: sessions.map((x) => ({ date: x.date, time: `${x.startTime}-${x.endTime}`, className: x.class.name, room: x.room ? `${x.room.name}${x.room.branch ? ` · ${x.room.branch.name.replace(/^Cơ sở\s+/i, "")}` : ""}` : "", teacher: x.teacher?.fullName ?? "", status: x.status })),
  });
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="lich-hoc-${s.code}.pdf"`, "Cache-Control": "private, no-store" } });
}
