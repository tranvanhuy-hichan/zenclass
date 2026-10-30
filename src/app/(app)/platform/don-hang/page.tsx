import Link from "next/link";
import { rootDb } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { AutoForm } from "@/components/auto-form";
import { Table, Title, inputCls } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { fmtDate } from "@/lib/format";
import { fmtVnd } from "@/lib/plans";
import { ORDER_STATUS, PLAN_LABEL } from "@/lib/tenants";
import { cancelOrder, confirmOrder } from "../actions";

export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; size?: string }> }) {
  await requireRole("SUPERADMIN");
  const sp = await searchParams;
  const pg = getPaging(sp, 15);
  const status = sp.status ?? "PENDING";
  const tenants = await rootDb.tenant.findMany({ select: { id: true, name: true } });
  const names = new Map(tenants.map((t) => [t.id, t.name]));
  const kw = (sp.q ?? "").trim();
  const where = {
    ...(status ? { status } : {}),
    ...(kw ? { OR: [{ code: { contains: kw, mode: "insensitive" as const } }, { tenantId: { in: tenants.filter((t) => t.name.toLowerCase().includes(kw.toLowerCase())).map((t) => t.id) } }] } : {}),
  };
  const [total, list, sums] = await Promise.all([
    rootDb.tenantOrder.count({ where }),
    rootDb.tenantOrder.findMany({ where, orderBy: { createdAt: "desc" }, skip: pg.skip, take: pg.take }),
    rootDb.tenantOrder.groupBy({ by: ["status"], _count: true, _sum: { amount: true } }),
  ]);
  const sum = new Map(sums.map((s) => [s.status, s]));
  return (
    <div className="space-y-4">
      <Title>Đơn hàng ({total})</Title>
      <div className="flex gap-1 overflow-x-auto border-b">
        {[["PENDING", "Chờ thanh toán"], ["PAID", "Đã thanh toán"], ["CANCELLED", "Đã huỷ"], ["", "Tất cả"]].map(([k, l]) => (
          <Link key={k} href={`/platform/don-hang?status=${k}`} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${status === k ? "border-orange-600 font-semibold text-orange-700" : "border-transparent text-slate-600 hover:text-slate-900"}`}>
            {l} {k && <span className="text-xs text-slate-400">({sum.get(k)?._count ?? 0}{k === "PAID" && sum.get(k)?._sum.amount ? ` · ${fmtVnd(sum.get(k)!._sum.amount!)}` : ""})</span>}
          </Link>
        ))}
      </div>
      <AutoForm className="flex gap-2"><input type="hidden" name="status" value={status} /><input name="q" defaultValue={sp.q} placeholder="Tìm mã đơn hoặc tên trung tâm..." className={inputCls + " flex-1"} /></AutoForm>
      <Table head={["Mã đơn", "Trung tâm", "Gói", "Thời hạn", "Số tiền", "Trạng thái", "Ngày tạo", ""]}>
        {list.map((o) => {
          const s = ORDER_STATUS[o.status];
          return (
            <tr key={o.id} className="align-middle [&>td]:!py-3">
              <td><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{o.code}</code></td>
              <td><Link href={`/platform/trung-tam/${o.tenantId}`} className="font-medium text-orange-700 hover:underline">{names.get(o.tenantId) ?? "-"}</Link></td>
              <td>{PLAN_LABEL[o.plan] ?? o.plan}</td><td>{o.months} tháng</td>
              <td className="tabular-nums font-semibold">{fmtVnd(o.amount)}</td>
              <td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span></td>
              <td>{fmtDate(o.createdAt)}{o.paidAt ? <div className="text-xs text-slate-500">Thu {fmtDate(o.paidAt)}</div> : null}</td>
              <td>
                {o.status === "PENDING" && (
                  <div className="flex gap-1">
                    <ActionForm action={confirmOrder} submit="Xác nhận đã thu" compact reset={false} confirmText={`Xác nhận đã nhận ${fmtVnd(o.amount)} cho đơn ${o.code}? Gói và hạn dùng sẽ được cập nhật.`} className="inline-flex"><input type="hidden" name="id" value={o.id} /></ActionForm>
                    <ActionForm action={cancelOrder} submit="Huỷ" compact ghost danger reset={false} confirmText="Huỷ đơn này?" className="inline-flex"><input type="hidden" name="id" value={o.id} /></ActionForm>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
        {!list.length && <tr><td colSpan={8} className="py-8 text-center text-slate-500">Không có đơn nào.</td></tr>}
      </Table>
      <Pagination total={total} page={pg.page} size={pg.size} path="/platform/don-hang" params={{ status, q: sp.q, size: sp.size }} />
    </div>
  );
}
