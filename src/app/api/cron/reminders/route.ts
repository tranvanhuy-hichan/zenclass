import { db } from "@/lib/db";
import { notifyStudent } from "@/lib/notify";
import { addDays, isoDate, todayUTC, toMinutes } from "@/lib/format";

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
    include: { class: { include: { enrollments: { where: { status: "ACTIVE" } } } }, room: true },
  });
  for (const s of sessions) {
    const diff = toMinutes(s.startTime) - nowMin;
    if (diff > 0 && diff <= 60)
      for (const e of s.class.enrollments) {
        await notifyStudent(e.studentId, "REMIND", "Sắp đến giờ học", `Lớp ${s.class.name} học lúc ${s.startTime}${s.room ? " tại " + s.room.name : ""}.`, `remind:${s.id}:${e.studentId}`);
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
  return Response.json({ ok: true, checked: sessions.length, invoices: invs.length, sent });
}
