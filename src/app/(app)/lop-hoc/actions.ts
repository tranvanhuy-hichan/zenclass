"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertRole, STAFF_ROLES } from "@/lib/guard";
import { wrap, str, int, opt } from "@/lib/action";
import { parseDate } from "@/lib/format";
import { appendSession, generateSessions, recalcEnrollment } from "@/server/schedule";
import { notifyStudent } from "@/lib/notify";
import { audit } from "@/lib/audit";

function readSchedules(fd: FormData) {
  const days = fd.getAll("weekday").map(Number);
  const start = str(fd, "startTime"), end = str(fd, "endTime");
  if (!days.length || !start || !end || start >= end) throw new Error("Chọn thứ học và giờ hợp lệ");
  return days.map((weekday) => ({ weekday, startTime: start, endTime: end }));
}

export const createClass = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const name = str(fd, "name");
  if (!name || !str(fd, "startDate")) throw new Error("Nhập tên lớp và ngày bắt đầu");
  const c = await db.class.create({
    data: {
      name,
      mode: str(fd, "mode") === "ONLINE" ? "ONLINE" : "OFFLINE",
      teacherId: opt(fd, "teacherId"),
      assistantId: opt(fd, "assistantId"),
      coordinatorId: opt(fd, "coordinatorId"),
      billing: str(fd, "billing") === "MONTHLY" ? "MONTHLY" : "ONCE",
      ...(me.role === "ADMIN" ? { teacherRate: str(fd, "teacherRate") ? int(fd, "teacherRate") : null } : {}),
      roomId: opt(fd, "roomId"),
      startDate: parseDate(str(fd, "startDate")),
      totalSessions: int(fd, "totalSessions", 24),
      maxStudents: int(fd, "maxStudents", 20),
      tuitionFee: int(fd, "tuitionFee"),
      gradeTemplateId: opt(fd, "gradeTemplateId"),
      schedules: { create: readSchedules(fd) },
    },
  });
  await generateSessions(c.id);
  await audit(me.id, "create", "Class", c.id);
  revalidatePath("/lop-hoc");
  redirect(`/lop-hoc/${c.id}`);
});

export const updateClass = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  await db.class.update({
    where: { id },
    data: {
      name: str(fd, "name"),
      mode: str(fd, "mode") === "ONLINE" ? "ONLINE" : "OFFLINE",
      teacherId: opt(fd, "teacherId"),
      assistantId: opt(fd, "assistantId"),
      coordinatorId: opt(fd, "coordinatorId"),
      billing: str(fd, "billing") === "MONTHLY" ? "MONTHLY" : "ONCE",
      ...(me.role === "ADMIN" ? { teacherRate: str(fd, "teacherRate") ? int(fd, "teacherRate") : null } : {}),
      roomId: opt(fd, "roomId"),
      maxStudents: int(fd, "maxStudents", 20),
      tuitionFee: int(fd, "tuitionFee"),
      finished: fd.get("finished") === "on",
      gradeTemplateId: opt(fd, "gradeTemplateId"),
    },
  });
  // GV/phòng mới áp dụng cho các buổi chưa dạy
  const c = await db.class.findUniqueOrThrow({ where: { id } });
  // đổi GV/phòng của lớp: chỉ áp cho buổi chưa dạy và KHÔNG ghi đè các buổi đã phân công dạy thế
  await db.session.updateMany({ where: { classId: id, status: "PLANNED", originalTeacherId: null }, data: { teacherId: c.teacherId } });
  await db.session.updateMany({ where: { classId: id, status: "PLANNED" }, data: { roomId: c.roomId } });
  await audit(me.id, "update", "Class", id);
  revalidatePath(`/lop-hoc/${id}`);
});

export const updateSchedule = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  const rows = readSchedules(fd);
  await db.classSchedule.deleteMany({ where: { classId: id } });
  await db.classSchedule.createMany({ data: rows.map((r) => ({ ...r, classId: id })) });
  const warns = await generateSessions(id);
  revalidatePath(`/lop-hoc/${id}`);
  return `Đã sinh lại các buổi chưa dạy.${warns.length ? "\n⚠ " + warns.join("\n⚠ ") : ""}`;
});

export const deleteClass = wrap(async (fd) => {
  await assertRole("ADMIN");
  const id = str(fd, "id");
  if (await db.attendance.count({ where: { session: { classId: id } } })) throw new Error("Lớp đã có điểm danh, hãy đánh dấu 'Đã kết thúc' thay vì xoá");
  await db.enrollment.deleteMany({ where: { classId: id } });
  await db.class.delete({ where: { id } });
  redirect("/lop-hoc");
});

