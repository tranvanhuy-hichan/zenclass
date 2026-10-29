import Link from "next/link";
import { AlertTriangle, BookOpen, CalendarClock, Check, Hourglass, RotateCcw, Trash2, Users, Wallet, Wallet2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, inputCls, Title } from "@/components/ui";
import { todayUTC, fmtMoney, addDays, fmtDate, toMinutes } from "@/lib/format";
import { StudentOverview } from "@/components/student-overview";
import { addNote, toggleNote, deleteNote } from "./notes-actions";
import { loadStudents } from "@/server/status";

const short = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr` : fmtMoney(n));

type TodaySession = { id: string; startTime: string; endTime: string; status: string; class: { name: string; mode: string; _count: { enrollments: number } }; teacher: { fullName: string } | null; room: { name: string } | null };

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
        <li key={s.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${s.status === "CANCELLED" ? "opacity-60" : ""}`}>
          <div className="w-28 shrink-0 text-sm font-semibold tabular-nums">{s.startTime}<span className="text-slate-400"> – </span>{s.endTime}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{s.class.name}</div>
            <div className="truncate text-xs text-slate-500">{s.teacher?.fullName ?? "Chưa có GV"} · {s.room?.name ?? "Chưa có phòng"} · {s.class.mode === "ONLINE" ? "Online" : "Offline"} · {s.class._count.enrollments} HV</div>
          </div>
          {badge(s)}
          {s.status !== "CANCELLED" && <Link href={`/diem-danh/${s.id}`} className="inline-flex h-8 items-center rounded-md border bg-white px-3 text-sm font-medium text-orange-700 hover:bg-orange-50">{s.status === "DONE" ? "Xem / sửa" : "Điểm danh"}</Link>}
        </li>
      ))}
    </ul>
  );
}

export default async function Home() {
  const me = await requireRole();
  if (me.role === "STUDENT" || me.role === "PARENT") return <Portal meId={me.id} role={me.role} />;

  const today = todayUTC();
  const t = me.role === "TEACHER" ? await db.teacher.findUnique({ where: { userId: me.id } }) : null;
  const sessions = await db.session.findMany({
    where: { date: today, ...(t ? { OR: [{ teacherId: t.id }, { class: { assistantId: t.id } }] } : {}) },
    orderBy: { startTime: "asc" },
    include: { class: { select: { name: true, mode: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } }, teacher: { select: { fullName: true } }, room: { select: { name: true } } },
  });
  const todayCard = (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold"><CalendarClock className="size-4 text-orange-700" /> {t ? "Lịch dạy hôm nay" : "Lịch học hôm nay"} ({sessions.length})</h2>
        <Link href="/lich-hoc" className="text-sm text-orange-700 hover:underline">Xem lịch tuần →</Link>
      </div>
      <TodayList sessions={sessions} />
    </Card>
  );
  if (t || me.role === "TEACHER") return <div className="space-y-4"><Title>Xin chào, {me.name}</Title>{todayCard}</div>;

  const months = Array.from({ length: 6 }, (_, i) => {
    const nowVN = new Date(Date.now() + 7 * 3600_000);
    const d = new Date(Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth() - (5 - i), 1));
    return { from: d, to: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)), label: `T${d.getUTCMonth() + 1}` };
  });
  const [students, activeClasses, debt, notes, overdue, overdueCount, flow] = await Promise.all([
    loadStudents(),
    db.class.count({ where: { finished: false } }),
    db.invoice.aggregate({ _sum: { total: true, paid: true }, where: { status: { in: ["UNPAID", "PARTIAL"] } } }),
    db.note.findMany({ orderBy: [{ done: "asc" }, { createdAt: "desc" }], take: 12 }),
    db.invoice.findMany({ where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: today } }, orderBy: { dueDate: "asc" }, take: 5, include: { student: true } }),
    db.invoice.count({ where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: today } } }),
    Promise.all(months.map(async (m) => ({
      label: m.label,
      income: (await db.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: m.from, lt: m.to } } }))._sum.amount ?? 0,
      expense: (await db.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: m.from, lt: m.to } } }))._sum.amount ?? 0,
    }))),
  ]);
  const cnt = (k: string) => students.filter((s) => s.status === k).length;
  const owed = (debt._sum.total ?? 0) - (debt._sum.paid ?? 0);
  const ending = students.filter((s) => s.status === "ending" || (s.remain != null && s.remain <= 3 && s.status !== "finished" && s.status !== "dropped")).sort((a, b) => (a.remain ?? 99) - (b.remain ?? 99)).slice(0, 6);
  const maxFlow = Math.max(1, ...flow.flatMap((f) => [f.income, f.expense]));

  const Stat = ({ icon: I, label, value, href, tone = "bg-orange-100 text-orange-700", valueTone = "" }: { icon: typeof Users; label: string; value: React.ReactNode; href: string; tone?: string; valueTone?: string }) => (
    <Link href={href}>
      <Card className="flex h-full items-center gap-3 p-4 transition-colors hover:border-orange-400">
        <span className={`grid size-11 shrink-0 place-items-center rounded-lg ${tone}`}><I className="size-5" /></span>
        <div className="min-w-0"><div className="truncate text-xs text-slate-500">{label}</div><div className={`truncate text-2xl font-bold leading-tight ${valueTone}`}>{value}</div></div>
      </Card>
    </Link>
  );

  return (
    <div className="space-y-4">
      <Title>Tổng quan</Title>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat icon={Users} label="Học viên đang học" value={cnt("learning") + cnt("ending") + cnt("makeup")} href="/hoc-vien?tab=learning" />
        <Stat icon={Hourglass} label="Chờ xếp lớp" value={cnt("waiting")} href="/hoc-vien?tab=waiting" tone="bg-sky-100 text-sky-700" />
        <Stat icon={BookOpen} label="Lớp đang mở" value={activeClasses} href="/lop-hoc" tone="bg-green-100 text-green-700" />
        <Stat icon={Wallet} label="Công nợ" value={short(owed)} href="/tai-chinh?tab=debt" tone="bg-red-100 text-red-600" valueTone="text-red-600" />
        <Stat icon={AlertTriangle} label="Phiếu quá hạn" value={overdueCount} href="/tai-chinh?tab=debt" tone="bg-red-100 text-red-600" valueTone="text-red-600" />
        <Stat icon={RotateCcw} label="Nghỉ chưa xếp bù" value={cnt("makeup")} href="/hoc-vien?tab=makeup" tone="bg-yellow-100 text-yellow-700" valueTone="text-yellow-700" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {todayCard}

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

async function Portal({ meId, role }: { meId: string; role: string }) {
  const kids = role === "STUDENT"
    ? await db.student.findMany({ where: { userId: meId } })
    : await db.student.findMany({ where: { parent: { userId: meId } } });
  return (
    <div className="space-y-8">
      {kids.map((k) => (
        <div key={k.id} className="space-y-3">
          <Title>{k.fullName} <span className="text-sm font-normal text-gray-500">{k.code}</span></Title>
          <StudentOverview studentId={k.id} invoiceBase="/hoa-don" />
        </div>
      ))}
      {!kids.length && <p className="text-gray-500">Chưa có học viên liên kết với tài khoản này.</p>}
    </div>
  );
}
