import Link from "next/link";
import { Building2, GraduationCap, School } from "lucide-react";
import { rootDb } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { DialogButton } from "@/components/dialog";
import { Card, Field, inputCls, Table, Title } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { createTenant } from "./actions";
import { PLAN_LABEL, tenantState } from "@/lib/tenants";

const ic = inputCls + " w-full";
export default async function Platform() {
  await requireRole("SUPERADMIN");
  const tenants = await rootDb.tenant.findMany({ orderBy: { createdAt: "desc" } });
  const [students, classes] = await Promise.all([
    rootDb.student.groupBy({ by: ["tenantId"], _count: true }),
    rootDb.class.groupBy({ by: ["tenantId"], where: { finished: false }, _count: true }),
  ]);
  const sc = new Map(students.map((x) => [x.tenantId, x._count])), cc = new Map(classes.map((x) => [x.tenantId, x._count]));
  const active = tenants.filter((t) => tenantState(t).label === "Hoạt động").length;

  return (
    <div className="space-y-4">
      <Title right={
        <DialogButton wide label="+ Tạo trung tâm" title="Tạo trung tâm mới">
          <ActionForm action={createTenant} submit="Tạo trung tâm & tài khoản quản trị" className="flex flex-col gap-3 [&>button]:self-start">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Tên trung tâm *"><input name="name" className={ic} required /></Field>
              <Field label="Mã trung tâm * (dùng để đăng nhập)"><input name="slug" className={ic} required placeholder="vd: saomai" pattern="[a-z0-9][a-z0-9\-]{2,29}" /></Field>
              <Field label="Gói dịch vụ"><select name="plan" className={ic} defaultValue="TRIAL">{Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Số ngày sử dụng (0 = không giới hạn)"><input name="days" defaultValue={14} className={ic} /></Field>
              <Field label="Họ tên quản trị viên"><input name="adminName" className={ic} placeholder="Quản trị trung tâm" /></Field>
              <Field label="Tên đăng nhập quản trị (duy nhất toàn hệ thống)"><input name="adminUser" className={ic} placeholder="mặc định: admin-<mã trung tâm>" /></Field>
            </div>
            <Field label="Ghi chú nội bộ"><input name="note" className={ic} placeholder="Liên hệ, ngày ký hợp đồng..." /></Field>
          </ActionForm>
        </DialogButton>
      }>Trung tâm ({tenants.length})</Title>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[[Building2, "Tổng trung tâm", tenants.length], [Building2, "Đang hoạt động", active], [GraduationCap, "Tổng học viên", [...sc.values()].reduce((a, b) => a + b, 0)], [School, "Lớp đang mở", [...cc.values()].reduce((a, b) => a + b, 0)]].map(([I, l, v], i) => {
          const Icon = I as typeof Building2;
          return <Card key={i} className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-lg bg-orange-100 text-orange-700"><Icon className="size-5" /></span><div><div className="text-xs text-slate-500">{l as string}</div><div className="text-xl font-bold">{v as number}</div></div></Card>;
        })}
      </div>

      <Table head={["Trung tâm", "Mã", "Gói", "Trạng thái", "Hạn dùng", "Học viên", "Lớp"]}>
        {tenants.map((t) => {
          const st = tenantState(t);
          const n = sc.get(t.id) ?? 0;
          return (
            <tr key={t.id} className="align-middle [&>td]:!py-3">
              <td><Link data-row href={`/platform/${t.id}`} className="font-semibold text-orange-700 hover:underline">{t.name}</Link></td>
              <td><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{t.slug}</code></td>
              <td>{PLAN_LABEL[t.plan] ?? t.plan}</td>
              <td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></td>
              <td>{t.expiresAt ? fmtDate(t.expiresAt) : "Không giới hạn"}</td>
              <td className={n >= t.maxStudents ? "font-semibold text-red-600" : ""}>{n}/{t.maxStudents}</td>
              <td>{cc.get(t.id) ?? 0}</td>
            </tr>
          );
        })}
        {!tenants.length && <tr><td colSpan={7} className="py-8 text-center text-slate-500">Chưa có trung tâm nào.</td></tr>}
      </Table>
    </div>
  );
}