export const enrollStudent = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const classId = str(fd, "classId");
  const studentId = str(fd, "studentId");
  if (!studentId) throw new Error("Chọn học viên");
  const cls = await db.class.findUniqueOrThrow({ where: { id: classId } });
  const active = await db.enrollment.count({ where: { classId, status: "ACTIVE" } });
  if (active >= cls.maxStudents) throw new Error("Lớp đã đủ sĩ số");
  if (await db.enrollment.findFirst({ where: { classId, studentId, status: { in: ["ACTIVE", "PAUSED"] } } }))
    throw new Error("Học viên đã học lớp này");
  // trùng giờ với lớp khác của học viên
  const mine = await db.session.findMany({
    where: { status: "PLANNED", class: { enrollments: { some: { studentId, status: "ACTIVE" } } } },
    select: { date: true, startTime: true, endTime: true, class: { select: { name: true } } },
  });
  const theirs = await db.session.findMany({ where: { classId, status: "PLANNED" }, select: { date: true, startTime: true, endTime: true } });
  const { overlaps } = await import("@/lib/format");
  const clash = theirs.find((a) => mine.find((b) => a.date.getTime() === b.date.getTime() && overlaps(a.startTime, a.endTime, b.startTime, b.endTime)));
  let warn = "";
  if (clash) {
    const b = mine.find((m) => m.date.getTime() === clash.date.getTime() && overlaps(clash.startTime, clash.endTime, m.startTime, m.endTime))!;
    warn = `\n⚠ Học viên trùng giờ với lớp "${b.class.name}"`;
  }
  const done = await db.session.count({ where: { classId, status: { in: ["DONE"] } } });
  await db.enrollment.create({
    data: { studentId, classId, startDate: new Date(), totalSessions: Math.max(cls.totalSessions - done, 1) },
  });
  await audit(me.id, "enroll", "Enrollment", studentId, { classId });
  revalidatePath(`/lop-hoc/${classId}`);
  return `Đã ghi danh.${warn}`;
});

export const setEnrollment = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  const status = str(fd, "status") as "ACTIVE" | "PAUSED" | "DROPPED";
  const e = await db.enrollment.update({ where: { id }, data: { status } });
  await audit(me.id, `enrollment-${status}`, "Enrollment", id);
  await recalcEnrollment(e.studentId, e.classId);
  revalidatePath(`/lop-hoc/${e.classId}`);
  revalidatePath(`/hoc-vien/${e.studentId}`);
});

export const transferStudent = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const e = await db.enrollment.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  const toClass = str(fd, "toClassId");
  if (!toClass || toClass === e.classId) throw new Error("Chọn lớp khác");
  const target = await db.class.findUniqueOrThrow({ where: { id: toClass } });
  const remain = Math.max(e.totalSessions - e.usedSessions, 0);
  await db.enrollment.update({ where: { id: e.id }, data: { status: "FINISHED", totalSessions: e.usedSessions } });
  await db.enrollment.create({ data: { studentId: e.studentId, classId: toClass, startDate: new Date(), totalSessions: remain || target.totalSessions } });
  await audit(me.id, "transfer", "Enrollment", e.id, { toClass });
  revalidatePath(`/lop-hoc/${e.classId}`);
  return "Đã chuyển lớp, giữ nguyên số buổi còn lại";
});

export const cancelSession = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  const s = await db.session.update({ where: { id }, data: { status: "CANCELLED", note: opt(fd, "note") ?? "Lớp nghỉ" } });
  await appendSession(s.classId);
  const cls = await db.class.findUniqueOrThrow({ where: { id: s.classId }, include: { enrollments: { where: { status: "ACTIVE" } } } });
  const when = `${s.startTime} ${s.date.toISOString().slice(0, 10)}`;
  for (const e of cls.enrollments)
    await notifyStudent(e.studentId, "CLASS_CANCELLED", "Lớp nghỉ", `Lớp ${cls.name} nghỉ buổi ${when}. Buổi học được lùi về cuối khoá.`, `cancel:${id}`);
  await audit(me.id, "cancel-session", "Session", id);
  revalidatePath(`/lop-hoc/${s.classId}`);
  revalidatePath("/lich-hoc");
  return "Đã cho lớp nghỉ, lùi 1 buổi về cuối khoá và báo phụ huynh";
});

export const updateSession = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  const s = await db.session.findUniqueOrThrow({ where: { id } });
  const date = str(fd, "date") ? parseDate(str(fd, "date")) : s.date;
  const startTime = str(fd, "startTime") || s.startTime;
  const endTime = str(fd, "endTime") || s.endTime;
  if (startTime >= endTime) throw new Error("Giờ không hợp lệ");
  const teacherId = fd.has("teacherId") ? opt(fd, "teacherId") : s.teacherId;
  const roomId = fd.has("roomId") ? opt(fd, "roomId") : s.roomId;
  const { overlaps } = await import("@/lib/format");
  const same = await db.session.findMany({ where: { id: { not: id }, date, status: { not: "CANCELLED" } }, include: { class: true } });
  const bad = same.find((o) => overlaps(startTime, endTime, o.startTime, o.endTime) && ((teacherId && o.teacherId === teacherId) || (roomId && o.roomId === roomId)));
  if (bad) throw new Error(`Trùng giáo viên/phòng với lớp "${bad.class.name}"`);
  // đổi giáo viên của 1 buổi so với GV của lớp = dạy thế (tính lương cho GV mới)
  const cls = await db.class.findUniqueOrThrow({ where: { id: s.classId } });
  const changed = teacherId !== s.teacherId;
  const original = s.originalTeacherId ?? s.teacherId ?? cls.teacherId;
  const sub = changed ? (teacherId && teacherId !== original ? original : null) : s.originalTeacherId;
  await db.session.update({ where: { id }, data: { date, startTime, endTime, teacherId, roomId, ...(changed ? { originalTeacherId: sub, ...(sub ? {} : { substituteReason: null, payAmount: null }) } : {}) } });
  revalidatePath("/lich-hoc");
  revalidatePath(`/lop-hoc/${s.classId}`);
});
