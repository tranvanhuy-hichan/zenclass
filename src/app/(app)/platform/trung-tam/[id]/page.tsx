import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, GraduationCap, School, Users } from "lucide-react";
import { rootDb } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { deleteTenant, grantMonths, resetTenantAdmin, updateTenant } from "../../actions";
import { ORDER_STATUS } from "@/lib/tenants";
import { fmtVnd } from "@/lib/plans";
import { PLAN_LABEL, tenantState } from "@/lib/tenants";

const ic = inputCls + " w-full";

export default async function TenantDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPERADMIN");
  const { id } = await params;
  const t = await rootDb.tenant.findUnique({ where: { id } });
  if (!t) notFound();
  const [orders, students, classes, branches, staff, lastLogin] = await Promise.all([
    rootDb.tenantOrder.findMany({ where: { tenantId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    rootDb.student.count({ where: { tenantId: id } }),
    rootDb.class.count({ where: { tenantId: id, finished: false } }),
    rootDb.branch.count({ where: { tenantId: id } }),
    rootDb.user.count({ where: { tenantId: id, role: { in: ["ADMIN", "STAFF", "TEACHER"] } } }),
    rootDb.auditLog.findFirst({ where: { tenantId: id }, orderBy: { at: "desc" }, select: { at: true } }),
  ]);
  const st = tenantState(t);
  const Stat = ({ icon: I, label, value }: { icon: typeof Users; label: string; value: React.ReactNode }) => (
    <Card className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-lg bg-orange-100 text-orange-700"><I className="size-5" /></span><div><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold">{value}</div></div></Card>
  );
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4">
        <span className="grid size-14 place-items-center rounded-xl bg-orange-100 text-orange-700"><Building2 className="size-7" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h1 className="text-xl font-semibold">{t.name}</h1><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></div>
          <div className="text-sm text-slate-600">Mã đăng nhập: <code className="rounded bg-slate-100 px-1.5">{t.slug}</code> · Gói {PLAN_LABEL[t.plan]} · Tạo {fmtDate(t.createdAt)}{lastLogin ? ` · Hoạt động gần nhất ${fmtDate(lastLogin.at)}` : ""}</div>
        </div>
        <Link href="/platform/trung-tam" className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm hover:bg-slate-50">← Danh sách</Link>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={GraduationCap} label="Học viên" value={`${students}/${t.maxStudents}`} />
        <Stat icon={School} label="Lớp đang mở" value={classes} />
        <Stat icon={Building2} label="Cơ sở" value={`${branches}/${t.maxBranches}`} />
        <Stat icon={Users} label="Nhân sự có tài khoản" value={staff} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h2 className="mb-3 font-semibold">Thông tin & gói dịch vụ</h2>
          <ActionForm action={updateTenant} submit="Lưu thay đổi" reset={false} className="flex flex-col gap-3 [&>button]:self-start">
            <input type="hidden" name="id" value={t.id} />
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Tên trung tâm"><input name="name" defaultValue={t.name} className={ic} required /></Field>
              <Field label="Gói dịch vụ"><select name="plan" defaultValue={t.plan} className={ic}>{Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Trạng thái"><select name="status" defaultValue={t.status} className={ic}><option value="ACTIVE">Hoạt động</option><option value="SUSPENDED">Tạm khoá</option></select></Field>
              <Field label="Hạn sử dụng (trống = không giới hạn)"><input type="date" name="expiresAt" defaultValue={t.expiresAt?.toISOString().slice(0, 10) ?? ""} className={ic} /></Field>
              <Field label="Giới hạn học viên"><input name="maxStudents" defaultValue={t.maxStudents} className={ic} /></Field>
              <Field label="Giới hạn cơ sở"><input name="maxBranches" defaultValue={t.maxBranches} className={ic} /></Field>
            </div>
            <Field label="Ghi chú nội bộ"><textarea name="note" defaultValue={t.note ?? ""} rows={3} className={ic + " h-auto py-2"} /></Field>
          </ActionForm>
        </Card>
        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="font-semibold">Gia hạn thủ công</h2>
            <p className="text-sm text-slate-600">Tặng thêm thời hạn không thu tiền (khuyến mãi, bù lỗi). Tính từ hạn hiện tại nếu còn hạn.</p>
            <ActionForm action={grantMonths} submit="Cộng thêm" reset={false} className="flex items-center gap-2"><input type="hidden" name="id" value={t.id} /><select name="months" className={ic} defaultValue="1">{[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} tháng</option>)}</select></ActionForm>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold">Quản trị viên</h2>
            <p className="text-sm text-slate-600">Cấp lại mật khẩu cho tài khoản quản trị đầu tiên của trung tâm. Họ sẽ phải đổi khi đăng nhập.</p>
            <ActionForm action={resetTenantAdmin} submit="Cấp lại mật khẩu quản trị" reset={false} className="flex flex-col gap-2"><input type="hidden" name="tenantId" value={t.id} /></ActionForm>
          </Card>
          <Card className="space-y-3 border-red-300">
            <h2 className="font-semibold text-red-600">Vùng nguy hiểm</h2>
            <p className="text-sm text-slate-600">Xoá vĩnh viễn trung tâm và <b>toàn bộ dữ liệu</b>. Không thể hoàn tác. Gõ mã <code className="rounded bg-slate-100 px-1">{t.slug}</code> để xác nhận.</p>
            <ActionForm action={deleteTenant} submit="Xoá trung tâm" danger confirmText={`Xoá vĩnh viễn ${t.name}?`} className="flex flex-col gap-2 [&>button]:self-start">
              <input type="hidden" name="id" value={t.id} /><input name="confirm" className={ic} placeholder={t.slug} />
            </ActionForm>
          </Card>
        </div>
      </div>
      <Card className="p-0">
        <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Đơn hàng gần đây</h2><Link href="/platform/don-hang" className="text-sm text-orange-700 hover:underline">Quản lý đơn →</Link></div>
        <ul className="divide-y">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{o.code}</code>
              <span className="flex-1">{PLAN_LABEL[o.plan]} · {o.months} tháng</span>
              <b className="tabular-nums">{fmtVnd(o.amount)}</b>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS[o.status].cls}`}>{ORDER_STATUS[o.status].label}</span>
              <span className="w-24 text-right text-xs text-slate-500">{fmtDate(o.createdAt)}</span>
            </li>
          ))}
          {!orders.length && <li className="px-4 py-6 text-center text-sm text-slate-500">Chưa có đơn hàng.</li>}
        </ul>
      </Card>
    </div>
  );
}
