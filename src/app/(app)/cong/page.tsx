import Link from "next/link";
import { Clock, Wallet, CalendarCheck, BadgeCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, teachingIds } from "@/lib/guard";
import { DialogButton } from "@/components/dialog";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Table, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Landmark } from "lucide-react";
import { computePay, monthRange, PAY_LABEL, sessionPay } from "@/server/payroll";
import { lockPayroll, payPayroll, unlockPayroll } from "./actions";

const fm = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const V = "flex flex-col gap-3 [&>button]:self-start";

export default async function Timesheet({ searchParams }: { searchParams: Promise<{ m?: string; page?: string; size?: string }> }) {
  const me = await requireRole("ADMIN", "STAFF", "TEACHER");
  const sp = await searchParams;
  const nowVN = new Date(Date.now() + 7 * 3600_000);
  const m = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m ?? "") ? sp.m! : fm(nowVN);
  const pg = getPaging(sp);
  const { from, to, y, mo } = monthRange(m);
  const isAdmin = me.role === "ADMIN";

  // Chỉ Admin xem lương của mọi người. Giáo viên / trợ giảng / giáo vụ chỉ xem của chính mình.
  if (!isAdmin) {
    const ids = me.role === "TEACHER" ? await teachingIds(me.id) : null;
    if (me.role === "STAFF" || !ids?.teacherId) return <OwnStaffPay userId={me.id} role={me.role} m={m} />;
  }

  const mine = me.role === "TEACHER" ? await db.teacher.findUnique({ where: { userId: me.id } }) : null;
  const teachers = await db.teacher.findMany({ where: me.role === "TEACHER" ? { id: mine?.id ?? "-" } : {}, orderBy: { fullName: "asc" } });
  const [sessions, payrolls] = await Promise.all([
    db.session.findMany({ where: { status: "DONE", date: { gte: from, lt: to }, teacherId: { in: teachers.map((t) => t.id) } }, include: { class: { select: { name: true, teacherRate: true } } }, orderBy: [{ date: "asc" }, { startTime: "asc" }] }),
    db.payroll.findMany({ where: { month: m } }),
  ]);
  const rows = teachers.map((t) => {
    const list = sessions.filter((s) => s.teacherId === t.id);
    const live = computePay(t, list);
    const pr = payrolls.find((p) => p.teacherId === t.id);
    const base = pr ? pr.baseAmount : live.base;
    const sub = pr ? pr.substituteAmount : live.substitute;
    const adj = pr?.adjustment ?? 0;
    return { t, list, pr, sessions: pr ? pr.sessions : live.sessions, hours: pr ? pr.hours : live.hours, base, sub, subCount: list.filter((x) => x.originalTeacherId).length, adj, net: base + sub + adj };
  }).filter((r) => r.sessions > 0 || r.pr || r.t.payType === "FIXED");

  const totals = {
    sub: rows.reduce((s, r) => s + r.sub, 0),
    sessions: rows.reduce((s, r) => s + r.sessions, 0),
    hours: rows.reduce((s, r) => s + r.hours, 0),
    net: rows.reduce((s, r) => s + r.net, 0),
    paid: rows.filter((r) => r.pr?.status === "PAID").reduce((s, r) => s + r.net, 0),
  };
  const page = rows.slice(pg.skip, pg.skip + pg.take);
  const q = (mm: string) => `/cong?m=${mm}${sp.size ? `&size=${sp.size}` : ""}`;
  const prev = fm(new Date(Date.UTC(y, mo - 2, 1))), next = fm(new Date(Date.UTC(y, mo, 1)));

  const Stat = ({ icon: I, label, value, tone = "" }: { icon: typeof Clock; label: string; value: string; tone?: string }) => (
    <Card className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-lg bg-orange-100 text-orange-700"><I className="size-5" /></span>
      <div><div className="text-xs text-slate-500">{label}</div><div className={`text-xl font-bold ${tone}`}>{value}</div></div>
    </Card>
  );
  const status = (r: (typeof rows)[number]) =>
    r.pr?.status === "PAID" ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Đã trả {fmtDate(r.pr.paidAt)}</span>
    : r.pr ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">Đã chốt</span>
    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Chưa chốt</span>;

  return (
    <div className="space-y-4">
      <Title right={<div className="flex items-center gap-2 text-sm">
        <Link className="inline-flex size-9 items-center justify-center rounded-md border bg-white hover:bg-slate-50" href={q(prev)} aria-label="Tháng trước">‹</Link>
        <span className="min-w-28 text-center font-medium">Tháng {mo}/{y}</span>
        <Link className="inline-flex size-9 items-center justify-center rounded-md border bg-white hover:bg-slate-50" href={q(next)} aria-label="Tháng sau">›</Link>
      </div>}>Chấm công & Lương</Title>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={CalendarCheck} label="Tổng số buổi dạy" value={String(totals.sessions)} />
        <Stat icon={Clock} label="Tổng số giờ" value={totals.hours.toFixed(1)} />
        <Stat icon={Wallet} label="Tổng lương phải trả" value={fmtMoney(totals.net)} tone="text-orange-700" />
        <Stat icon={BadgeCheck} label="Đã trả" value={fmtMoney(totals.paid)} tone="text-green-700" />
      </div>
      <p className="text-sm text-slate-500">Công được tính tự động từ các buổi đã điểm danh. {isAdmin && "Bấm “Chốt lương” để khoá số liệu tháng, sau đó “Đã trả” để ghi nhận chi phí."}</p>

      <Table head={["Giáo viên", "Kiểu lương", "Số buổi", "Số giờ", "Lương cơ bản", "Dạy thế", "Điều chỉnh", "Thực nhận", "Trạng thái", ""]}>
        {page.map((r) => (
          <tr key={r.t.id}>
            <td><div className="font-medium">{r.t.fullName}</div><div className="text-xs text-slate-500">{r.t.specialty ?? ""}</div></td>
            <td className="whitespace-nowrap">{PAY_LABEL[r.t.payType]}<div className="text-xs text-slate-500">{fmtMoney(r.t.payRate)}</div></td>
            <td>{r.sessions}</td>
            <td>{r.hours.toFixed(1)}</td>
            <td className="whitespace-nowrap">{fmtMoney(r.base)}</td>
            <td className="whitespace-nowrap">{r.sub ? <span className="text-sky-700">+{fmtMoney(r.sub)}<div className="text-[11px] text-slate-500">{r.subCount} buổi dạy thế</div></span> : "-"}</td>
            <td className={`whitespace-nowrap ${r.adj < 0 ? "text-red-600" : r.adj > 0 ? "text-green-700" : ""}`}>{r.adj ? `${r.adj > 0 ? "+" : ""}${fmtMoney(r.adj)}` : "-"}</td>
            <td className="whitespace-nowrap font-bold text-orange-700">{fmtMoney(r.net)}</td>
            <td>{status(r)}</td>
            <td>
              <div className="flex flex-wrap items-center gap-1.5">
                <DialogButton variant="secondary" wide label="Chi tiết" title={`Chi tiết công · ${r.t.fullName} · tháng ${mo}/${y}`}>
                  <Table head={["Ngày", "Lớp", "Giờ dạy", "Số giờ", "Thù lao"]}>
                    {r.list.map((s) => <tr key={s.id}><td>{fmtDate(s.date)}</td><td>{s.class.name}{s.originalTeacherId && <span className="ml-1 rounded bg-sky-100 px-1.5 text-[11px] text-sky-700">Dạy thế</span>}</td><td>{s.startTime}-{s.endTime}</td><td>{((parseInt(s.endTime) * 60 + parseInt(s.endTime.slice(3)) - parseInt(s.startTime) * 60 - parseInt(s.startTime.slice(3))) / 60).toFixed(1)}</td><td>{r.t.payType === "FIXED" && !s.originalTeacherId ? "gồm trong lương cố định" : fmtMoney(sessionPay(r.t, s))}</td></tr>)}
                    {!r.list.length && <tr><td colSpan={5} className="py-6 text-center text-slate-500">Không có buổi dạy nào trong tháng.</td></tr>}
                  </Table>
                  {r.pr?.note && <p className="mt-3 text-sm text-slate-600">Ghi chú: {r.pr.note}</p>}
                </DialogButton>
                {isAdmin && !r.pr && (
                  <DialogButton label="Chốt lương" title={`Chốt lương · ${r.t.fullName} · ${mo}/${y}`}>
                    <p className="mb-3 text-sm text-slate-600">Lương cơ bản <b>{fmtMoney(r.base)}</b>{r.sub ? <> + dạy thế <b>{fmtMoney(r.sub)}</b> ({r.subCount} buổi)</> : null} ({r.sessions} buổi, {r.hours.toFixed(1)} giờ). Nhập thưởng (số dương) hoặc phạt/trừ (số âm) nếu có.</p>
                    <ActionForm action={lockPayroll} submit="Chốt bảng lương" className={V}>
                      <input type="hidden" name="teacherId" value={r.t.id} /><input type="hidden" name="month" value={m} />
                      <Field label="Điều chỉnh (đ)"><input name="adjustment" defaultValue={0} inputMode="numeric" className={inputCls + " w-full"} /></Field>
                      <Field label="Ghi chú"><input name="note" className={inputCls + " w-full"} placeholder="vd: thưởng dạy thay, trừ đi muộn" /></Field>
                    </ActionForm>
                  </DialogButton>
                )}
                {isAdmin && r.pr?.status === "LOCKED" && (
                  <>
                    <ActionForm action={payPayroll} submit="Đã trả" confirmText={`Xác nhận đã trả ${fmtMoney(r.net)} cho ${r.t.fullName}?`} className="inline-flex"><input type="hidden" name="id" value={r.pr.id} /></ActionForm>
                    <ActionForm action={unlockPayroll} submit="Mở lại" danger confirmText="Mở lại bảng lương này?" className="inline-flex"><input type="hidden" name="id" value={r.pr.id} /></ActionForm>
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
        {!page.length && <tr><td colSpan={10} className="py-8 text-center text-slate-500">Chưa có buổi dạy nào trong tháng này.</td></tr>}
      </Table>
      <Pagination total={rows.length} page={pg.page} size={pg.size} path="/cong" params={{ m, size: sp.size }} />
    </div>
  );
}


/** Lương của chính trợ giảng / giáo vụ (không xem được của người khác). */
async function OwnStaffPay({ userId, role, m }: { userId: string; role: string; m: string }) {
  const { from, to, y, mo } = monthRange(m);
  const coordinator = role === "STAFF" ? await db.coordinator.findUnique({ where: { userId } }) : null;
  const assistant = role === "TEACHER" ? await db.assistant.findUnique({ where: { userId } }) : null;
  const prev = fm(new Date(Date.UTC(y, mo - 2, 1))), next = fm(new Date(Date.UTC(y, mo, 1)));
  const nav = (
    <div className="flex items-center gap-2 text-sm">
      <Link className="inline-flex size-9 items-center justify-center rounded-md border bg-white hover:bg-slate-50" href={`/cong?m=${prev}`} aria-label="Tháng trước">‹</Link>
      <span className="min-w-28 text-center font-medium">Tháng {mo}/{y}</span>
      <Link className="inline-flex size-9 items-center justify-center rounded-md border bg-white hover:bg-slate-50" href={`/cong?m=${next}`} aria-label="Tháng sau">›</Link>
    </div>
  );

  if (coordinator) {
    return (
      <div className="space-y-4">
        <Title>Lương của tôi</Title>
        <Card className="space-y-3 text-sm">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><div className="text-xs text-slate-500">Họ tên</div><b>{coordinator.fullName}</b></div>
            <div><div className="text-xs text-slate-500">Chức vụ</div><b>{coordinator.position ?? "Giáo vụ"}</b></div>
            <div><div className="text-xs text-slate-500">Lương cố định mỗi tháng</div><b className="text-lg text-orange-700">{fmtMoney(coordinator.salary)}</b></div>
          </div>
          <div className="flex items-center gap-2 border-t pt-3 text-slate-600"><Landmark className="size-4" />{coordinator.bankAccount ? `${coordinator.bankName ?? ""} · ${coordinator.bankAccount}` : "Chưa khai báo tài khoản ngân hàng"}</div>
        </Card>
        <p className="text-sm text-slate-500">Bạn chỉ xem được thông tin lương của chính mình.</p>
      </div>
    );
  }

  if (assistant) {
    const sessions = await db.session.findMany({ where: { status: "DONE", date: { gte: from, lt: to }, class: { assistantId: assistant.id } }, include: { class: { select: { name: true } } }, orderBy: [{ date: "asc" }, { startTime: "asc" }] });
    const pay = computePay({ payType: assistant.payType, payRate: assistant.payRate }, sessions.map((s) => ({ startTime: s.startTime, endTime: s.endTime })));
    return (
      <div className="space-y-4">
        <Title right={nav}>Công & Lương của tôi</Title>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card className="p-4"><div className="text-xs text-slate-500">Số buổi hỗ trợ</div><div className="text-xl font-bold">{pay.sessions}</div></Card>
          <Card className="p-4"><div className="text-xs text-slate-500">Số giờ</div><div className="text-xl font-bold">{pay.hours.toFixed(1)}</div></Card>
          <Card className="p-4"><div className="text-xs text-slate-500">Kiểu lương · mức</div><div className="text-xl font-bold">{PAY_LABEL[assistant.payType]} · {fmtMoney(assistant.payRate)}</div></Card>
          <Card className="p-4"><div className="text-xs text-slate-500">Tạm tính tháng này</div><div className="text-xl font-bold text-orange-700">{fmtMoney(pay.total)}</div></Card>
        </div>
        <Table head={["Ngày", "Lớp", "Giờ"]}>
          {sessions.map((s) => <tr key={s.id}><td>{fmtDate(s.date)}</td><td>{s.class.name}</td><td>{s.startTime}-{s.endTime}</td></tr>)}
          {!sessions.length && <tr><td colSpan={3} className="py-8 text-center text-slate-500">Chưa có buổi nào trong tháng.</td></tr>}
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Title>Công & Lương của tôi</Title>
      <Card className="text-sm text-slate-600">Tài khoản của bạn chưa được gắn với hồ sơ nhân sự (giáo viên, trợ giảng hoặc giáo vụ) nên chưa có bảng lương riêng. Liên hệ quản trị viên.</Card>
    </div>
  );
}
