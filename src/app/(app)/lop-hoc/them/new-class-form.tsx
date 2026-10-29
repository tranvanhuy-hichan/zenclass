"use client";
import { useActionState, useMemo, useState } from "react";
import { BookOpenCheck, CalendarDays, ClipboardCheck, GraduationCap, UserCheck, Wallet } from "lucide-react";
import { createClass } from "../actions";

type Opt = { id: string; label: string };
const WD = [[1, "Thứ 2"], [2, "Thứ 3"], [3, "Thứ 4"], [4, "Thứ 5"], [5, "Thứ 6"], [6, "Thứ 7"], [0, "CN"]] as const;
const SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const ic = "h-10 w-full rounded-md border bg-white px-3 text-sm";

const Section = ({ icon: I, title, hint, children }: { icon: typeof Wallet; title: string; hint?: string; children: React.ReactNode }) => (
  <section className="rounded-lg border bg-white">
    <div className="flex items-center gap-3 border-b px-5 py-3">
      <span className="grid size-8 place-items-center rounded-lg bg-orange-100 text-orange-700"><I className="size-4" /></span>
      <div><h2 className="font-semibold leading-tight">{title}</h2>{hint && <p className="text-xs text-slate-500">{hint}</p>}</div>
    </div>
    <div className="p-5">{children}</div>
  </section>
);
const F = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">{label}{children}{hint && <span className="font-normal text-slate-400">{hint}</span>}</label>
);

