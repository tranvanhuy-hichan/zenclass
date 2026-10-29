"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertRole, STAFF_ROLES } from "@/lib/guard";
import { wrap, str, int, opt } from "@/lib/action";
import { parseDate, fmtDate, overlaps } from "@/lib/format";
import { audit } from "@/lib/audit";

const payOverride = (fd: FormData, isAdmin: boolean) => (isAdmin && str(fd, "payAmount") ? int(fd, "payAmount") : null);

/** Giáo viên có đang dạy buổi khác trùng giờ không? */
async function busyWith(teacherId: string, date: Date, start: string, end: string, exceptSessionIds: string[]) {
  const others = await db.session.findMany({ where: { teacherId, date, status: { not: "CANCELLED" }, id: { notIn: exceptSessionIds } }, include: { class: true } });
  return others.find((o) => overlaps(start, end, o.startTime, o.endTime));
}

async function notifyTeacher(teacherId: string | null, title: string, body: string) {
  if (!teacherId) return;
  const t = await db.teacher.findUnique({ where: { id: teacherId } });
  if (t?.userId) await db.notification.create({ data: { userId: t.userId, type: "SUBSTITUTE", title, body } });
}

async function assignOne(sessionId: string, teacherId: string, reason: string | null, pay: number | null) {
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { class: true } });
  if (s.status !== "PLANNED") throw new Error("Chỉ phân công được các buổi chưa dạy");
  if (s.teacherId === teacherId) throw new Error("Giáo viên này đang là người dạy buổi đó");
  const clash = await busyWith(teacherId, s.date, s.startTime, s.endTime, [sessionId]);
  if (clash) throw new Error(`Giáo viên đang dạy lớp "${clash.class.name}" lúc ${clash.startTime}-${clash.endTime} ngày ${fmtDate(s.date)}`);
  const original = s.originalTeacherId ?? s.teacherId;
  // phân công lại về đúng giáo viên gốc = không còn là dạy thế
  const back = original === teacherId;
  await db.session.update({
    where: { id: sessionId },
    data: { teacherId, originalTeacherId: back ? null : original, substituteReason: back ? null : reason, payAmount: back ? null : pay },
  });
  return { s, original, back };
}

export const assignSubstitute = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const sessionId = str(fd, "sessionId"), teacherId = str(fd, "teacherId");
  if (!teacherId) throw new Error("Chọn giáo viên dạy thế");
  const reason = opt(fd, "reason");
  const { s, original, back } = await assignOne(sessionId, teacherId, reason, payOverride(fd, me.role === "ADMIN"));
  const when = `${s.startTime} ngày ${fmtDate(s.date)}`;
  await notifyTeacher(teacherId, back ? "Trở lại dạy buổi gốc" : "Bạn được phân công dạy thế", `Lớp ${s.class.name}, ${when}.${reason ? " Lý do: " + reason : ""}`);
  if (original && original !== teacherId) await notifyTeacher(original, "Buổi dạy của bạn có người dạy thế", `Lớp ${s.class.name}, ${when} do giáo viên khác dạy thay.`);
  await audit(me.id, "assign-substitute", "Session", sessionId, { teacherId });
  revalidatePath("/phan-cong"); revalidatePath("/lich-hoc"); revalidatePath("/cong");
  return back ? "Đã trả buổi về giáo viên gốc" : "Đã phân công dạy thế";
});

/** Dạy thế cho cả lớp trong một khoảng ngày (vd: giáo viên nghỉ phép 1 tuần). */
export const assignRange = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const classId = str(fd, "classId"), teacherId = str(fd, "teacherId");
  if (!classId || !teacherId || !str(fd, "from") || !str(fd, "to")) throw new Error("Nhập đủ lớp, khoảng ngày và giáo viên dạy thế");
  const from = parseDate(str(fd, "from")), to = parseDate(str(fd, "to"));
  if (to < from) throw new Error("Ngày kết thúc phải sau ngày bắt đầu");
  const sessions = await db.session.findMany({ where: { classId, status: "PLANNED", date: { gte: from, lte: to } }, orderBy: [{ date: "asc" }, { startTime: "asc" }] });
  if (!sessions.length) throw new Error("Không có buổi nào chưa dạy trong khoảng ngày này");
  const reason = opt(fd, "reason"), pay = payOverride(fd, me.role === "ADMIN");
  let ok = 0; const skipped: string[] = [];
  for (const s of sessions) {
    try { await assignOne(s.id, teacherId, reason, pay); ok++; } catch (e) { skipped.push(`${fmtDate(s.date)}: ${(e as Error).message}`); }
  }
  const cls = await db.class.findUniqueOrThrow({ where: { id: classId } });
  if (ok) await notifyTeacher(teacherId, "Bạn được phân công dạy thế", `Lớp ${cls.name}: ${ok} buổi từ ${fmtDate(from)} đến ${fmtDate(to)}.`);
  await audit(me.id, "assign-substitute-range", "Class", classId, { teacherId, ok });
  revalidatePath("/phan-cong"); revalidatePath("/lich-hoc"); revalidatePath("/cong");
  return `Đã phân công ${ok}/${sessions.length} buổi.${skipped.length ? "\nBỏ qua:\n" + skipped.join("\n") : ""}`;
});

export const revertSubstitute = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const s = await db.session.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  if (!s.originalTeacherId) throw new Error("Buổi này không phải dạy thế");
  if (s.status === "DONE") throw new Error("Buổi đã dạy xong, không hoàn tác được");
  await db.session.update({ where: { id: s.id }, data: { teacherId: s.originalTeacherId, originalTeacherId: null, substituteReason: null, payAmount: null } });
  await audit(me.id, "revert-substitute", "Session", s.id);
  revalidatePath("/phan-cong"); revalidatePath("/lich-hoc"); revalidatePath("/cong");
  return "Đã hoàn tác, trả buổi về giáo viên gốc";
});
