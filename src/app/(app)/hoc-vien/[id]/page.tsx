import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, CalendarCheck, GraduationCap, MoreHorizontal, Phone, School, UserRound, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { DialogButton } from "@/components/dialog";
import { Card, inputCls, Tabs } from "@/components/ui";
import { StudentFields } from "@/components/person-fields";
import { StudentOverview } from "@/components/student-overview";
import { loadStudents, STATUS_COLOR, STATUS_LABEL } from "@/server/status";
import { fmtDate, fmtMoney, todayUTC, WEEKDAYS } from "@/lib/format";
import { getPaging } from "@/lib/paging";
import { deleteStudent, resetStudentPassword, toggleDropped, updateStudent } from "../actions";
import { arrangeMakeup } from "../../diem-danh/actions";
import { addRemark } from "../../hoc-tap/actions";

const TABS_STAFF = [["overview", "Tổng quan"], ["info", "Thông tin cá nhân"], ["classes", "Lớp & Lịch học"], ["attendance", "Điểm danh"], ["grades", "Bảng điểm & Nhận xét"], ["fees", "Học phí"]] as const;
const TABS_TEACHER = [["overview", "Tổng quan"], ["classes", "Lớp & Lịch học"], ["attendance", "Điểm danh"], ["grades", "Bảng điểm & Nhận xét"]] as const;

