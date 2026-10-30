import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Tabs, Title } from "@/components/ui";
import { DURATIONS, getPlatformCfg, PLAN_ORDER, priceFor, fmtVnd } from "@/lib/plans";
import { appUrl, platformKeys } from "@/lib/payos";
import { registerPayosWebhook, saveConfig } from "../actions";

const ic = inputCls + " w-full";
const TABS = [["plans", "Gói dịch vụ"], ["discounts", "Giảm giá theo kỳ hạn"], ["bank", "Tài khoản nhận tiền"], ["payos", "Kết nối PayOS"]] as const;
const form = "flex flex-col gap-4 [&>button]:self-start";

export default async function Config({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("SUPERADMIN");
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "plans";
  const cfg = await getPlatformCfg();
  const hasKeys = !!platformKeys();
  return (
    <div className="space-y-4">
      <Title>Gói & thanh toán</Title>
      <Tabs current={`?tab=${tab}`} items={TABS.map(([k, l]) => [`?tab=${k}`, l] as [string, string])} />

      {tab === "plans" && (
        <ActionForm action={saveConfig} submit="Lưu gói dịch vụ" reset={false} className={form}>
          <input type="hidden" name="section" value="plans" />
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
        </ActionForm>
      )}

      {tab === "discounts" && (
        <Card className="max-w-2xl space-y-3">
          <h2 className="font-semibold">Giảm giá theo kỳ hạn (%)</h2>
          <ActionForm action={saveConfig} submit="Lưu giảm giá" reset={false} className={form}>
            <input type="hidden" name="section" value="discounts" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {DURATIONS.map((m) => <Field key={m} label={`${m} tháng`}><input name={`d${m}`} defaultValue={cfg.discounts[String(m) as "1"]} className={ic} /></Field>)}
            </div>
          </ActionForm>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <div className="mb-1 font-medium">Giá sau giảm của các gói</div>
            {PLAN_ORDER.filter((k) => cfg.plans[k].sellable).map((k) => (
              <div key={k}>{cfg.plans[k].name}: {DURATIONS.map((m) => `${m} tháng ${fmtVnd(priceFor(cfg, k, m).total)}`).join(" · ")}</div>
            ))}
          </div>
        </Card>
      )}

      {tab === "bank" && (
        <Card className="max-w-2xl space-y-3">
          <h2 className="font-semibold">Tài khoản nhận tiền</h2>
          <p className="text-sm text-slate-500">Dùng cho phương án chuyển khoản thủ công kèm mã QR khi trung tâm đăng ký hoặc gia hạn gói.</p>
          <ActionForm action={saveConfig} submit="Lưu tài khoản" reset={false} className={form}>
            <input type="hidden" name="section" value="bank" />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Ngân hàng (mã, vd BIDV)"><input name="bank" defaultValue={cfg.bank.bank} className={ic} /></Field>
              <Field label="Số tài khoản"><input name="account" defaultValue={cfg.bank.account} className={ic} /></Field>
              <Field label="Chủ tài khoản"><input name="accName" defaultValue={cfg.bank.name} className={ic} /></Field>
            </div>
          </ActionForm>
        </Card>
      )}

      {tab === "payos" && (
        <Card className="max-w-2xl space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Kết nối PayOS</h2><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${hasKeys ? "bg-green-100 text-green-800" : "bg-red-100 text-red-600"}`}>{hasKeys ? "Đã có khoá" : "Chưa có khoá"}</span></div>
          <p className="text-sm text-slate-600">Địa chỉ webhook của hệ thống: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{appUrl()}/api/webhook/payos/platform</code></p>
          {!appUrl().startsWith("https://") && <p className="text-sm text-yellow-800">Đang dùng địa chỉ nội bộ nên chưa đăng ký được. Khi có tên miền (hoặc địa chỉ tunnel), đặt <code>APP_URL</code> trong <code>.env</code> rồi khởi động lại và bấm nút dưới. Trong lúc đó, đơn vẫn tự xác nhận nhờ cơ chế kiểm tra định kỳ.</p>}
          <ActionForm action={registerPayosWebhook} submit="Đăng ký webhook với PayOS" reset={false} className="flex flex-col gap-2 [&>button]:self-start" />
        </Card>
      )}
    </div>
  );
}
