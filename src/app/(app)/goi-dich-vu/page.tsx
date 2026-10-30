import { CalendarClock, Check, GraduationCap, Building2 } from "lucide-react";
import { db, currentTenantId, rootDb } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, Table, Title } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { vietQrUrl } from "@/lib/vietqr";
import { DURATIONS, daysLeft, fmtVnd, getPlatformCfg, PLAN_ORDER, priceFor, type PlanCode } from "@/lib/plans";
import { ORDER_STATUS, PLAN_LABEL, tenantState } from "@/lib/tenants";
import { PlanPicker } from "./plan-picker";
import { cancelMyOrder } from "./actions";

export default async function PlanPage() {
  await requireRole("ADMIN");
  const id = (await currentTenantId())!;
  const [t, cfg, orders, students, branches] = await Promise.all([
    rootDb.tenant.findUniqueOrThrow({ where: { id } }),
    getPlatformCfg(),
    db.tenantOrder.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.student.count({ where: { dropped: false } }),
    db.branch.count(),
  ]);
  const st = tenantState(t);
  const left = daysLeft(t.expiresAt);
  const pending = orders.filter((o) => o.status === "PENDING");
  const sellable = PLAN_ORDER.filter((k) => cfg.plans[k].sellable);
  const quota = (n: number, max: number) => (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full ${n / max > 0.9 ? "bg-red-500" : "bg-orange-500"}`} style={{ width: `${Math.min(100, (n / max) * 100)}%` }} /></div>
  );
  return (
    <div className="space-y-4">
      <Title>Gói dịch vụ</Title>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="space-y-3 xl:col-span-1">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Gói hiện tại</h2><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></div>
          <div className="text-2xl font-bold text-orange-700">{PLAN_LABEL[t.plan] ?? t.plan}</div>
          <div className="flex items-center gap-2 text-sm text-slate-600"><CalendarClock className="size-4 text-slate-400" />{t.expiresAt ? <>Hết hạn {fmtDate(t.expiresAt)}{left != null && <b className={left <= 7 ? "text-red-600" : ""}> · {left >= 0 ? `còn ${left} ngày` : "đã hết hạn"}</b>}</> : "Không giới hạn thời gian"}</div>
          <div className="space-y-3 border-t pt-3 text-sm">
            <div><div className="flex justify-between"><span className="flex items-center gap-1.5 text-slate-600"><GraduationCap className="size-4" />Học viên</span><b>{students}/{t.maxStudents >= 100000 ? "∞" : t.maxStudents}</b></div>{t.maxStudents < 100000 && quota(students, t.maxStudents)}</div>
            <div><div className="flex justify-between"><span className="flex items-center gap-1.5 text-slate-600"><Building2 className="size-4" />Cơ sở</span><b>{branches}/{t.maxBranches}</b></div>{quota(branches, t.maxBranches)}</div>
          </div>
        </Card>

        <div className="xl:col-span-2">
          <PlanPicker
            current={t.plan}
            plans={sellable.map((k) => ({ code: k, ...cfg.plans[k] }))}
            prices={Object.fromEntries(sellable.map((k) => [k, Object.fromEntries(DURATIONS.map((m) => [m, priceFor(cfg, k as PlanCode, m)]))]))}
            hasPending={pending.length >= 3}
          />
        </div>
      </div>

      {pending.map((o) => (
        <Card key={o.id} className="grid gap-4 border-yellow-300 md:grid-cols-[auto_1fr]">
          {cfg.bank.account ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vietQrUrl({ ...cfg.bank, amount: o.amount, info: o.code })} alt="QR thanh toán" className="size-48 rounded-lg border bg-white object-contain" />
          ) : <div className="grid size-48 place-items-center rounded-lg border text-center text-xs text-slate-500">Chưa cấu hình tài khoản nhận tiền</div>}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><h2 className="text-base font-semibold">Đơn {o.code} · chờ thanh toán</h2></div>
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <div><span className="text-slate-500">Gói:</span> <b>{PLAN_LABEL[o.plan]} · {o.months} tháng</b></div>
              <div><span className="text-slate-500">Số tiền:</span> <b className="text-orange-700">{fmtVnd(o.amount)}</b></div>
              <div><span className="text-slate-500">Ngân hàng:</span> <b>{cfg.bank.bank}</b></div>
              <div><span className="text-slate-500">Số tài khoản:</span> <b>{cfg.bank.account || "-"}</b></div>
              <div><span className="text-slate-500">Chủ tài khoản:</span> <b>{cfg.bank.name || "-"}</b></div>
              <div><span className="text-slate-500">Nội dung CK:</span> <b>{o.code}</b></div>
            </div>
            <p className="text-slate-600">Sau khi chuyển khoản, đơn sẽ được xác nhận và gói được kích hoạt trong giờ làm việc.</p>
            <ActionForm action={cancelMyOrder} submit="Huỷ đơn" compact ghost danger reset={false} confirmText="Huỷ đơn này?" className="inline-flex"><input type="hidden" name="id" value={o.id} /></ActionForm>
          </div>
        </Card>
      ))}

      <div className="space-y-2">
        <h2 className="font-semibold">Lịch sử đơn hàng</h2>
        <Table head={["Mã đơn", "Gói", "Thời hạn", "Số tiền", "Trạng thái", "Ngày tạo"]}>
          {orders.map((o) => (
            <tr key={o.id}>
              <td><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{o.code}</code></td><td>{PLAN_LABEL[o.plan]}</td><td>{o.months} tháng</td>
              <td className="tabular-nums">{fmtVnd(o.amount)}</td>
              <td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS[o.status].cls}`}>{ORDER_STATUS[o.status].label}</span></td>
              <td>{fmtDate(o.createdAt)}</td>
            </tr>
          ))}
          {!orders.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Chưa có đơn hàng nào.</td></tr>}
        </Table>
      </div>
    </div>
  );
}
