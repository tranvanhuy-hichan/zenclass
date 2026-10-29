import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { Card, Title } from "@/components/ui";
import { fmtMoney } from "@/lib/format";

function Bar({ label, v, max, color = "bg-orange-500" }: { label: string; v: number; max: number; color?: string }) {
  return <div className="flex items-center gap-2 text-xs"><span className="w-16">{label}</span><div className="flex-1 bg-orange-50 rounded h-4"><div className={`${color} h-4 rounded`} style={{ width: `${max ? (v / max) * 100 : 0}%` }} /></div><span className="w-24 text-right">{fmtMoney(v)}</span></div>;
}

export default async function Reports() {
  await requireRole(...STAFF_ROLES);
  const now = new Date(Date.now() + 7 * 3600_000);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
    return { from: d, to: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)), label: `T${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(2)}` };
  });
  const data = await Promise.all(months.map(async (m) => ({
    ...m,
    income: (await db.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: m.from, lt: m.to } } }))._sum.amount ?? 0,
    expense: (await db.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: m.from, lt: m.to } } }))._sum.amount ?? 0,
    newStudents: await db.student.count({ where: { createdAt: { gte: m.from, lt: m.to } } }),
  })));
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const [att, classes, debt] = await Promise.all([
    db.attendance.groupBy({ by: ["status"], _count: true, where: { status: { not: "PENDING" } } }),
    db.class.findMany({ where: { finished: false }, include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } }, orderBy: { name: "asc" } }),
    db.invoice.aggregate({ _sum: { total: true, paid: true }, where: { status: { in: ["UNPAID", "PARTIAL"] } } }),
  ]);
  const total = att.reduce((s, a) => s + a._count, 0);
  const present = att.filter((a) => ["PRESENT", "LATE"].includes(a.status)).reduce((s, a) => s + a._count, 0);
  return (
    <div className="space-y-4">
      <Title>Báo cáo</Title>
      <Card className="space-y-2">
        <h2 className="font-semibold">Thu / Chi 6 tháng gần nhất</h2>
        {data.map((d) => <div key={d.label} className="space-y-0.5"><Bar label={`${d.label} thu`} v={d.income} max={max} color="bg-green-500" /><Bar label="chi" v={d.expense} max={max} color="bg-red-400" /><div className="text-xs text-gray-500 pl-16">Lợi nhuận: <b>{fmtMoney(d.income - d.expense)}</b> · HV mới: {d.newStudents}</div></div>)}
      </Card>
      <div className="grid md:grid-cols-3 gap-3">
        <Card><div className="text-xs text-gray-500">Tỉ lệ chuyên cần</div><div className="text-3xl font-bold">{total ? Math.round((present / total) * 100) : 0}%</div><div className="text-xs text-gray-500">{present}/{total} lượt</div></Card>
        <Card><div className="text-xs text-gray-500">Công nợ hiện tại</div><div className="text-3xl font-bold text-red-600">{fmtMoney((debt._sum.total ?? 0) - (debt._sum.paid ?? 0))}</div></Card>
        <Card><div className="text-xs text-gray-500">Vắng có phép / không phép</div><div className="text-3xl font-bold">{att.find((a) => a.status === "ABSENT_EXCUSED")?._count ?? 0} / {att.find((a) => a.status === "ABSENT")?._count ?? 0}</div></Card>
      </div>
      <Card className="space-y-1">
        <h2 className="font-semibold">Tỉ lệ lấp đầy lớp</h2>
        {classes.map((c) => <div key={c.id} className="flex items-center gap-2 text-xs"><span className="w-40 truncate">{c.name}</span><div className="flex-1 bg-orange-50 rounded h-3"><div className="bg-sky-500 h-3 rounded" style={{ width: `${Math.min(100, (c._count.enrollments / c.maxStudents) * 100)}%` }} /></div><span className="w-12 text-right">{c._count.enrollments}/{c.maxStudents}</span></div>)}
      </Card>
    </div>
  );
}
