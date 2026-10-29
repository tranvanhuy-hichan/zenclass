"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertRole } from "@/lib/guard";
import { wrap, str, opt } from "@/lib/action";
import { audit } from "@/lib/audit";
import { computePay, monthRange } from "@/server/payroll";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export const lockPayroll = wrap(async (fd) => {
  const me = await assertRole("ADMIN");
  const teacherId = str(fd, "teacherId"), month = str(fd, "month");
  if (!MONTH.test(month)) throw new Error("Tháng không hợp lệ");
  if (await db.payroll.findUnique({ where: { teacherId_month: { teacherId, month } } })) throw new Error("Bảng lương tháng này đã chốt");
  const t = await db.teacher.findUniqueOrThrow({ where: { id: teacherId } });
  const { from, to } = monthRange(month);
  const sessions = await db.session.findMany({ where: { teacherId, status: "DONE", date: { gte: from, lt: to } }, select: { startTime: true, endTime: true, originalTeacherId: true, payAmount: true, class: { select: { teacherRate: true } } } });
  const p = computePay(t, sessions);
  const adj = parseInt(str(fd, "adjustment").replace(/[^\d-]/g, ""), 10);
  await db.payroll.create({ data: { teacherId, month, sessions: p.sessions, hours: p.hours, baseAmount: p.base, substituteAmount: p.substitute, adjustment: Number.isFinite(adj) ? adj : 0, note: opt(fd, "note"), status: "LOCKED" } });
  await audit(me.id, "lock-payroll", "Payroll", teacherId, { month });
  revalidatePath("/cong");
  return "Đã chốt bảng lương";
});

export const unlockPayroll = wrap(async (fd) => {
  const me = await assertRole("ADMIN");
  const p = await db.payroll.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  if (p.status === "PAID") throw new Error("Đã trả lương, không thể mở lại");
  await db.payroll.delete({ where: { id: p.id } });
  await audit(me.id, "unlock-payroll", "Payroll", p.id);
  revalidatePath("/cong");
});

export const payPayroll = wrap(async (fd) => {
  const me = await assertRole("ADMIN");
  const p = await db.payroll.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  if (p.status === "PAID") throw new Error("Đã trả lương rồi");
  const t = await db.teacher.findUniqueOrThrow({ where: { id: p.teacherId } });
  const amount = p.baseAmount + p.substituteAmount + p.adjustment;
  await db.$transaction([
    db.payroll.update({ where: { id: p.id }, data: { status: "PAID", paidAt: new Date(), paidBy: me.id } }),
    db.expense.create({ data: { category: "Lương giáo viên", amount, note: `Lương ${t.fullName} - ${p.month}` } }),
  ]);
  await audit(me.id, "pay-payroll", "Payroll", p.id, { amount });
  revalidatePath("/cong");
  revalidatePath("/tai-chinh");
  return "Đã ghi nhận trả lương và tạo khoản chi";
});
