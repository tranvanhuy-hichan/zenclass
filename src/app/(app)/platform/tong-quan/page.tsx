import Link from "next/link";
import { AlertTriangle, Building2, CircleDollarSign, GraduationCap, Hourglass, Receipt, School, TrendingUp } from "lucide-react";
import { rootDb } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { Card, Title } from "@/components/ui";
import { ColumnChart, Donut } from "@/components/charts";
import { ActionForm } from "@/components/action-form";
import { fmtDate } from "@/lib/format";
import { daysLeft, fmtVnd, getPlatformCfg, type PlanCode } from "@/lib/plans";
import { ORDER_STATUS, PLAN_LABEL, tenantState } from "@/lib/tenants";
import { confirmOrder } from "../actions";

const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr` : fmtVnd(n));
const PLAN_COLOR: Record<string, string> = { TRIAL: "#94a3b8", BASIC: "#38bdf8", PRO: "#f97316", ENTERPRISE: "#22c55e" };

export default async function Overview() {
  await requireRole("SUPERADMIN");
  const cfg = await getPlatformCfg();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const sixAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [tenants, students, classes, paid, pending] = await Promise.all([
    rootDb.tenant.findMany({ orderBy: { createdAt: "desc" } }),
    rootDb.student.groupBy({ by: ["tenantId"], where: { dropped: false }, _count: true }),
    rootDb.class.count({ where: { finished: false } }),
    rootDb.tenantOrder.findMany({ where: { status: "PAID", paidAt: { gte: sixAgo } }, select: { amount: true, paidAt: true } }),
    rootDb.tenantOrder.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" } }),
  ]);
  const names = new Map(tenants.map((t) => [t.id, t.name]));
  const sc = new Map(students.map((x) => [x.tenantId, x._count]));
  const st = tenants.map((t) => ({ t, s: tenantState(t) }));
  const count = (k: string) => st.filter((x) => x.s.key === k).length;
  const revenueMonth = paid.filter((o) => o.paidAt! >= monthStart).reduce((a, o) => a + o.amount, 0);
  // MRR ước tính: giá tháng của các trung tâm đang trả phí và còn hạn
  const mrr = tenants.filter((t) => t.plan !== "TRIAL" && tenantState(t).key !== "expired" && t.status === "ACTIVE").reduce((a, t) => a + (cfg.plans[t.plan as PlanCode]?.monthlyPrice ?? 0), 0);
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1)); return { key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: `T${d.getUTCMonth() + 1}` }; });
  const byMonth = new Map<string, number>();
  for (const o of paid) { const k = `${o.paidAt!.getUTCFullYear()}-${o.paidAt!.getUTCMonth()}`; byMonth.set(k, (byMonth.get(k) ?? 0) + o.amount); }
  const planCount = Object.entries(PLAN_LABEL).map(([k, v]) => ({ label: v, value: tenants.filter((t) => t.plan === k).length, color: PLAN_COLOR[k] })).filter((x) => x.value);
  const attention = st.filter((x) => ["soon", "expired"].includes(x.s.key)).sort((a, b) => (a.t.expiresAt?.getTime() ?? 0) - (b.t.expiresAt?.getTime() ?? 0));

  const Stat = ({ icon: I, label, value, sub, tone = "bg-orange-100 text-orange-700" }: { icon: typeof Building2; label: string; value: React.ReactNode; sub?: string; tone?: string }) => (
    <Card className="flex items-center gap-3 p-4"><span className={`grid size-11 shrink-0 place-items-center rounded-lg ${tone}`}><I className="size-5" /></span><div><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold">{value}</div>{sub && <div className="text-xs text-slate-500">{sub}</div>}</div></Card>
  );
  return (
    <div className="space-y-4">
      <Title>Tổng quan nền tảng</Title>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={Building2} label="Trung tâm" value={tenants.length} sub={`${count("active") + count("soon")} đang hoạt động`} />
        <Stat icon={CircleDollarSign} label="Doanh thu tháng này" value={short(revenueMonth)} sub={`MRR ước tính ${short(mrr)}`} tone="bg-green-100 text-green-700" />
        <Stat icon={Receipt} label="Đơn chờ xác nhận" value={pending.length} sub={pending.length ? short(pending.reduce((a, o) => a + o.amount, 0)) : "Không có đơn nào"} tone="bg-yellow-100 text-yellow-800" />
        <Stat icon={AlertTriangle} label="Cần chú ý" value={attention.length + count("suspended")} sub={`${count("soon")} sắp hết hạn · ${count("expired")} hết hạn · ${count("suspended")} khoá`} tone="bg-red-100 text-red-600" />
        <Stat icon={GraduationCap} label="Tổng học viên" value={[...sc.values()].reduce((a, b) => a + b, 0).toLocaleString("vi-VN")} tone="bg-sky-100 text-sky-700" />
        <Stat icon={School} label="Lớp đang mở" value={classes} tone="bg-sky-100 text-sky-700" />
        <Stat icon={TrendingUp} label="Dùng thử" value={tenants.filter((t) => t.plan === "TRIAL").length} sub="cơ hội chuyển đổi sang gói trả phí" tone="bg-slate-100 text-slate-700" />
        <Stat icon={Hourglass} label="Đã thanh toán (6 tháng)" value={short(paid.reduce((a, o) => a + o.amount, 0))} tone="bg-green-100 text-green-700" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h2 className="mb-3 font-semibold">Doanh thu 6 tháng gần nhất</h2>
          <ColumnChart items={months.map((m) => ({ label: m.label, value: byMonth.get(m.key) ?? 0, color: "#f97316" }))} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Phân bổ theo gói</h2>
          <Donut items={planCount} center={<div><div className="text-2xl font-bold">{tenants.length}</div><div className="text-xs text-slate-500">trung tâm</div></div>} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Đơn chờ xác nhận ({pending.length})</h2><Link href="/platform/don-hang" className="text-sm text-orange-700 hover:underline">Tất cả đơn →</Link></div>
          <ul className="divide-y">
            {pending.slice(0, 6).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1"><div className="font-medium">{names.get(o.tenantId)}</div><div className="text-xs text-slate-500">{o.code} · {PLAN_LABEL[o.plan]} {o.months} tháng · {fmtDate(o.createdAt)}</div></div>
                <b className="tabular-nums">{fmtVnd(o.amount)}</b>
                <ActionForm action={confirmOrder} submit="Xác nhận đã thu" compact reset={false} className="inline-flex"><input type="hidden" name="id" value={o.id} /></ActionForm>
              </li>
            ))}
            {!pending.length && <li className="px-4 py-8 text-center text-sm text-slate-500">Không có đơn nào đang chờ.</li>}
          </ul>
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Sắp hết hạn / đã hết hạn ({attention.length})</h2><Link href="/platform/trung-tam" className="text-sm text-orange-700 hover:underline">Tất cả trung tâm →</Link></div>
          <ul className="divide-y">
            {attention.slice(0, 6).map(({ t, s }) => {
              const d = daysLeft(t.expiresAt);
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1"><Link href={`/platform/trung-tam/${t.id}`} className="font-medium hover:text-orange-700">{t.name}</Link><div className="text-xs text-slate-500">{PLAN_LABEL[t.plan]} · hạn {t.expiresAt ? fmtDate(t.expiresAt) : "-"}</div></div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{d != null && d >= 0 ? `Còn ${d} ngày` : s.label}</span>
                </li>
              );
            })}
            {!attention.length && <li className="px-4 py-8 text-center text-sm text-slate-500">Không có trung tâm nào sắp hết hạn.</li>}
          </ul>
        </Card>

        <Card className="p-0 xl:col-span-2">
          <div className="border-b px-4 py-3 font-semibold">Trung tâm mới gần đây</div>
          <ul className="divide-y">
            {tenants.slice(0, 5).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <Link href={`/platform/trung-tam/${t.id}`} className="min-w-0 flex-1 font-medium hover:text-orange-700">{t.name}</Link>
                <span className="text-xs text-slate-500">{PLAN_LABEL[t.plan]}</span>
                <span className="w-28 text-right tabular-nums">{sc.get(t.id) ?? 0} học viên</span>
                <span className="w-24 text-right text-xs text-slate-500">{fmtDate(t.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
