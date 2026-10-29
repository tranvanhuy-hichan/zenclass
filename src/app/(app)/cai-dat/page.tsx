import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { DialogButton } from "@/components/dialog";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Table, Title } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { fmtDate } from "@/lib/format";
import { addHoliday, deleteHoliday, saveCenter } from "./actions";

export default async function Settings() {
  await requireRole("ADMIN");
  const [s, holidays, logs] = await Promise.all([
    getSettings(),
    db.holiday.findMany({ orderBy: { date: "asc" }, where: { date: { gte: new Date(Date.now() - 30 * 86400_000) } } }),
    db.auditLog.findMany({ orderBy: { at: "desc" }, take: 30 }),
  ]);
  return (
    <div className="space-y-4">
      <Title>Cài đặt</Title>
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
      <Card>
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Ngày nghỉ lễ</h2>
          <DialogButton label="+ Thêm ngày lễ" title="Thêm ngày nghỉ lễ"><ActionForm action={addHoliday} submit="Thêm" className="flex flex-col gap-3 [&>button]:self-start"><Field label="Ngày"><input type="date" name="date" className={inputCls + " w-full"} /></Field><Field label="Tên"><input name="name" className={inputCls + " w-full"} /></Field></ActionForm></DialogButton></div>
        <div className="mt-2 text-sm space-y-1">{holidays.map((h) => <div key={h.id} className="flex gap-2 items-center">{fmtDate(h.date)} · {h.name}<ActionForm action={deleteHoliday} submit="×" danger className="inline"><input type="hidden" name="id" value={h.id} /></ActionForm></div>)}</div>
      </Card>
      <Card>
        <h2 className="font-semibold mb-2">Nhật ký thao tác gần đây</h2>
        <Table head={["Thời gian", "Hành động", "Đối tượng"]}>{logs.map((l) => <tr key={l.id}><td>{l.at.toISOString().replace("T", " ").slice(0, 16)}</td><td>{l.action}</td><td>{l.entity} {l.entityId?.slice(0, 8)}</td></tr>)}</Table>
      </Card>
    </div>
  );
}
