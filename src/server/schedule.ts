import { db } from "@/lib/db";
import { addDays, overlaps } from "@/lib/format";

/** Sinh (lại) các buổi học PLANNED của lớp từ lịch lặp. Trả về danh sách cảnh báo trùng. */
export async function generateSessions(classId: string): Promise<string[]> {
  const cls = await db.class.findUniqueOrThrow({ where: { id: classId }, include: { schedules: true } });
  const holidays = new Set((await db.holiday.findMany()).map((h) => h.date.getTime()));
  const kept = await db.session.findMany({ where: { classId, status: { in: ["DONE", "CANCELLED"] }, isMakeup: false } });
  const doneCount = kept.filter((s) => s.status === "DONE").length;
  await db.session.deleteMany({ where: { classId, status: "PLANNED" } });

  const warnings: string[] = [];
  if (!cls.schedules.length) return ["Lớp chưa có lịch học"];
  const need = cls.totalSessions - doneCount;
  let d = cls.startDate;
  let made = 0;
  let last = cls.startDate;
  const lastKept = kept.reduce<Date | null>((m, s) => (!m || s.date > m ? s.date : m), null);
  if (lastKept && lastKept >= d) d = addDays(lastKept, 1);
  for (let guard = 0; made < need && guard < 2000; guard++, d = addDays(d, 1)) {
    if (holidays.has(d.getTime())) continue;
    for (const sc of cls.schedules.filter((x) => x.weekday === d.getUTCDay())) {
      if (made >= need) break;
      await db.session.create({
        data: { classId, date: d, startTime: sc.startTime, endTime: sc.endTime, teacherId: cls.teacherId, roomId: cls.roomId },
      });
      made++;
      last = d;
    }
  }
  await db.class.update({ where: { id: classId }, data: { endDate: last } });
  return [...warnings, ...(await findConflicts(classId))];
}

/** Trùng giáo viên / phòng với lớp khác. */
export async function findConflicts(classId: string): Promise<string[]> {
  const mine = await db.session.findMany({ where: { classId, status: "PLANNED" }, include: { class: true } });
  const out = new Set<string>();
  if (!mine.length) return [];
  const others = await db.session.findMany({
    where: {
      classId: { not: classId },
      status: { not: "CANCELLED" },
      date: { gte: mine[0].date, lte: mine[mine.length - 1].date },
    },
    include: { class: true },
  });
  for (const a of mine)
    for (const b of others) {
      if (a.date.getTime() !== b.date.getTime() || !overlaps(a.startTime, a.endTime, b.startTime, b.endTime)) continue;
      if (a.teacherId && a.teacherId === b.teacherId) out.add(`Trùng giáo viên với lớp "${b.class.name}" (${b.startTime}-${b.endTime})`);
      if (a.roomId && a.roomId === b.roomId) out.add(`Trùng phòng với lớp "${b.class.name}" (${b.startTime}-${b.endTime})`);
    }
  return [...out].slice(0, 5);
}

/** Thêm 1 buổi vào cuối chuỗi (khi có buổi nghỉ). */
export async function appendSession(classId: string) {
  const cls = await db.class.findUniqueOrThrow({ where: { id: classId }, include: { schedules: true } });
  if (!cls.schedules.length) return;
  const holidays = new Set((await db.holiday.findMany()).map((h) => h.date.getTime()));
  const lastS = await db.session.findFirst({ where: { classId, isMakeup: false }, orderBy: { date: "desc" } });
  let d = addDays(lastS?.date ?? cls.startDate, 1);
  for (let g = 0; g < 400; g++, d = addDays(d, 1)) {
    if (holidays.has(d.getTime())) continue;
    const sc = cls.schedules.find((x) => x.weekday === d.getUTCDay());
    if (!sc) continue;
    await db.session.create({
      data: { classId, date: d, startTime: sc.startTime, endTime: sc.endTime, teacherId: cls.teacherId, roomId: cls.roomId },
    });
    await db.class.update({ where: { id: classId }, data: { endDate: d } });
    return;
  }
}

/** Tính lại số buổi đã dùng của một ghi danh. */
export async function recalcEnrollment(studentId: string, classId: string) {
  const enr = await db.enrollment.findFirst({ where: { studentId, classId, status: { in: ["ACTIVE", "FINISHED"] } } });
  if (!enr) return;
  const counted = ["PRESENT", "LATE", "ABSENT"] as const;
  const own = await db.attendance.count({
    where: { studentId, status: { in: [...counted] }, makeupForId: null, session: { classId } },
  });
  const makeups = await db.attendance.count({
    where: { studentId, status: { in: ["PRESENT", "LATE"] }, makeupClassId: classId },
  });
  const used = own + makeups;
  const pending = await db.attendance.count({
    where: { studentId, status: "ABSENT_EXCUSED", makeupDone: false, session: { classId } },
  });
  await db.enrollment.update({
    where: { id: enr.id },
    data: { usedSessions: used, status: used >= enr.totalSessions && pending === 0 ? "FINISHED" : "ACTIVE" },
  });
}
