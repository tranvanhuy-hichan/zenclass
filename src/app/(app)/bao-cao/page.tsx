import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { Card, Title } from "@/components/ui";
import { fmtMoney } from "@/lib/format";

function Bar({ label, v, max, color = "bg-orange-500" }: { label: string; v: number; max: number; color?: string }) {
  return <div className="flex items-center gap-2 text-xs"><span className="w-[4.5rem] shrink-0 whitespace-nowrap sm:w-20">{label}</span><div className="flex-1 bg-orange-50 rounded h-4"><div className={`${color} h-4 rounded`} style={{ width: `${max ? (v / max) * 100 : 0}%` }} /></div><span className="w-24 text-right">{fmtMoney(v)}</span></div>;
}

export default async function Reports() {
  await requireRole(...STAFF_ROLES);
  const now = new Date(Date.now() + 7 * 3600_000);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
    return { from: d, to: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)), label: `T${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(2)}` };
  });
  const since = months[0].from;
  // Một lượt lấy dữ liệu cho cả 6 tháng rồi cộng theo tháng (thay vì 18 truy vấn riêng lẻ), chạy song song với phần còn lại.
  const [payRows, expRows, stuRows, att, classes, debt] = await Promise.all([
    db.payment.findMany({ where: { paidAt: { gte: since } }, select: { amount: true, paidAt: true } }),
    db.expense.findMany({ where: { date: { gte: since } }, select: { amount: true, date: true } }),
    db.student.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.attendance.groupBy({ by: ["status"], _count: true, where: { status: { not: "PENDING" } } }),
    db.class.findMany({ where: { finished: false }, include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } }, orderBy: { name: "asc" } }),
    db.invoice.aggregate({ _sum: { total: true, paid: true }, where: { status: { in: ["UNPAID", "PARTIAL"] } } }),
  ]);
  const data = months.map((m) => ({
    ...m,
    income: payRows.filter((r) => r.paidAt >= m.from && r.paidAt < m.to).reduce((a, r) => a + r.amount, 0),
    expense: expRows.filter((r) => r.date >= m.from && r.date < m.to).reduce((a, r) => a + r.amount, 0),
    newStudents: stuRows.filter((r) => r.createdAt >= m.from && r.createdAt < m.to).length,
  }));
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const total = att.reduce((s, a) => s + a._count, 0);
  const present = att.filter((a) => ["PRESENT", "LATE"].includes(a.status)).reduce((s, a) => s + a._count, 0);
  return (
    <div className="space-y-4">
      <Title>Báo cáo</Title>
      <Card className="space-y-2">
        <h2 className="font-semibold">Thu / Chi 6 tháng gần nhất</h2>
        {data.map((d) => <div key={d.label} className="space-y-0.5"><Bar label={`${d.label} thu`} v={d.income} max={max} color="bg-green-500" /><Bar label="chi" v={d.expense} max={max} color="bg-red-400" /><div className="text-xs text-gray-500 pl-16">Lợi nhuận: <b>{fmtMoney(d.income - d.expense)}</b> · HV mới: {d.newStudents}</div></div>)}
      </Card>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
        <Card><div className="text-xs text-gray-500">Tỉ lệ chuyên cần</div><div className="text-2xl font-bold sm:text-3xl">{total ? Math.round((present / total) * 100) : 0}%</div><div className="text-xs text-gray-500">{present}/{total} lượt</div></Card>
        <Card className="order-last col-span-2 md:order-none md:col-span-1"><div className="text-xs text-gray-500">Công nợ hiện tại</div><div className="text-2xl font-bold text-red-600 sm:text-3xl">{fmtMoney((debt._sum.total ?? 0) - (debt._sum.paid ?? 0))}</div></Card>
        <Card><div className="text-xs text-gray-500">Vắng có phép / không phép</div><div className="text-2xl font-bold sm:text-3xl">{att.find((a) => a.status === "ABSENT_EXCUSED")?._count ?? 0} / {att.find((a) => a.status === "ABSENT")?._count ?? 0}</div></Card>
      </div>
      <Card className="space-y-1">
        <h2 className="font-semibold">Tỉ lệ lấp đầy lớp</h2>
        {classes.map((c) => <div key={c.id} className="flex items-center gap-2 text-xs"><span className="w-40 truncate">{c.name}</span><div className="flex-1 bg-orange-50 rounded h-3"><div className="bg-sky-500 h-3 rounded" style={{ width: `${Math.min(100, (c._count.enrollments / c.maxStudents) * 100)}%` }} /></div><span className="w-12 text-right">{c._count.enrollments}/{c.maxStudents}</span></div>)}
      </Card>
    </div>
  );
}
