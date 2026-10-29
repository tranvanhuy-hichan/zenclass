import { db } from "@/lib/db";
import { getMe } from "@/lib/guard";
import { computeTotal, rankOf } from "@/lib/grade";
import { loadStudents, STATUS_LABEL } from "@/server/status";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const me = await getMe();
  if (!me || !["ADMIN", "STAFF"].includes(me.role)) return new Response("Forbidden", { status: 403 });
  const { kind } = await params;
  let rows: unknown[][] = [];
  if (kind === "students") {
    rows = [["Mã", "Họ tên", "SĐT", "Phụ huynh", "SĐT PH", "Trạng thái", "Số buổi còn"]];
    for (const s of await loadStudents()) {
      const p = s.parentId ? await db.parent.findUnique({ where: { id: s.parentId } }) : null;
      rows.push([s.code, s.fullName, s.phone, p?.fullName, p?.phone, STATUS_LABEL[s.status], s.remain]);
    }
  } else if (kind === "invoices") {
    rows = [["Mã phiếu", "Học viên", "Ngày", "Tổng", "Đã thu", "Trạng thái"]];
    for (const i of await db.invoice.findMany({ include: { student: true }, orderBy: { issueDate: "desc" } }))
      rows.push([i.code, i.student.fullName, i.issueDate.toISOString().slice(0, 10), i.total, i.paid, i.status]);
  } else if (kind === "grades") {
    const classId = new URL(req.url).searchParams.get("classId") ?? "";
    const c = await db.class.findUnique({ where: { id: classId }, include: { gradeTemplate: { include: { columns: { orderBy: { order: "asc" } } } }, enrollments: { include: { student: true } } } });
    if (!c?.gradeTemplate) return new Response("Not found", { status: 404 });
    const t = c.gradeTemplate;
    const vals = await db.gradeValue.findMany({ where: { classId } });
    rows = [["Mã", "Họ tên", ...t.columns.map((x) => x.name), "Tổng", "Xếp loại"]];
    for (const e of c.enrollments) {
      const v: Record<string, number> = {};
      for (const g of vals.filter((g) => g.studentId === e.studentId)) v[g.columnId] = g.value;
      const total = computeTotal(t, t.columns, v);
      rows.push([e.student.code, e.student.fullName, ...t.columns.map((x) => v[x.id]), total, rankOf(total, t.ranks)]);
    }
  } else return new Response("Not found", { status: 404 });
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename=${kind}.csv` } });
}
