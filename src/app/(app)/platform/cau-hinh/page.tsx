import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Title } from "@/components/ui";
import { DURATIONS, getPlatformCfg, PLAN_ORDER, priceFor, fmtVnd } from "@/lib/plans";
import { saveConfig } from "../actions";

const ic = inputCls + " w-full";

export default async function Config() {
  await requireRole("SUPERADMIN");
  const cfg = await getPlatformCfg();
  return (
    <div className="space-y-4">
      <Title>Gói dịch vụ & thanh toán</Title>
      <ActionForm action={saveConfig} submit="Lưu cấu hình" reset={false} className="flex flex-col gap-4 [&>button]:self-start">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_ORDER.map((k) => {
            const p = cfg.plans[k];
            return (
              <Card key={k} className="space-y-3">
                <div className="flex items-center justify-between"><h2 className="font-semibold">{k}</h2>{!p.sellable && <span className="rounded bg-slate-100 px-1.5 text-xs">Không bán</span>}</div>
                <Field label="Tên hiển thị"><input name={`${k}.name`} defaultValue={p.name} className={ic} /></Field>
                <Field label="Giá / tháng (đ)"><input name={`${k}.price`} defaultValue={p.monthlyPrice} className={ic} disabled={!p.sellable} /></Field>
                <Field label="Giới hạn học viên"><input name={`${k}.students`} defaultValue={p.maxStudents} className={ic} /></Field>
                <Field label="Giới hạn cơ sở"><input name={`${k}.branches`} defaultValue={p.maxBranches} className={ic} /></Field>
                <Field label="Quyền lợi (mỗi dòng một ý)"><textarea name={`${k}.features`} defaultValue={p.features.join("\n")} rows={5} className={ic + " h-auto py-2"} /></Field>
              </Card>
            );
          })}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="space-y-3">
            <h2 className="font-semibold">Giảm giá theo kỳ hạn (%)</h2>
            <div className="grid grid-cols-4 gap-3">
              {DURATIONS.map((m) => <Field key={m} label={`${m} tháng`}><input name={`d${m}`} defaultValue={cfg.discounts[String(m) as "1"]} className={ic} /></Field>)}
            </div>
            <p className="text-xs text-slate-500">Ví dụ gói Cơ bản: 1 tháng {fmtVnd(priceFor(cfg, "BASIC", 1).total)} · 3 tháng {fmtVnd(priceFor(cfg, "BASIC", 3).total)} · 6 tháng {fmtVnd(priceFor(cfg, "BASIC", 6).total)} · 12 tháng {fmtVnd(priceFor(cfg, "BASIC", 12).total)}.</p>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold">Tài khoản nhận tiền</h2>
            <p className="text-sm text-slate-500">Hiển thị kèm mã QR khi trung tâm đăng ký hoặc gia hạn gói.</p>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Ngân hàng (mã, vd SHB)"><input name="bank" defaultValue={cfg.bank.bank} className={ic} /></Field>
              <Field label="Số tài khoản"><input name="account" defaultValue={cfg.bank.account} className={ic} /></Field>
              <Field label="Chủ tài khoản"><input name="accName" defaultValue={cfg.bank.name} className={ic} /></Field>
            </div>
          </Card>
        </div>
      </ActionForm>
    </div>
  );
}
