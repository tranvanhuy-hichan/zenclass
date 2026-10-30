"use server";
import { cancelPendingLinks } from "@/server/pay-cancel";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertRole, STAFF_ROLES } from "@/lib/guard";
import { wrap, str, int, opt } from "@/lib/action";
import { parseDate } from "@/lib/format";
import { notifyStudent } from "@/lib/notify";
import { audit } from "@/lib/audit";

async function nextCode() {
  const n = await db.invoice.count();
  for (let i = 1; ; i++) {
    const code = `PT${String(n + i).padStart(5, "0")}`;
    if (!(await db.invoice.findFirst({ where: { code } }))) return code;
  }
}

export async function refreshInvoice(invoiceId: string) {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true } });
  if (inv.status === "VOID") return;
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
  await db.invoice.update({ where: { id: invoiceId }, data: { paid, status: paid >= inv.total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID" } });
}

export const createInvoice = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const studentId = str(fd, "studentId");
  const desc = fd.getAll("desc").map(String);
  const amt = fd.getAll("amount").map((a) => parseInt(String(a).replace(/\D/g, ""), 10) || 0);
  const items = desc.map((d, i) => ({ description: d.trim(), amount: amt[i] })).filter((i) => i.description && i.amount > 0);
  if (!studentId || !items.length) throw new Error("Chọn học viên và nhập ít nhất 1 khoản thu");
  const total = items.reduce((s, i) => s + i.amount, 0);
  const inv = await db.invoice.create({
    data: {
      code: await nextCode(), studentId, total, note: opt(fd, "note"),
      dueDate: str(fd, "dueDate") ? parseDate(str(fd, "dueDate")) : null,
      items: { create: items },
    },
  });
  await notifyStudent(studentId, "INVOICE", "Phiếu báo học phí", `Phiếu ${inv.code}: cần thanh toán ${total.toLocaleString("vi-VN")}đ. Vào mục Học phí để xem mã QR.`);
  await audit(me.id, "create", "Invoice", inv.id);
  redirect(`/tai-chinh/${inv.id}`);
});

export const addPayment = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const invoiceId = str(fd, "invoiceId");
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (inv.status === "VOID") throw new Error("Phiếu đã huỷ");
  const amount = int(fd, "amount");
  if (amount <= 0) throw new Error("Số tiền không hợp lệ");
  if (amount > inv.total - inv.paid) throw new Error("Số tiền vượt quá số còn nợ");
  const method = (["CASH", "BANK", "QR"].includes(str(fd, "method")) ? str(fd, "method") : "CASH") as "CASH" | "BANK" | "QR";
  await db.payment.create({ data: { invoiceId, amount, method, receivedBy: me.id } });
  await refreshInvoice(invoiceId);
  await cancelPendingLinks(invoiceId); // link PayOS cũ không còn đúng số tiền nợ
  await notifyStudent(inv.studentId, "PAYMENT", "Đã nhận học phí", `Trung tâm đã nhận ${amount.toLocaleString("vi-VN")}đ cho phiếu ${inv.code}. Cảm ơn!`);
  await audit(me.id, "payment", "Invoice", invoiceId, { amount });
  revalidatePath(`/tai-chinh/${invoiceId}`);
  revalidatePath("/tai-chinh");
});

export const voidInvoice = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  if (await db.payment.count({ where: { invoiceId: id } })) throw new Error("Phiếu đã có thanh toán, không thể huỷ");
  await db.invoice.update({ where: { id }, data: { status: "VOID" } });
  await cancelPendingLinks(id);
  await audit(me.id, "void", "Invoice", id);
  revalidatePath(`/tai-chinh/${id}`);
  revalidatePath("/tai-chinh");
});

export const refundPayment = wrap(async (fd) => {
  const me = await assertRole("ADMIN");
  const p = await db.payment.delete({ where: { id: str(fd, "id") } });
  await refreshInvoice(p.invoiceId);
  await audit(me.id, "refund", "Payment", p.id, { amount: p.amount });
  revalidatePath(`/tai-chinh/${p.invoiceId}`);
});

export const addExpense = wrap(async (fd) => {
  const me = await assertRole(...STAFF_ROLES);
  const amount = int(fd, "amount");
  const category = str(fd, "category");
  if (!category || amount <= 0) throw new Error("Nhập hạng mục và số tiền");
  await db.expense.create({ data: { category, amount, note: opt(fd, "note"), date: str(fd, "date") ? parseDate(str(fd, "date")) : new Date() } });
  await audit(me.id, "create", "Expense");
  revalidatePath("/tai-chinh");
});

export const deleteExpense = wrap(async (fd) => {
  await assertRole("ADMIN");
  await db.expense.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/tai-chinh");
});