function fmt(d: Date) {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function NewClassForm({ teachers, assistants, coordinators, rooms, templates, today, showRate = false }: { showRate?: boolean; teachers: Opt[]; assistants: Opt[]; coordinators: Opt[]; rooms: Opt[]; templates: Opt[]; today: string }) {
  const [res, action, pending] = useActionState(createClass, null);
  const [name, setName] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [from, setFrom] = useState("18:00");
  const [to, setTo] = useState("19:30");
  const [start, setStart] = useState(today);
  const [total, setTotal] = useState(24);
  const [fee, setFee] = useState(0);
  const [mode, setMode] = useState<"OFFLINE" | "ONLINE">("OFFLINE");
  const [billing, setBilling] = useState<"ONCE" | "MONTHLY">("ONCE");

  const toggle = (d: number) => setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const duration = mins(to) - mins(from);
  const end = useMemo(() => {
    if (!days.length || !start || total < 1) return null;
    let d = new Date(start + "T00:00:00Z"), n = 0, last: Date | null = null;
    for (let i = 0; i < 1500 && n < total; i++, d = new Date(d.getTime() + 86400000)) if (days.includes(d.getUTCDay())) { n++; last = d; }
    return last;
  }, [days, start, total]);
  const timeBad = duration <= 0;

  return (
    <form action={action} className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="billing" value={billing} />
      <div className="space-y-4">
        <Section icon={BookOpenCheck} title="Thông tin lớp" hint="Tên lớp và hình thức học">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><F label="Tên lớp *"><input name="name" value={name} onChange={(e) => setName(e.target.value)} className={ic} placeholder="vd: IELTS B1 - Khoá tháng 11" required /></F></div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600">Hình thức học</div>
              <div className="grid grid-cols-2 gap-2">
                {(["OFFLINE", "ONLINE"] as const).map((m) => (
                  <button type="button" key={m} onClick={() => setMode(m)} className={`h-10 rounded-md border text-sm font-medium ${mode === m ? "border-orange-600 bg-orange-50 text-orange-700" : "bg-white hover:bg-slate-50"}`}>{m === "OFFLINE" ? "Tại trung tâm" : "Online"}</button>
                ))}
              </div>
            </div>
            <F label="Phòng học"><select name="roomId" className={ic}><option value="">-- chưa xếp --</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></F>
            <div className="md:col-span-2"><F label="Bộ điểm" hint="Chọn mẫu bảng điểm cho lớp (có thể đổi sau)"><select name="gradeTemplateId" className={ic}><option value="">-- chưa chọn --</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></F></div>
          </div>
        </Section>

        <Section icon={GraduationCap} title="Đội ngũ phụ trách" hint="Mỗi lớp có 1 giáo viên, 1 trợ giảng và 1 giáo vụ — quản lý riêng ở các mục tương ứng">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-slate-50 p-3"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><GraduationCap className="size-4 text-orange-700" /> Giáo viên</div>
              <select name="teacherId" className={ic}><option value="">-- chọn giáo viên --</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
              {showRate && <input name="teacherRate" inputMode="numeric" placeholder="Đơn giá riêng cho lớp này (đ) — tuỳ chọn" className={`${ic} mt-2`} />}
              <p className="mt-1.5 text-xs text-slate-500">Người giảng dạy chính, được tính lương theo buổi dạy. Để trống đơn giá = theo mức lương của giáo viên.</p></div>
            <div className="rounded-lg border bg-slate-50 p-3"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><UserCheck className="size-4 text-orange-700" /> Trợ giảng</div>
              <select name="assistantId" className={ic}><option value="">-- chọn trợ giảng --</option>{assistants.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
              <p className="mt-1.5 text-xs text-slate-500">Hỗ trợ điểm danh, chấm bài, nhập điểm.</p></div>
            <div className="rounded-lg border bg-slate-50 p-3"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="size-4 text-orange-700" /> Giáo vụ</div>
              <select name="coordinatorId" className={ic}><option value="">-- chọn giáo vụ --</option>{coordinators.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
              <p className="mt-1.5 text-xs text-slate-500">Phụ trách vận hành lớp, liên hệ phụ huynh.</p></div>
          </div>
        </Section>

        <Section icon={CalendarDays} title="Lịch học" hint="Chọn các ngày học trong tuần, hệ thống tự sinh các buổi học">
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600">Các ngày học trong tuần *</div>
              <div className="grid grid-cols-7 gap-2">
                {WD.map(([d, l]) => (
                  <button type="button" key={d} onClick={() => toggle(d)} className={`h-11 rounded-md border text-sm font-medium transition-colors ${days.includes(d) ? "border-orange-600 bg-orange-600 text-white" : "bg-white hover:bg-slate-50"}`}>{l}</button>
                ))}
              </div>
              {days.map((d) => <input key={d} type="hidden" name="weekday" value={d} />)}
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <F label="Từ giờ"><input type="time" name="startTime" value={from} onChange={(e) => setFrom(e.target.value)} className={ic} /></F>
              <F label="Đến giờ"><input type="time" name="endTime" value={to} onChange={(e) => setTo(e.target.value)} className={`${ic} ${timeBad ? "border-red-500" : ""}`} /></F>
              <F label="Ngày bắt đầu *"><input type="date" name="startDate" value={start} onChange={(e) => setStart(e.target.value)} className={ic} required /></F>
              <F label="Tổng số buổi"><input name="totalSessions" value={total} onChange={(e) => setTotal(parseInt(e.target.value.replace(/\D/g, "")) || 0)} inputMode="numeric" className={ic} /></F>
            </div>
            {timeBad && <p className="text-sm text-red-600">Giờ kết thúc phải sau giờ bắt đầu.</p>}
          </div>
        </Section>

        <Section icon={Wallet} title="Sĩ số & Học phí">
          <div className="grid gap-4 md:grid-cols-3">
            <F label="Sĩ số tối đa"><input name="maxStudents" defaultValue={20} inputMode="numeric" className={ic} /></F>
            <F label={billing === "ONCE" ? "Học phí trọn khoá (đ)" : "Học phí mỗi tháng (đ)"}><input name="tuitionFee" value={fee || ""} onChange={(e) => setFee(parseInt(e.target.value.replace(/\D/g, "")) || 0)} inputMode="numeric" className={ic} placeholder="0" /></F>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600">Hình thức thu</div>
              <div className="grid grid-cols-2 gap-2">
                {(["ONCE", "MONTHLY"] as const).map((b) => (
                  <button type="button" key={b} onClick={() => setBilling(b)} className={`h-10 rounded-md border text-sm font-medium ${billing === b ? "border-orange-600 bg-orange-50 text-orange-700" : "bg-white hover:bg-slate-50"}`}>{b === "ONCE" ? "Trọn khoá" : "Theo tháng"}</button>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ===== Tóm tắt (cột phải) ===== */}
      <aside className="xl:sticky xl:top-20 xl:self-start">
        <div className="space-y-3 rounded-lg border bg-white p-5">
          <h2 className="font-semibold">Tóm tắt lớp</h2>
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Tên lớp</div>
            <div className="font-semibold">{name || <span className="font-normal text-slate-400">Chưa nhập</span>}</div>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Lịch học</dt><dd className="text-right font-medium">{days.length ? `${[...days].sort((a, b) => (a || 7) - (b || 7)).map((d) => SHORT[d]).join(" · ")}` : "—"}<br /><span className="font-normal text-slate-600">{from} – {to}{!timeBad && duration > 0 ? ` (${duration} phút)` : ""}</span></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Số buổi</dt><dd className="font-medium">{total || 0} buổi{days.length ? ` · ${days.length} buổi/tuần` : ""}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Bắt đầu</dt><dd className="font-medium">{start ? fmt(new Date(start + "T00:00:00Z")) : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Dự kiến kết thúc</dt><dd className="font-medium text-orange-700">{end ? fmt(end) : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Học phí</dt><dd className="font-medium">{fee ? `${fee.toLocaleString("vi-VN")} đ${billing === "MONTHLY" ? "/tháng" : ""}` : "—"}</dd></div>
          </dl>
          <p className="text-xs text-slate-400">Ngày kết thúc dự kiến chưa tính ngày nghỉ lễ đã khai báo; hệ thống sẽ tự bỏ qua ngày lễ khi sinh buổi học.</p>
          <button disabled={pending || !days.length || timeBad || !name.trim()} className="h-10 w-full rounded-md bg-orange-600 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Đang tạo..." : "Tạo lớp & sinh buổi học"}</button>
          {!days.length && <p className="text-xs text-slate-500">Hãy chọn ít nhất 1 ngày học.</p>}
          {res?.error && <p className="whitespace-pre-line text-sm text-red-600">{res.error}</p>}
        </div>
      </aside>
    </form>
  );
}
