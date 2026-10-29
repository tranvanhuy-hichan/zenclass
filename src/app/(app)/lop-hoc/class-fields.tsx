import { Field, inputCls } from "@/components/ui";
import { WEEKDAYS } from "@/lib/format";

type Opt = { id: string; fullName?: string; name?: string };
const ic = inputCls + " w-full";

export function ClassFormFields({
  teachers, assistants = [], coordinators = [], rooms, templates = [], defaults = {}, withSchedule = true, edit = false, scheduleOnly = false, showRate = false,
}: {
  teachers: Opt[]; assistants?: Opt[]; coordinators?: Opt[]; rooms: Opt[]; templates?: Opt[]; withSchedule?: boolean; edit?: boolean; scheduleOnly?: boolean; showRate?: boolean;
  defaults?: Partial<{ name: string; mode: string; teacherId: string | null; assistantId: string | null; coordinatorId: string | null; billing: string; teacherRate: number | null; roomId: string | null; startDate: string; totalSessions: number; maxStudents: number; tuitionFee: number; startTime: string; endTime: string; days: number[]; finished: boolean; gradeTemplateId: string | null }>;
}) {
  const grid = "grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4";
  return (
    <>
      {!scheduleOnly && (
        <>
          <div className={grid}>
            <Field label="Tên lớp *"><input name="name" defaultValue={defaults.name} className={ic} required /></Field>
            <Field label="Hình thức"><select name="mode" defaultValue={defaults.mode} className={ic}><option value="OFFLINE">Offline</option><option value="ONLINE">Online</option></select></Field>
            <Field label="Giáo viên"><select name="teacherId" defaultValue={defaults.teacherId ?? ""} className={ic}><option value="">--</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select></Field>
            <Field label="Trợ giảng"><select name="assistantId" defaultValue={defaults.assistantId ?? ""} className={ic}><option value="">--</option>{assistants.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select></Field>
            <Field label="Giáo vụ"><select name="coordinatorId" defaultValue={defaults.coordinatorId ?? ""} className={ic}><option value="">--</option>{coordinators.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select></Field>
            <Field label="Phòng"><select name="roomId" defaultValue={defaults.roomId ?? ""} className={ic}><option value="">--</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
            {!!templates.length && <Field label="Bộ điểm"><select name="gradeTemplateId" defaultValue={defaults.gradeTemplateId ?? ""} className={ic}><option value="">-- chưa chọn --</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
            {!edit && <Field label="Ngày bắt đầu *"><input type="date" name="startDate" defaultValue={defaults.startDate} className={ic} required /></Field>}
            {!edit && <Field label="Tổng số buổi"><input name="totalSessions" defaultValue={defaults.totalSessions ?? 24} className={ic} /></Field>}
            <Field label="Sĩ số tối đa"><input name="maxStudents" defaultValue={defaults.maxStudents ?? 20} className={ic} /></Field>
            <Field label="Hình thức thu học phí"><select name="billing" defaultValue={defaults.billing ?? "ONCE"} className={ic}><option value="ONCE">Trọn khoá</option><option value="MONTHLY">Theo tháng</option></select></Field>
            {showRate && <Field label="Đơn giá riêng cho GV lớp này (đ)"><input name="teacherRate" defaultValue={defaults.teacherRate ?? ""} inputMode="numeric" className={ic} placeholder="trống = theo mức lương của GV" /></Field>}
            <Field label="Học phí (đ)"><input name="tuitionFee" defaultValue={defaults.tuitionFee ?? 0} className={ic} /></Field>
            {edit && <label className="flex items-center gap-2 pb-2 text-sm lg:self-end"><input type="checkbox" name="finished" defaultChecked={defaults.finished} /> Lớp đã kết thúc</label>}
          </div>
        </>
      )}
      {withSchedule && (
        <div className="w-full space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Các ngày học trong tuần</div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <label key={d} className="flex cursor-pointer items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-sm has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50">
                  <input type="checkbox" name="weekday" value={d} defaultChecked={defaults.days?.includes(d)} /> {WEEKDAYS[d]}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Từ giờ"><input type="time" name="startTime" defaultValue={defaults.startTime ?? "18:00"} className={ic} /></Field>
            <Field label="Đến giờ"><input type="time" name="endTime" defaultValue={defaults.endTime ?? "19:30"} className={ic} /></Field>
          </div>
        </div>
      )}
    </>
  );
}