export default async function StudentDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; ap?: string; size?: string }> }) {
  const me = await requireRole(...STAFF_ROLES, "TEACHER");
  const { id } = await params;
  const sp = await searchParams;
  const staff = me.role !== "TEACHER";
  const tabs = staff ? TABS_STAFF : TABS_TEACHER;
  const tab = tabs.some(([k]) => k === sp.tab) ? sp.tab! : "overview";

  const s = await db.student.findUnique({ where: { id }, include: { parent: true, user: true } });
  if (!s) notFound();
  if (me.role === "TEACHER") {
    const ok = await db.enrollment.count({ where: { studentId: id, class: { OR: [{ teacher: { userId: me.id } }, { assistant: { userId: me.id } }] } } });
    if (!ok) notFound();
  }
  const [row] = await loadStudents({ id });

  const [enrollments, attStats, invoices, pending, remarks] = await Promise.all([
    db.enrollment.findMany({ where: { studentId: id, status: { in: ["ACTIVE", "PAUSED"] } }, include: { class: { include: { teacher: true, schedules: true } } } }),
    db.attendance.groupBy({ by: ["status"], where: { studentId: id, status: { not: "PENDING" } }, _count: true }),
    staff ? db.invoice.findMany({ where: { studentId: id, status: { in: ["UNPAID", "PARTIAL"] } } }) : Promise.resolve([]),
    staff ? db.attendance.findMany({ where: { studentId: id, status: "ABSENT_EXCUSED", makeupDone: false }, include: { session: { include: { class: true } } } }) : Promise.resolve([]),
    db.remark.findMany({ where: { studentId: id }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  const totalAtt = attStats.reduce((n, a) => n + a._count, 0);
  const present = attStats.filter((a) => ["PRESENT", "LATE"].includes(a.status)).reduce((n, a) => n + a._count, 0);
  const rate = totalAtt ? Math.round((present / totalAtt) * 100) : null;
  const debt = invoices.reduce((n, i) => n + i.total - i.paid, 0);
  const remain = row.remain;
  const upcoming = pending.length ? await db.session.findMany({ where: { status: "PLANNED", date: { gte: todayUTC() } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 300, include: { class: true } }) : [];
  const ap = getPaging({ size: sp.size, page: sp.ap }, 15);

  const Stat = ({ icon: I, label, value, tone = "bg-orange-100 text-orange-700", vt = "" }: { icon: typeof Phone; label: string; value: React.ReactNode; tone?: string; vt?: string }) => (
    <Card className="flex items-center gap-3 p-4">
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone}`}><I className="size-5" /></span>
      <div className="min-w-0"><div className="truncate text-xs text-slate-500">{label}</div><div className={`truncate text-xl font-bold ${vt}`}>{value}</div></div>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* ===== Đầu trang: hồ sơ tóm tắt + thao tác ===== */}
      <Card className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {s.avatarUrl ? <img src={s.avatarUrl} alt="" className="size-16 rounded-full object-cover" /> : <span className="grid size-16 shrink-0 place-items-center rounded-full bg-orange-100 text-2xl font-bold text-orange-700">{s.fullName.split(" ").pop()?.[0]}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{s.fullName}</h1>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{s.code}</span>
            <span className={`text-sm font-medium ${STATUS_COLOR[row.status]}`}>{STATUS_LABEL[row.status]}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {s.gradeLevel && <span className="flex items-center gap-1"><GraduationCap className="size-4" />{s.gradeLevel}{s.school ? ` · ${s.school}` : ""}</span>}
            {s.phone && <span className="flex items-center gap-1"><Phone className="size-4" />{s.phone}</span>}
            {s.parent && <span className="flex items-center gap-1"><UserRound className="size-4" />{s.parent.relation ?? "PH"}: {s.parent.fullName} · {s.parent.phone}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DialogButton label="+ Viết nhận xét" title={`Nhận xét · ${s.fullName}`}>
            <ActionForm action={addRemark} submit="Gửi nhận xét" className="flex flex-col gap-3 [&>button]:self-start">
              <input type="hidden" name="studentId" value={s.id} />
              <textarea name="content" rows={4} className="w-full rounded-md border bg-white px-3 py-2 text-sm" placeholder="Nhận xét về học viên (phụ huynh sẽ nhận được thông báo)" />
            </ActionForm>
          </DialogButton>
          {staff && (
            <>
              <Link href={`/hoc-vien/${s.id}/in-lich`} target="_blank" className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm hover:bg-slate-50">In lịch học</Link>
              <details className="relative">
                <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1 rounded-md border bg-white px-3 text-sm hover:bg-slate-50"><MoreHorizontal className="size-4" /> Khác</summary>
                <div className="absolute right-0 z-20 mt-1 w-56 space-y-1 rounded-md border bg-white p-2 shadow-lg">
                  <ActionForm action={resetStudentPassword} submit="Cấp lại mật khẩu" reset={false} className="flex flex-col items-stretch gap-1 [&>button]:w-full [&>button]:justify-self-stretch" ><input type="hidden" name="id" value={s.id} /></ActionForm>
                  <ActionForm action={toggleDropped} submit={s.dropped ? "Cho học lại" : "Cho nghỉ học"} danger={!s.dropped} confirmText="Xác nhận?" className="flex flex-col items-stretch gap-1 [&>button]:w-full [&>button]:justify-self-stretch"><input type="hidden" name="id" value={s.id} /></ActionForm>
                  {me.role === "ADMIN" && <ActionForm action={deleteStudent} submit="Xoá học viên" danger confirmText="Xoá học viên?" className="flex flex-col items-stretch gap-1 [&>button]:w-full [&>button]:justify-self-stretch"><input type="hidden" name="id" value={s.id} /></ActionForm>}
                </div>
              </details>
            </>
          )}
        </div>
      </Card>

      <Tabs current={`?tab=${tab}`} items={tabs.map(([k, l]) => [`?tab=${k}`, l] as [string, string])} />

      {/* ===== Tổng quan ===== */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat icon={School} label="Lớp đang học" value={enrollments.filter((e) => e.status === "ACTIVE").length} />
            <Stat icon={CalendarCheck} label="Số buổi còn lại" value={remain != null ? remain : "-"} tone="bg-sky-100 text-sky-700" />
            <Stat icon={AlertCircle} label="Chuyên cần" value={rate != null ? `${rate}%` : "-"} tone="bg-green-100 text-green-700" vt={rate != null && rate < 80 ? "text-red-600" : ""} />
            {staff && <Stat icon={Wallet} label="Còn nợ học phí" value={fmtMoney(debt)} tone="bg-red-100 text-red-600" vt={debt ? "text-red-600" : ""} />}
          </div>

          {pending.length > 0 && (
            <Card className="border-red-300">
              <h2 className="mb-2 font-semibold">Buổi nghỉ chưa xếp bù ({pending.length})</h2>
              <div className="space-y-2">
                {pending.map((p) => (
                  <ActionForm key={p.id} action={arrangeMakeup} submit="Xếp bù" className="flex flex-wrap items-center gap-2 text-sm">
                    <input type="hidden" name="absentId" value={p.id} />
                    <span className="min-w-52">{p.session.class.name} · {fmtDate(p.session.date)} →</span>
                    <select name="sessionId" className={inputCls + " min-w-64"}>
                      <option value="">chọn buổi học bù...</option>
                      {upcoming.filter((u) => u.class.courseId && u.class.courseId === p.session.class.courseId).map((u) => <option key={u.id} value={u.id}>{fmtDate(u.date)} {u.startTime} · {u.class.name}</option>)}
                    </select>
                  </ActionForm>
                ))}
              </div>
            </Card>
          )}

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="p-0 xl:col-span-2">
              <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Lớp đang học</h2><Link href="?tab=classes" className="text-sm text-orange-700 hover:underline">Chi tiết →</Link></div>
              <ul className="divide-y">
                {enrollments.map((e) => {
                  const pct = Math.min(100, Math.round((e.usedSessions / Math.max(e.totalSessions, 1)) * 100));
                  return (
                    <li key={e.id} className="space-y-1.5 px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2"><b>{e.class.name}</b><span className="text-slate-500">{e.class.teacher?.fullName ?? "-"} · {e.class.schedules.map((x) => `${WEEKDAYS[x.weekday]} ${x.startTime}`).join(", ")}</span></div>
                      <div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-2 rounded-full bg-orange-500" style={{ width: `${pct}%` }} /></div><span className="w-24 text-right text-xs text-slate-500">{e.usedSessions}/{e.totalSessions} buổi</span></div>
                    </li>
                  );
                })}
                {!enrollments.length && <li className="px-4 py-8 text-center text-sm text-slate-500">Chưa có lớp nào.</li>}
              </ul>
            </Card>
            <Card className="p-0">
              <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Nhận xét gần đây</h2><Link href="?tab=grades" className="text-sm text-orange-700 hover:underline">Xem →</Link></div>
              <ul className="divide-y text-sm">
                {remarks.map((r) => <li key={r.id} className="px-4 py-3"><div className="text-xs text-slate-500">{fmtDate(r.createdAt)} · {r.author}</div><div>{r.content}</div></li>)}
                {!remarks.length && <li className="px-4 py-8 text-center text-slate-500">Chưa có nhận xét.</li>}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* ===== Thông tin cá nhân ===== */}
      {tab === "info" && staff && (
        <ActionForm action={updateStudent} submit="Lưu thông tin" reset={false} className="flex flex-col gap-4 [&>button]:self-start">
          <input type="hidden" name="id" value={s.id} />
          <StudentFields s={s} p={s.parent ?? {}} />
          <div className="text-xs text-slate-500">Tài khoản đăng nhập: <b>{s.user?.username ?? "chưa có"}</b></div>
        </ActionForm>
      )}

      {tab === "classes" && <StudentOverview studentId={id} invoiceBase="/tai-chinh" sections={["courses", "calendar"]} />}
      {tab === "attendance" && <StudentOverview studentId={id} invoiceBase="/tai-chinh" sections={["attendance"]} attPaging={{ page: ap.page, size: ap.size, path: `/hoc-vien/${id}`, params: { tab: "attendance", size: sp.size }, pageKey: "ap" }} />}
      {tab === "grades" && <StudentOverview studentId={id} invoiceBase="/tai-chinh" sections={["grades"]} />}
      {tab === "fees" && staff && <StudentOverview studentId={id} invoiceBase="/tai-chinh" sections={["invoices"]} />}
    </div>
  );
}
