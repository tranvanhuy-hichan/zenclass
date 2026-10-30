import Link from "next/link";
import { Building2, CalendarClock, GraduationCap } from "lucide-react";
import { rootDb } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { AutoForm } from "@/components/auto-form";
import { DialogButton } from "@/components/dialog";
import { Card, Field, inputCls, Table, Title } from "@/components/ui";
import { ViewToggle, pickView } from "@/components/view-toggle";
import { fmtDate } from "@/lib/format";
import { PLAN_LABEL, tenantState } from "@/lib/tenants";
import { createTenant } from "../actions";

const ic = inputCls + " w-full";
const STATES = [["", "Tất cả trạng thái"], ["active", "Hoạt động"], ["soon", "Sắp hết hạn"], ["expired", "Hết hạn"], ["suspended", "Tạm khoá"]];

export default async function Tenants({ searchParams }: { searchParams: Promise<{ q?: string; state?: string; plan?: string; v?: string }> }) {
  await requireRole("SUPERADMIN");
  const sp = await searchParams;
  const view = pickView(sp.v, "table");
  const all = await rootDb.tenant.findMany({ orderBy: { createdAt: "desc" } });
  const [students, classes] = await Promise.all([
    rootDb.student.groupBy({ by: ["tenantId"], where: { dropped: false }, _count: true }),
    rootDb.class.groupBy({ by: ["tenantId"], where: { finished: false }, _count: true }),
  ]);
  const sc = new Map(students.map((x) => [x.tenantId, x._count])), cc = new Map(classes.map((x) => [x.tenantId, x._count]));
  const kw = (sp.q ?? "").toLowerCase();
  const list = all.filter((t) => (!kw || `${t.name} ${t.slug}`.toLowerCase().includes(kw)) && (!sp.plan || t.plan === sp.plan) && (!sp.state || tenantState(t).key === sp.state));

  return (
    <div className="space-y-4">
      <Title right={
        <DialogButton wide label="+ Tạo trung tâm" title="Tạo trung tâm mới">
          <ActionForm action={createTenant} submit="Tạo trung tâm & tài khoản quản trị" className="flex flex-col gap-3 [&>button]:self-start">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Tên trung tâm *"><input name="name" className={ic} required /></Field>
              <Field label="Mã trung tâm * (định danh nội bộ)"><input name="slug" className={ic} required placeholder="vd: saomai" pattern="[a-z0-9][a-z0-9\-]{2,29}" /></Field>
              <Field label="Gói dịch vụ"><select name="plan" className={ic} defaultValue="TRIAL">{Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Số ngày sử dụng (0 = không giới hạn)"><input name="days" defaultValue={14} className={ic} /></Field>
              <Field label="Họ tên quản trị viên"><input name="adminName" className={ic} placeholder="Quản trị trung tâm" /></Field>
              <Field label="Tên đăng nhập quản trị (duy nhất toàn hệ thống)"><input name="adminUser" className={ic} placeholder="mặc định: admin-<mã trung tâm>" /></Field>
            </div>
            <Field label="Ghi chú nội bộ"><input name="note" className={ic} placeholder="Liên hệ, ngày ký hợp đồng..." /></Field>
          </ActionForm>
        </DialogButton>
      }>Trung tâm ({list.length})</Title>

      <AutoForm className="flex flex-wrap gap-2">
        <input type="hidden" name="v" value={view} />
        <input name="q" defaultValue={sp.q} placeholder="Tìm tên hoặc mã trung tâm..." className={inputCls + " min-w-48 flex-1"} />
        <select name="state" defaultValue={sp.state ?? ""} className={inputCls}>{STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="plan" defaultValue={sp.plan ?? ""} className={inputCls}><option value="">Tất cả gói</option>{Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <ViewToggle path="/platform/trung-tam" params={{ q: sp.q, state: sp.state, plan: sp.plan }} view={view} />
      </AutoForm>

      {view === "table" ? (
        <Table head={["Trung tâm", "Mã", "Gói", "Trạng thái", "Hạn dùng", "Học viên", "Lớp"]}>
          {list.map((t) => {
            const s = tenantState(t), n = sc.get(t.id) ?? 0;
            return (
              <tr key={t.id} className="align-middle [&>td]:!py-3">
                <td><Link data-row href={`/platform/trung-tam/${t.id}`} className="font-semibold text-orange-700 hover:underline">{t.name}</Link></td>
                <td><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{t.slug}</code></td>
                <td>{PLAN_LABEL[t.plan] ?? t.plan}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span></td>
                <td>{t.expiresAt ? fmtDate(t.expiresAt) : "Không giới hạn"}</td>
                <td className={n >= t.maxStudents ? "font-semibold text-red-600" : ""}>{n}/{t.maxStudents >= 100000 ? "∞" : t.maxStudents}</td>
                <td>{cc.get(t.id) ?? 0}</td>
              </tr>
            );
          })}
          {!list.length && <tr><td colSpan={7} className="py-8 text-center text-slate-500">Không có trung tâm phù hợp.</td></tr>}
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((t) => {
            const s = tenantState(t), n = sc.get(t.id) ?? 0;
            return (
              <Link key={t.id} href={`/platform/trung-tam/${t.id}`}>
                <Card className="flex h-full flex-col gap-3 transition-colors hover:border-orange-400">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-orange-100 text-orange-700"><Building2 className="size-5" /></span>
                    <div className="min-w-0 flex-1"><div className="truncate font-semibold">{t.name}</div><code className="text-xs text-slate-500">{t.slug}</code></div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm"><span className="rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-800">{PLAN_LABEL[t.plan]}</span><span className="flex items-center gap-1 text-xs text-slate-500"><CalendarClock className="size-3.5" />{t.expiresAt ? fmtDate(t.expiresAt) : "Không giới hạn"}</span></div>
                  <div className="mt-auto flex items-center gap-4 border-t pt-3 text-sm text-slate-600"><span className="flex items-center gap-1.5"><GraduationCap className="size-4 text-slate-400" /><b>{n}</b>/{t.maxStudents >= 100000 ? "∞" : t.maxStudents}</span><span><b>{cc.get(t.id) ?? 0}</b> lớp</span></div>
                </Card>
              </Link>
            );
          })}
          {!list.length && <p className="text-sm text-slate-500">Không có trung tâm phù hợp.</p>}
        </div>
      )}
    </div>
  );
}
