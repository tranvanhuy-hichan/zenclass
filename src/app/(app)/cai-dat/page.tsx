import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { DialogButton } from "@/components/dialog";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Table, Tabs, Title } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { fmtDate } from "@/lib/format";
import { addHoliday, deleteHoliday, removePayos, registerPayosWebhook, savePayos, saveCenter } from "./actions";
import { currentTenantId } from "@/lib/db";
import { appUrl } from "@/lib/payos";
import { getTenantPayos } from "@/lib/tenant-payos";

const TABS = [["center", "Trung tâm & ngân hàng"], ["payos", "Thanh toán PayOS"], ["holidays", "Ngày nghỉ lễ"], ["logs", "Nhật ký"]] as const;

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "center";
  const [payos, tid] = tab === "payos" ? await Promise.all([getTenantPayos({ includeDisabled: true }), currentTenantId()]) : [null, null];
  const [s, holidays, logs] = await Promise.all([
    getSettings(),
    tab === "holidays" ? db.holiday.findMany({ orderBy: { date: "asc" }, where: { date: { gte: new Date(Date.now() - 30 * 86400_000) } } }) : Promise.resolve([]),
    tab === "logs" ? db.auditLog.findMany({ orderBy: { at: "desc" }, take: 30 }) : Promise.resolve([]),
  ]);
  return (
    <div className="space-y-4">
      <Title>Cài đặt</Title>
      <Tabs current={`?tab=${tab}`} items={TABS.map(([k, l]) => [`?tab=${k}`, l] as [string, string])} />
      {tab === "center" && (
        <Card>
          <h2 className="font-semibold mb-2">Trung tâm & ngân hàng nhận học phí (VietQR)</h2>
          <ActionForm action={saveCenter} submit="Lưu" reset={false}>
            <Field label="Tên trung tâm"><input name="name" defaultValue={s.name} className={inputCls} /></Field>
            <Field label="Mã ngân hàng (SHB, VCB, MB, TCB, ACB...)"><input name="bank" defaultValue={s.bank.bank} className={inputCls + " w-full"} /></Field>
            <Field label="Số tài khoản"><input name="account" defaultValue={s.bank.account} className={inputCls} /></Field>
            <Field label="Tên chủ tài khoản"><input name="accName" defaultValue={s.bank.name} className={inputCls} /></Field>
            <Field label="Cho giáo viên sửa điểm danh trong (ngày)"><input name="maxEditDays" defaultValue={s.maxEditDays} className={inputCls + " w-full"} /></Field>
          </ActionForm>
        </Card>
      )}
      {tab === "payos" && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Thanh toán online qua PayOS</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${payos?.enabled ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"}`}>{payos?.enabled ? "Đang bật · tự động gạch nợ" : payos ? "Đã lưu khoá · đang tắt" : "Chưa cấu hình · dùng VietQR thường"}</span>
          </div>
          <p className="text-sm text-slate-600">Bật PayOS thì phiếu học phí có nút <b>&ldquo;Thanh toán ngay&rdquo;</b>, học viên trả xong hệ thống tự ghi nhận và gạch nợ. Chưa có PayOS thì phiếu vẫn hiện mã VietQR chuyển khoản như hiện nay (khai báo ở khung bên trên). Tiền học phí về thẳng tài khoản của trung tâm.</p>
          <ActionForm action={savePayos} submit="Lưu PayOS" reset={false} className="flex flex-col gap-3 [&>button]:self-start">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Client ID"><input name="clientId" autoComplete="off" className={inputCls + " w-full"} placeholder={payos ? `Đã lưu (••••${payos.keys.clientId.slice(-4)}), bỏ trống để giữ` : ""} /></Field>
              <Field label="API Key"><input name="apiKey" type="password" autoComplete="new-password" className={inputCls + " w-full"} placeholder={payos ? "Đã lưu, bỏ trống để giữ" : ""} /></Field>
              <Field label="Checksum Key"><input name="checksumKey" type="password" autoComplete="new-password" className={inputCls + " w-full"} placeholder={payos ? "Đã lưu, bỏ trống để giữ" : ""} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={payos?.enabled ?? true} className="size-4" /> Bật thanh toán online cho học viên và phụ huynh</label>
          </ActionForm>
          {payos && (
            <div className="space-y-2 border-t pt-3 text-sm">
              <p>Địa chỉ webhook của trung tâm: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{appUrl()}/api/webhook/payos/t/{tid}</code></p>
              <p className="text-slate-600">Bấm nút dưới để hệ thống tự đăng ký địa chỉ này với PayOS, hoặc dán thủ công vào ô Webhook URL của kênh trên PayOS. Chưa đăng ký webhook vẫn dùng được: hệ thống tự kiểm tra trạng thái khi học viên đang ở trang thanh toán.</p>
              <div className="flex flex-wrap gap-2">
                <ActionForm action={registerPayosWebhook} submit="Đăng ký webhook với PayOS" reset={false} className="inline-flex" />
                <ActionForm action={removePayos} submit="Xoá khoá" danger ghost reset={false} confirmText="Xoá khoá PayOS? Phiếu học phí sẽ quay về dùng VietQR thường." className="inline-flex" />
              </div>
            </div>
          )}
        </Card>
      )}
      {tab === "holidays" && (
        <Card>
          <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Ngày nghỉ lễ</h2>
            <DialogButton label="+ Thêm ngày lễ" title="Thêm ngày nghỉ lễ"><ActionForm action={addHoliday} submit="Thêm" className="flex flex-col gap-3 [&>button]:self-start"><Field label="Ngày"><input type="date" name="date" className={inputCls + " w-full"} /></Field><Field label="Tên"><input name="name" className={inputCls + " w-full"} /></Field></ActionForm></DialogButton></div>
          <div className="mt-2 text-sm space-y-1">{holidays.map((h) => <div key={h.id} className="flex gap-2 items-center">{fmtDate(h.date)} · {h.name}<ActionForm action={deleteHoliday} submit="×" danger className="inline"><input type="hidden" name="id" value={h.id} /></ActionForm></div>)}</div>
        </Card>
      )}
      {tab === "logs" && (
        <Card>
          <h2 className="font-semibold mb-2">Nhật ký thao tác gần đây</h2>
          <Table head={["Thời gian", "Hành động", "Đối tượng"]}>{logs.map((l) => <tr key={l.id}><td>{l.at.toISOString().replace("T", " ").slice(0, 16)}</td><td>{l.action}</td><td>{l.entity} {l.entityId?.slice(0, 8)}</td></tr>)}</Table>
        </Card>
      )}
    </div>
  );
}
