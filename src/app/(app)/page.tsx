import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, BookOpen, ChevronDown, CalendarClock, Check, Hourglass, RotateCcw, Trash2, Users, Wallet, Wallet2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, teachingIds } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, inputCls, Title } from "@/components/ui";
import { todayUTC, fmtMoney, fmtDate, toMinutes, nowVN, roomLabel } from "@/lib/format";
import { PortalHome } from "@/components/portal";
import { addNote, toggleNote, deleteNote } from "./notes-actions";
import { loadStudents } from "@/server/status";

const short = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr` : fmtMoney(n));

type TodaySession = { id: string; startTime: string; endTime: string; status: string; class: { name: string; mode: string; _count: { enrollments: number } }; teacher: { fullName: string } | null; room: { name: string; branch: { name: string } | null } | null };

function TodayList({ sessions }: { sessions: TodaySession[] }) {
  const nowVN = new Date(Date.now() + 7 * 3600_000);
  const now = nowVN.getUTCHours() * 60 + nowVN.getUTCMinutes();
  const badge = (s: TodaySession) => {
    if (s.status === "CANCELLED") return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Nghỉ</span>;
    if (s.status === "DONE") return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Đã điểm danh</span>;
    if (now >= toMinutes(s.startTime) && now < toMinutes(s.endTime)) return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">Đang diễn ra</span>;
    if (now >= toMinutes(s.endTime)) return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">Chưa điểm danh</span>;
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Sắp diễn ra</span>;
  };
  if (!sessions.length) return <p className="px-4 py-10 text-center text-sm text-slate-500">Hôm nay không có lớp nào.</p>;
  return (
    <ul className="divide-y">
      {sessions.map((s) => (
        <li key={s.id} className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-x-4 ${s.status === "CANCELLED" ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between gap-2 sm:w-28 sm:shrink-0">
            <div className="text-sm font-semibold tabular-nums">{s.startTime}<span className="text-slate-400"> – </span>{s.endTime}</div>
            <span className="sm:hidden">{badge(s)}</span>
          </div>
          <div className="min-w-0 sm:flex-1">
            <div className="font-medium sm:truncate">{s.class.name}</div>
            <div className="text-xs text-slate-500 sm:truncate">{s.teacher?.fullName ?? "Chưa có GV"} · {roomLabel(s.room) ?? "Chưa có phòng"} · {s.class.mode === "ONLINE" ? "Online" : "Offline"} · {s.class._count.enrollments} HV</div>
          </div>
          <span className="hidden sm:inline">{badge(s)}</span>
          {s.status !== "CANCELLED" && <Link href={`/diem-danh/${s.id}`} className="inline-flex h-9 w-full items-center justify-center rounded-md border bg-white px-3 text-sm font-medium text-orange-700 hover:bg-orange-50 sm:h-8 sm:w-auto">{s.status === "DONE" ? "Xem / sửa" : "Điểm danh"}</Link>}
        </li>
      ))}
    </ul>
  );
}


/** Buổi đã qua giờ nhưng chưa điểm danh và chưa cho nghỉ. */
async function loadOverdue(scope: object) {
  const today = todayUTC();
  const n = nowVN();
  const hhmm = `${String(n.getUTCHours()).padStart(2, "0")}:${String(n.getUTCMinutes()).padStart(2, "0")}`;
  const where = { status: "PLANNED" as const, ...scope, OR: [{ date: { lt: today } }, { date: today, endTime: { lt: hhmm } }] };
  const [count, list] = await Promise.all([
    db.session.count({ where }),
    db.session.findMany({ where, orderBy: [{ date: "desc" }, { startTime: "asc" }], take: 6, include: { class: true, teacher: true } }),
  ]);
  return { count, list };
}

function OverdueCard({ data, staff }: { data: Awaited<ReturnType<typeof loadOverdue>>; staff: boolean }) {
  if (!data.count) return null;
  return (
    <Card className="border-red-300 p-0">
      {/* Thu gọn sẵn (cả máy tính lẫn điện thoại): chỉ hiện tiêu đề và số buổi, bấm để xem danh sách. */}
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <h2 className="flex items-center gap-2 font-semibold text-red-600"><AlertTriangle className="size-4 shrink-0" /> Buổi quá giờ chưa xử lý ({data.count})</h2>
          <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500"><span className="group-open:hidden">Xem</span><span className="hidden group-open:inline">Thu gọn</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" /></span>
        </summary>
        <div className="border-t">
          <p className="px-4 pt-3 text-xs text-slate-500">Buổi đã qua giờ nhưng chưa điểm danh và chưa cho nghỉ. Buổi chưa điểm danh thì <b>không được tính công</b>. {staff ? "Mở buổi để điểm danh bù, hoặc cho nghỉ nếu lớp không học." : "Hãy điểm danh bù, hoặc báo giáo vụ nếu lớp không học."}</p>
          <ul className="divide-y text-sm">
            {data.list.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><b>{s.class.name}</b><div className="text-xs text-slate-500">{fmtDate(s.date)} · {s.startTime}-{s.endTime}{s.teacher ? ` · ${s.teacher.fullName}` : ""}</div></div>
                <Link href={`/diem-danh/${s.id}`} className="inline-flex h-9 w-full items-center justify-center rounded-md bg-orange-600 px-3 text-xs font-medium text-white hover:bg-orange-700 sm:h-8 sm:w-auto">Điểm danh bù</Link>
              </li>
            ))}
          </ul>
          {data.count > data.list.length && <div className="border-t px-4 py-2 text-xs text-slate-500">Còn {data.count - data.list.length} buổi nữa. Xem trong <Link href="/lich-hoc" className="text-orange-700 underline">Lịch học</Link> (ô viền đỏ đang quá giờ).</div>}
        </div>
      </details>
    </Card>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const me = await requireRole();
  if (me.role === "SUPERADMIN") redirect("/platform");
  if (me.role === "STUDENT" || me.role === "PARENT") return <PortalHome searchParams={searchParams} />;

  const today = todayUTC();
  const t = me.role === "TEACHER" ? await teachingIds(me.id) : null;
  // Bắt đầu truy vấn buổi học ngay, chạy song song với các truy vấn còn lại bên dưới.
  const sessionsQ = db.session.findMany({
    where: { date: today, ...(t ? { OR: [{ teacherId: t.teacherId ?? "-" }, { class: { assistantId: t.assistantId ?? "-" } }] } : {}) },
    orderBy: { startTime: "asc" },
    include: { class: { select: { name: true, mode: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } }, teacher: { select: { fullName: true } }, room: { select: { name: true, branch: { select: { name: true } } } } },
  });
  const todayCard = (sessions: TodaySession[]) => (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold"><CalendarClock className="size-4 text-orange-700" /> {t ? "Lịch dạy hôm nay" : "Lịch học hôm nay"} ({sessions.length})</h2>
        <Link href="/lich-hoc" className="text-sm text-orange-700 hover:underline">Xem lịch tuần →</Link>
      </div>
      <TodayList sessions={sessions} />
    </Card>
  );
  if (t || me.role === "TEACHER") {
    const [sessions, mine] = await Promise.all([sessionsQ, loadOverdue({ OR: [{ teacherId: t?.teacherId ?? "-" }, { class: { assistantId: t?.assistantId ?? "-" } }] })]);
    return <div className="space-y-4"><Title>Xin chào, {me.name}</Title><OverdueCard data={mine} staff={false} />{todayCard(sessions)}</div>;
  }

  const months = Array.from({ length: 6 }, (_, i) => {
    const nowVN = new Date(Date.now() + 7 * 3600_000);
    const d = new Date(Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth() - (5 - i), 1));
    return { from: d, to: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)), label: `T${d.getUTCMonth() + 1}` };
  });
  const since = months[0].from;
  const [sessions, overdueSessions, students, activeClasses, debt, notes, overdue, overdueCount, payRows, expRows] = await Promise.all([
    sessionsQ,
    loadOverdue({}),
    loadStudents(),
    db.class.count({ where: { finished: false } }),
    db.invoice.aggregate({ _sum: { total: true, paid: true }, where: { status: { in: ["UNPAID", "PARTIAL"] } } }),
    db.note.findMany({ orderBy: [{ done: "asc" }, { createdAt: "desc" }], take: 12 }),
    db.invoice.findMany({ where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: today } }, orderBy: { dueDate: "asc" }, take: 5, include: { student: true } }),
    db.invoice.count({ where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: today } } }),
    // Thu/chi 6 tháng: lấy một lần rồi cộng theo tháng (thay vì 12 truy vấn riêng lẻ).
    db.payment.findMany({ where: { paidAt: { gte: since } }, select: { amount: true, paidAt: true } }),
    db.expense.findMany({ where: { date: { gte: since } }, select: { amount: true, date: true } }),
  ]);
  const flow = months.map((m) => ({
    label: m.label,
    income: payRows.filter((r) => r.paidAt >= m.from && r.paidAt < m.to).reduce((a, r) => a + r.amount, 0),
    expense: expRows.filter((r) => r.date >= m.from && r.date < m.to).reduce((a, r) => a + r.amount, 0),
  }));
  const cnt = (k: string) => students.filter((s) => s.status === k).length;
  const owed = (debt._sum.total ?? 0) - (debt._sum.paid ?? 0);
  const ending = students.filter((s) => s.status === "ending" || (s.remain != null && s.remain <= 3 && s.status !== "finished" && s.status !== "dropped")).sort((a, b) => (a.remain ?? 99) - (b.remain ?? 99)).slice(0, 6);
  const maxFlow = Math.max(1, ...flow.flatMap((f) => [f.income, f.expense]));

  const Stat = ({ icon: I, label, value, href, tone = "bg-orange-100 text-orange-700", valueTone = "" }: { icon: typeof Users; label: string; value: React.ReactNode; href: string; tone?: string; valueTone?: string }) => (
    <Link href={href}>
      <Card className="flex h-full items-center gap-2 p-3 transition-colors hover:border-orange-400 sm:gap-3 sm:p-4">
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg sm:size-11 ${tone}`}><I className="size-4 sm:size-5" /></span>
        <div className="min-w-0"><div className="truncate text-xs text-slate-500">{label}</div><div className={`truncate text-xl font-bold leading-tight sm:text-2xl ${valueTone}`}>{value}</div></div>
      </Card>
    </Link>
  );

  return (
    <div className="space-y-4">
      <Title>Tổng quan</Title>
      <OverdueCard data={overdueSessions} staff />
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
        <Stat icon={Users} label="Học viên đang học" value={cnt("learning") + cnt("ending") + cnt("makeup")} href="/hoc-vien?tab=learning" />
        <Stat icon={Hourglass} label="Chờ xếp lớp" value={cnt("waiting")} href="/hoc-vien?tab=waiting" tone="bg-sky-100 text-sky-700" />
        <Stat icon={BookOpen} label="Lớp đang mở" value={activeClasses} href="/lop-hoc" tone="bg-green-100 text-green-700" />
        <Stat icon={Wallet} label="Công nợ" value={short(owed)} href="/tai-chinh?tab=debt" tone="bg-red-100 text-red-600" valueTone="text-red-600" />
        <Stat icon={AlertTriangle} label="Phiếu quá hạn" value={overdueCount} href="/tai-chinh?tab=debt" tone="bg-red-100 text-red-600" valueTone="text-red-600" />
        <Stat icon={RotateCcw} label="Nghỉ chưa xếp bù" value={cnt("makeup")} href="/hoc-vien?tab=makeup" tone="bg-yellow-100 text-yellow-700" valueTone="text-yellow-700" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {todayCard(sessions)}

          <Card className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="flex items-center gap-2 font-semibold"><Wallet2 className="size-4 text-orange-700" /> Thu / Chi 6 tháng gần nhất</h2>
              <Link href="/bao-cao" className="text-sm text-orange-700 hover:underline">Báo cáo →</Link>
            </div>
            <div className="flex h-44 items-end gap-3 px-4 pb-3 pt-6">
              {flow.map((f) => (
                <div key={f.label} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-32 w-full items-end justify-center gap-1">
                    <div title={`Thu ${fmtMoney(f.income)}`} className="w-1/3 max-w-8 rounded-t bg-green-500" style={{ height: `${(f.income / maxFlow) * 100}%`, minHeight: f.income ? 2 : 0 }} />
                    <div title={`Chi ${fmtMoney(f.expense)}`} className="w-1/3 max-w-8 rounded-t bg-red-400" style={{ height: `${(f.expense / maxFlow) * 100}%`, minHeight: f.expense ? 2 : 0 }} />
                  </div>
                  <span className="text-xs text-slate-500">{f.label}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 border-t px-4 py-2 text-xs text-slate-500"><span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm bg-green-500" /> Thu</span><span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm bg-red-400" /> Chi</span></div>
          </Card>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-red-600" /> Học phí quá hạn ({overdueCount})</h2>
              <Link href="/tai-chinh?tab=debt" className="text-sm text-orange-700 hover:underline">Xem tất cả →</Link>
            </div>
            <ul className="divide-y text-sm">
              {overdue.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0"><Link href={`/tai-chinh/${i.id}`} className="font-medium text-orange-700 hover:underline">{i.code}</Link> · {i.student.fullName}<div className="text-xs text-slate-500">Hạn {fmtDate(i.dueDate)}</div></div>
                  <b className="shrink-0 text-red-600">{fmtMoney(i.total - i.paid)}</b>
                </li>
              ))}
              {!overdue.length && <li className="px-4 py-6 text-center text-slate-500">Không có phiếu quá hạn.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-0">
            <div className="border-b px-4 py-3"><h2 className="font-semibold">Việc cần xử lý</h2></div>
            <ul className="divide-y">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start gap-2 px-4 py-2.5 text-sm">
                  <ActionForm action={toggleNote} submit={n.done ? <RotateCcw className="size-4" /> : <Check className="size-4" />} compact ghost className="inline-flex"><input type="hidden" name="id" value={n.id} /></ActionForm>
                  <span className={`min-w-0 flex-1 pt-0.5 ${n.done ? "text-slate-400 line-through" : ""}`}>{n.content}</span>
                  <ActionForm action={deleteNote} submit={<Trash2 className="size-4" />} compact ghost danger className="inline-flex"><input type="hidden" name="id" value={n.id} /></ActionForm>
                </li>
              ))}
              {!notes.length && <li className="px-4 py-6 text-center text-sm text-slate-500">Không có việc đang chờ.</li>}
            </ul>
            <div className="border-t p-3">
              <ActionForm action={addNote} submit="Thêm" className="flex gap-2"><input name="content" className={inputCls + " min-w-0 flex-1"} placeholder="Nhập việc cần xử lý..." /></ActionForm>
            </div>
          </Card>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">Sắp hết khoá học</h2>
              <Link href="/hoc-vien?tab=ending" className="text-sm text-orange-700 hover:underline">Xem →</Link>
            </div>
            <ul className="divide-y text-sm">
              {ending.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <Link href={`/hoc-vien/${s.id}`} className="min-w-0 truncate font-medium hover:text-orange-700">{s.fullName}</Link>
                  <span className="shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">còn {s.remain} buổi</span>
                </li>
              ))}
              {!ending.length && <li className="px-4 py-6 text-center text-slate-500">Chưa có học viên sắp hết khoá.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
