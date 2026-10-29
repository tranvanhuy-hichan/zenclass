"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertRole, getMe, teachingIds } from "@/lib/guard";
import { wrap, str } from "@/lib/action";
import { recalcEnrollment } from "@/server/schedule";
import { notifyStudent } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { todayUTC } from "@/lib/format";
import type { AttendanceStatus } from "@prisma/client";

const STATUSES = ["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT"];

async function canMark(sessionId: string) {
  const me = await assertRole("ADMIN", "STAFF", "TEACHER");
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { class: true, teacher: true } });
  if (me.role === "TEACHER") {
    const ids = await teachingIds(me.id);
    const ok = (ids.teacherId && s.teacherId === ids.teacherId) || (ids.assistantId && s.class.assistantId === ids.assistantId);
    if (!ok) throw new Error("Bạn không phụ trách buổi này");
    const { maxEditDays } = await getSettings();
    if ((todayUTC().getTime() - s.date.getTime()) / 86400_000 > maxEditDays) throw new Error("Đã quá hạn chỉnh sửa điểm danh, liên hệ quản lý");
  }
  if (s.date.getTime() > todayUTC().getTime() && me.role === "TEACHER") throw new Error("Chưa đến ngày học");
  return { me, s };
}

export const saveAttendance = wrap(async (fd) => {
  const sessionId = str(fd, "sessionId");
  const { me, s } = await canMark(sessionId);
  if (s.status === "CANCELLED") throw new Error("Buổi này đã nghỉ");
  const studentIds = fd.getAll("studentId").map(String);
  const touched = new Set<string>();
  for (const studentId of studentIds) {
    const status = str(fd, `st_${studentId}`);
    if (!STATUSES.includes(status)) continue;
    const prev = await db.attendance.findUnique({ where: { sessionId_studentId: { sessionId, studentId } } });
    const note = str(fd, `note_${studentId}`) || null;
    await db.attendance.upsert({
      where: { sessionId_studentId: { sessionId, studentId } },
      update: { status: status as AttendanceStatus, note, markedBy: me.id, markedAt: new Date() },
      create: { sessionId, studentId, status: status as AttendanceStatus, note, markedBy: me.id },
    });
    // buổi học bù: tính vào lớp gốc
    const enr = prev?.makeupClassId ?? null;
    touched.add(`${studentId}|${enr ?? s.classId}`);
    if (status === "ABSENT_EXCUSED" || status === "ABSENT") {
      if (prev?.status !== status)
        await notifyStudent(studentId, "ABSENT", "Báo vắng mặt", `Học viên vắng buổi ${s.class.name} ngày ${s.date.toISOString().slice(0, 10)}.`, `absent:${sessionId}:${studentId}`);
    }
  }
  await db.session.update({ where: { id: sessionId }, data: { status: "DONE" } });
  for (const k of touched) {
    const [stu, cls] = k.split("|");
    await recalcEnrollment(stu, cls);
    const e = await db.enrollment.findFirst({ where: { studentId: stu, classId: cls, status: "ACTIVE" } });
    if (e) {
      const left = e.totalSessions - e.usedSessions;
      if (left === 3 || left === 0)
        await notifyStudent(stu, "RENEW", left ? "Sắp hết khoá học" : "Đã hết buổi", `Khoá ${s.class.name} ${left ? "còn 3 buổi" : "đã hết buổi"}. Vui lòng liên hệ trung tâm để gia hạn.`, `renew:${e.id}:${left}`);
    }
  }
  revalidatePath(`/diem-danh/${sessionId}`);
  revalidatePath("/");
  return "Đã lưu điểm danh";
});

/** Xếp học bù: học viên nghỉ có phép vào 1 buổi khác. */
export const arrangeMakeup = wrap(async (fd) => {
  await assertRole("ADMIN", "STAFF");
  const absentId = str(fd, "absentId");
  const sessionId = str(fd, "sessionId");
  if (!sessionId) throw new Error("Chọn buổi học bù");
  const ab = await db.attendance.findUniqueOrThrow({ where: { id: absentId }, include: { session: true } });
  const target = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { class: true } });
  if (await db.attendance.findUnique({ where: { sessionId_studentId: { sessionId, studentId: ab.studentId } } }))
    throw new Error("Học viên đã có mặt trong buổi này");
  await db.attendance.create({
    data: { sessionId, studentId: ab.studentId, status: "PENDING", makeupForId: absentId, makeupClassId: ab.session.classId, note: "Học bù" },
  });
  await db.attendance.update({ where: { id: absentId }, data: { makeupDone: true } });
  await notifyStudent(ab.studentId, "MAKEUP", "Lịch học bù", `Bạn được xếp học bù lớp ${target.class.name} ngày ${target.date.toISOString().slice(0, 10)} lúc ${target.startTime}.`);
  revalidatePath(`/hoc-vien/${ab.studentId}`);
  return "Đã xếp học bù";
});

export async function currentTeacherId() {
  const me = await getMe();
  if (!me) return null;
  return (await db.teacher.findUnique({ where: { userId: me.id } }))?.id ?? null;
}
