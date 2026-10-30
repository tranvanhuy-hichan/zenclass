import { db } from "@/lib/db";
import { notifyStudent } from "@/lib/notify";
import { addDays, isoDate, todayUTC, toMinutes, roomLabel } from "@/lib/format";

/** Gọi định kỳ (mỗi 5–15 phút) bằng cron: Authorization: Bearer $CRON_SECRET */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });
  const nowVN = new Date(Date.now() + 7 * 3600_000);
  const nowMin = nowVN.getUTCHours() * 60 + nowVN.getUTCMinutes();
  const today = todayUTC();
  let sent = 0;

  // 1) nhắc 60 phút trước buổi học
  const sessions = await db.session.findMany({
    where: { date: today, status: "PLANNED" },
    include: { class: { include: { enrollments: { where: { status: "ACTIVE" } } } }, room: { include: { branch: true } } },
  });
  for (const s of sessions) {
    const diff = toMinutes(s.startTime) - nowMin;
    if (diff > 0 && diff <= 60)
      for (const e of s.class.enrollments) {
        await notifyStudent(e.studentId, "REMIND", "Sắp đến giờ học", `Lớp ${s.class.name} học lúc ${s.startTime}${s.room ? " tại " + roomLabel(s.room) : ""}.`, `remind:${s.id}:${e.studentId}`);
        sent++;
      }
  }
  // 2) nhắc học phí: đến hạn / quá hạn (mỗi tuần nhắc 1 lần)
  const week = Math.floor(today.getTime() / (7 * 86400_000));
  const invs = await db.invoice.findMany({ where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lte: addDays(today, 1) } } });
  for (const i of invs) {
    await notifyStudent(i.studentId, "DUE", "Nhắc đóng học phí", `Phiếu ${i.code} còn ${(i.total - i.paid).toLocaleString("vi-VN")}đ, hạn ${isoDate(i.dueDate!)}. Vui lòng thanh toán.`, `due:${i.id}:${week}`);
    sent++;
  }
  // 3) buổi đã kết thúc >30 phút mà chưa điểm danh: nhắc giáo viên; quá ngày thì báo giáo vụ/quản trị (mỗi ngày 1 lần)
  const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const cutoff = Math.max(nowMin - 30, 0);
  const stale = await db.session.findMany({
    where: { status: "PLANNED", OR: [{ date: today, endTime: { lte: hhmm(cutoff) } }, { date: { lt: today } }] },
    include: { class: true, teacher: true },
  });
  for (const s of stale) {
    if (s.teacher?.userId) {
      try { await db.notification.create({ data: { userId: s.teacher.userId, type: "ATTEND", title: "Chưa điểm danh", body: `Lớp ${s.class.name} ngày ${isoDate(s.date)} (${s.startTime}-${s.endTime}) chưa được điểm danh.`, dedupe: `stale:${s.id}:${s.teacher.userId}:${isoDate(today)}` } }); sent++; } catch (e) { if ((e as { code?: string }).code !== "P2002") throw e; }
    }
  }
  const staff = await db.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] }, isActive: true }, select: { id: true } });
  const old = stale.filter((s) => s.date < today);
  if (old.length) for (const u of staff) {
    try { await db.notification.create({ data: { userId: u.id, type: "ATTEND", title: `${old.length} buổi quá hạn chưa xử lý`, body: "Có buổi học đã qua ngày nhưng chưa điểm danh hoặc cho nghỉ. Mở Trang chủ để xử lý.", dedupe: `stale-day:${isoDate(today)}:${u.id}` } }); sent++; } catch (e) { if ((e as { code?: string }).code !== "P2002") throw e; }
  }
  return Response.json({ ok: true, checked: sessions.length, invoices: invs.length, stale: stale.length, sent });
}
