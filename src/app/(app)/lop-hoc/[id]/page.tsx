import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarCheck, CalendarClock, MoreHorizontal, Percent, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { DialogButton } from "@/components/dialog";
import { Card, Field, inputCls, Table, Tabs } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { WEEKDAYS, fmtDate, fmtMoney, roomLabel } from "@/lib/format";
import { computeTotal, rankOf } from "@/lib/grade";
import { findConflicts } from "@/server/schedule";
import { ClassFormFields } from "../class-fields";
import { cancelSession, deleteClass, enrollStudent, setEnrollment, transferStudent, updateClass, updateSchedule } from "../actions";
import { classAccounts } from "../../hoc-vien/actions";
import { ImportStudents } from "./import-students";

const TABS = [["overview", "Tổng quan"], ["students", "Học viên"], ["sessions", "Buổi học"], ["grades", "Bảng điểm"], ["settings", "Thông tin"]] as const;
const EN = { ACTIVE: "Đang học", PAUSED: "Bảo lưu", FINISHED: "Hết/chuyển", WAITING: "Chờ", DROPPED: "Nghỉ" } as const;
const SS = { PLANNED: "Chưa dạy", DONE: "Đã dạy", CANCELLED: "Nghỉ" } as const;
const menuForm = "flex flex-col items-stretch gap-1 [&>button]:w-full [&>button]:justify-self-stretch";

export default async function ClassDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; page?: string; size?: string }> }) {
  const me = await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "overview";
  const pg = getPaging(sp, 15);

  const c = await db.class.findUnique({ where: { id }, include: { schedules: true, gradeTemplate: { include: { columns: { orderBy: { order: "asc" } } } }, teacher: true, assistant: true, coordinator: true, room: { include: { branch: true } }, course: true } });
  if (!c) notFound();

  const [activeCount, enrollTotal, done, planned, conflicts] = await Promise.all([
    db.enrollment.count({ where: { classId: id, status: "ACTIVE" } }),
    db.enrollment.count({ where: { classId: id } }),
    db.session.count({ where: { classId: id, status: "DONE" } }),
    db.session.count({ where: { classId: id, status: "PLANNED" } }),
    findConflicts(id),
  ]);
  const pct = Math.min(100, Math.round((done / Math.max(c.totalSessions, 1)) * 100));
  const base = `/lop-hoc/${id}`;
  const scheduleText = c.schedules.map((s) => `${WEEKDAYS[s.weekday]} ${s.startTime}-${s.endTime}`).join(" • ");

  const Stat = ({ icon: I, label, value, tone = "bg-orange-100 text-orange-700" }: { icon: typeof Users; label: string; value: React.ReactNode; tone?: string }) => (
    <Card className="flex items-center gap-3 p-4">
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone}`}><I className="size-5" /></span>
      <div className="min-w-0"><div className="truncate text-xs text-slate-500">{label}</div><div className="truncate text-xl font-bold">{value}</div></div>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* ===== Đầu trang ===== */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{c.name}</h1>
              {c.finished ? <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">Đã kết thúc</span> : <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Đang mở</span>}
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c.mode === "ONLINE" ? "Online" : "Offline"}</span>
            </div>
            <div className="mt-1 space-y-0.5 text-sm text-slate-600">
              <div>{scheduleText || "Chưa có lịch"}</div>
              <div>{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:flex sm:flex-wrap sm:gap-x-6">
              {([["Giáo viên", c.teacher?.fullName], ["Trợ giảng", c.assistant?.fullName], ["Giáo vụ", c.coordinator?.fullName], ["Phòng", roomLabel(c.room)]] as const).map(([k, v]) => (
                <div key={k} className="min-w-0"><dt className="text-[11px] uppercase tracking-wide text-slate-500">{k}</dt><dd className="truncate font-medium">{v ?? "-"}</dd></div>
              ))}
            </dl>
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto md:flex-wrap">
            <div className="hidden md:block">
              <DialogButton wide variant="secondary" label="Nhập danh sách học viên" title="Nhập danh sách học viên & cấp tài khoản">
                <ImportStudents classId={id} />
              </DialogButton>
            </div>
            <div className="min-w-0 flex-1 md:flex-none [&>button]:w-full md:[&>button]:w-auto">
              <DialogButton label="+ Ghi danh học viên" title="Ghi danh học viên vào lớp">
                <EnrollForm classId={id} />
              </DialogButton>
            </div>
            {c.gradeTemplate && <Link href={`${base}/diem`} className="hidden h-9 items-center rounded-md border bg-white px-3 text-sm hover:bg-slate-50 md:inline-flex">Nhập điểm</Link>}
            <Link href="/lop-hoc" className="hidden h-9 items-center rounded-md border bg-white px-3 text-sm hover:bg-slate-50 md:inline-flex">← Danh sách</Link>
            <details className="relative">
              <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1 rounded-md border bg-white px-3 text-sm hover:bg-slate-50"><MoreHorizontal className="size-4" /> Khác</summary>
              <div className="absolute right-0 z-20 mt-1 w-[min(18rem,calc(100vw-3rem))] space-y-1 rounded-md border bg-white p-2 shadow-lg">
                {/* Điện thoại: các thao tác phụ gom vào menu này cho gọn */}
                <div className="space-y-1 md:hidden">
                  <div className="[&>button]:w-full"><DialogButton wide variant="secondary" label="Nhập danh sách học viên" title="Nhập danh sách học viên & cấp tài khoản"><ImportStudents classId={id} /></DialogButton></div>
                  {c.gradeTemplate && <Link href={`${base}/diem`} className="block rounded-md border px-3 py-2 text-center text-sm hover:bg-slate-50">Nhập điểm</Link>}
                  <Link href="/lop-hoc" className="block rounded-md border px-3 py-2 text-center text-sm hover:bg-slate-50">← Danh sách lớp</Link>
                </div>
                <ActionForm action={classAccounts} submit="Cấp lại mật khẩu cả lớp (để in)" block reset={false} className={menuForm}><input type="hidden" name="classId" value={id} /></ActionForm>
                {c.gradeTemplate && <a href={`/api/export/grades?classId=${id}`} className="block rounded-md border px-3 py-2 text-center text-sm hover:bg-slate-50">Xuất bảng điểm (Excel)</a>}
                {me.role === "ADMIN" && <ActionForm action={deleteClass} submit="Xoá lớp" block danger confirmText="Xoá hẳn lớp này?" className={menuForm}><input type="hidden" name="id" value={id} /></ActionForm>}
              </div>
            </details>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-2 rounded-full bg-orange-500" style={{ width: `${pct}%` }} /></div>
          <span className="shrink-0 text-slate-500">Đã dạy {done}/{c.totalSessions} buổi ({pct}%)</span>
        </div>
        {conflicts.length > 0 && <div className="flex gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-600"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div>{conflicts.map((x) => <div key={x}>{x}</div>)}</div></div>}
      </Card>

      <Tabs current={`?tab=${tab}`} items={TABS.map(([k, l]) => [`?tab=${k}`, l] as [string, string])} />

      {/* ===== Tổng quan ===== */}
      {tab === "overview" && await (async () => {
        const [upcoming, att, ending] = await Promise.all([
          db.session.findMany({ where: { classId: id, status: "PLANNED", date: { gte: new Date(Date.now() - 86400000) } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 5 }),
          db.attendance.groupBy({ by: ["status"], where: { session: { classId: id }, status: { not: "PENDING" } }, _count: true }),
          db.enrollment.findMany({ where: { classId: id, status: "ACTIVE" }, include: { student: true } }),
        ]);
        const total = att.reduce((n, a) => n + a._count, 0);
        const present = att.filter((a) => ["PRESENT", "LATE"].includes(a.status)).reduce((n, a) => n + a._count, 0);
        const soon = ending.filter((e) => e.totalSessions - e.usedSessions <= 3).sort((a, b) => (a.totalSessions - a.usedSessions) - (b.totalSessions - b.usedSessions)).slice(0, 6);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Stat icon={Users} label="Học viên đang học" value={`${activeCount}/${c.maxStudents}`} />
              <Stat icon={CalendarCheck} label="Đã dạy" value={`${done}/${c.totalSessions}`} tone="bg-green-100 text-green-700" />
              <Stat icon={CalendarClock} label="Buổi còn lại" value={planned} tone="bg-sky-100 text-sky-700" />
              <Stat icon={Percent} label="Chuyên cần" value={total ? `${Math.round((present / total) * 100)}%` : "-"} tone="bg-yellow-100 text-yellow-700" />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="p-0 xl:col-span-2">
                <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Buổi học sắp tới</h2><Link href="?tab=sessions" className="text-sm text-orange-700 hover:underline">Xem tất cả →</Link></div>
                <ul className="divide-y text-sm">
                  {upcoming.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                      <span><b>{WEEKDAYS[s.date.getUTCDay()]}, {fmtDate(s.date)}</b> · {s.startTime}-{s.endTime}</span>
                      <Link href={`/diem-danh/${s.id}`} className="text-orange-700 hover:underline">Điểm danh</Link>
                    </li>
                  ))}
                  {!upcoming.length && <li className="px-4 py-8 text-center text-slate-500">Không còn buổi nào sắp tới.</li>}
                </ul>
              </Card>
              <div className="space-y-4">
                <Card className="space-y-1.5 text-sm">
                  <h2 className="font-semibold">Thông tin chung</h2>
                  <div className="flex justify-between"><span className="text-slate-500">Học phí khoá</span><b>{fmtMoney(c.tuitionFee)}{c.billing === "MONTHLY" ? "/tháng" : ""}</b></div>
                  <div className="flex justify-between"><span className="text-slate-500">Bộ điểm</span><b>{c.gradeTemplate?.name ?? "chưa chọn"}</b></div>
                  <div className="flex justify-between"><span className="text-slate-500">Tổng ghi danh</span><b>{enrollTotal}</b></div>
                </Card>
                <Card className="p-0">
                  <div className="border-b px-4 py-3"><h2 className="font-semibold">Sắp hết khoá</h2></div>
                  <ul className="divide-y text-sm">
                    {soon.map((e) => <li key={e.id} className="flex items-center justify-between px-4 py-2.5"><Link href={`/hoc-vien/${e.studentId}`} className="hover:text-orange-700">{e.student.fullName}</Link><span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">còn {e.totalSessions - e.usedSessions} buổi</span></li>)}
                    {!soon.length && <li className="px-4 py-6 text-center text-slate-500">Chưa có học viên sắp hết khoá.</li>}
                  </ul>
                </Card>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== Học viên ===== */}
      {tab === "students" && await (async () => {
        const [list, others] = await Promise.all([
          db.enrollment.findMany({ where: { classId: id }, include: { student: { include: { parent: true } } }, orderBy: [{ status: "asc" }, { student: { fullName: "asc" } }], skip: pg.skip, take: pg.take }),
          db.class.findMany({ where: { finished: false, id: { not: id }, courseId: c.courseId ?? "none" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
        ]);
        return (
          <div className="space-y-3">
            <div className="space-y-2 md:hidden">
              {list.map((e) => {
                const left = e.totalSessions - e.usedSessions;
                const pct = Math.min(100, Math.round((e.usedSessions / Math.max(e.totalSessions, 1)) * 100));
                const hue = [...e.studentId].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 0);
                const dot = e.status === "ACTIVE" ? "bg-green-500" : e.status === "PAUSED" ? "bg-yellow-400" : "bg-slate-400";
                const text = e.status === "ACTIVE" ? "text-green-700" : e.status === "PAUSED" ? "text-yellow-700" : "text-slate-500";
                return (
                  <div key={e.id} className={`rounded-xl border bg-white p-3 ${e.status === "DROPPED" ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: `hsl(${hue} 70% 90%)`, color: `hsl(${hue} 60% 25%)` }}>{e.student.fullName.split(" ").pop()?.[0]}</span>
                      <div className="min-w-0 flex-1">
                        <Link className="block truncate font-semibold hover:text-orange-700" href={`/hoc-vien/${e.studentId}`}>{e.student.fullName}</Link>
                        <div className="truncate text-xs text-slate-500">{e.student.code}{e.student.phone ? ` · ${e.student.phone}` : ""}</div>
                      </div>
                      <span className={`flex shrink-0 items-center gap-1.5 text-xs font-semibold ${text}`}><i className={`inline-block size-2 rounded-full ${dot}`} />{EN[e.status]}</span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} /></div>
                      <span className="shrink-0 text-xs tabular-nums text-slate-600">{e.usedSessions}/{e.totalSessions}{e.status === "ACTIVE" && left <= 3 ? ` · còn ${Math.max(left, 0)}` : ""}</span>
                    </div>
                    {e.student.parent && <div className="mt-1.5 truncate text-xs text-slate-500">PH: {e.student.parent.fullName}{e.student.parent.phone ? ` · ${e.student.parent.phone}` : ""}</div>}
                    {e.status === "ACTIVE" && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <DialogButton variant="secondary" block label="Đổi lớp" title={`Đổi lớp · ${e.student.fullName}`}>
                          <ActionForm action={transferStudent} submit="Chuyển lớp" className="flex flex-col gap-3 [&>button]:self-start">
                            <input type="hidden" name="id" value={e.id} />
                            <p className="text-sm text-slate-600">Giữ nguyên số buổi còn lại ({Math.max(left, 0)} buổi). Chỉ chuyển được sang lớp cùng khoá{c.course ? ` "${c.course.name}"` : ""}.</p>
                            <Field label="Chuyển sang lớp"><select name="toClassId" className={inputCls + " w-full"}><option value="">-- chọn lớp --</option>{others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>{!others.length && <span className="text-xs text-red-600">Không có lớp nào khác cùng khoá.</span>}</Field>
                          </ActionForm>
                        </DialogButton>
                        <ActionForm action={setEnrollment} submit="Bảo lưu" block className="contents"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="PAUSED" /></ActionForm>
                        <ActionForm action={setEnrollment} submit="Cho nghỉ" block danger confirmText="Cho học viên nghỉ lớp này?" className="contents"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="DROPPED" /></ActionForm>
                      </div>
                    )}
                    {e.status === "PAUSED" && <div className="mt-3"><ActionForm action={setEnrollment} submit="Học lại" block className="contents"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="ACTIVE" /></ActionForm></div>}
                  </div>
                );
              })}
              {!list.length && <p className="rounded-lg border bg-white py-8 text-center text-sm text-slate-500">Lớp chưa có học viên.</p>}
            </div>
            <div className="hidden md:block">            <Table head={["Học viên", "Trạng thái", "Tiến độ", "Phụ huynh", "Thao tác"]}>
              {list.map((e) => {
                const left = e.totalSessions - e.usedSessions;
                const pct = Math.min(100, Math.round((e.usedSessions / Math.max(e.totalSessions, 1)) * 100));
                const hue = [...e.studentId].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 0);
                const dot = e.status === "ACTIVE" ? "bg-green-500" : e.status === "PAUSED" ? "bg-yellow-400" : "bg-slate-400";
                const text = e.status === "ACTIVE" ? "text-green-700" : e.status === "PAUSED" ? "text-yellow-700" : "text-slate-500";
                return (
                  <tr key={e.id} className={`align-middle [&>td]:!py-3 ${e.status === "DROPPED" ? "opacity-60" : ""}`}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: `hsl(${hue} 70% 90%)`, color: `hsl(${hue} 60% 25%)` }}>{e.student.fullName.split(" ").pop()?.[0]}</span>
                        <div className="min-w-0">
                          <Link data-row className="block truncate font-semibold hover:text-orange-700" href={`/hoc-vien/${e.studentId}`}>{e.student.fullName}</Link>
                          <div className="truncate text-xs text-slate-500">{e.student.code}{e.student.phone ? ` · ${e.student.phone}` : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={`flex items-center gap-2 text-sm font-semibold ${text}`}><i className={`inline-block size-2 rounded-full ${dot}`} />{EN[e.status]}</div>
                      {e.status === "ACTIVE" && left <= 3 && <div className="mt-0.5 pl-4 text-xs text-yellow-700">Sắp hết · còn {Math.max(left, 0)} buổi</div>}
                    </td>
                    <td className="min-w-40">
                      <div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} /></div><span className="whitespace-nowrap text-xs tabular-nums text-slate-600">{e.usedSessions}/{e.totalSessions}</span></div>
                    </td>
                    <td>{e.student.parent ? <><div className="truncate text-sm">{e.student.parent.fullName}</div><div className="text-xs text-slate-500">{e.student.parent.phone}</div></> : <span className="text-slate-400">—</span>}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1">
                        {e.status === "ACTIVE" && (
                          <>
                            <DialogButton variant="secondary" size="sm" label="Đổi lớp" title={`Đổi lớp · ${e.student.fullName}`}>
                              <ActionForm action={transferStudent} submit="Chuyển lớp" className="flex flex-col gap-3 [&>button]:self-start">
                                <input type="hidden" name="id" value={e.id} />
                                <p className="text-sm text-slate-600">Giữ nguyên số buổi còn lại ({Math.max(left, 0)} buổi). Chỉ chuyển được sang lớp cùng khoá{c.course ? ` "${c.course.name}"` : ""}.</p>
                                <Field label="Chuyển sang lớp"><select name="toClassId" className={inputCls + " w-full"}><option value="">-- chọn lớp --</option>{others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>{!others.length && <span className="text-xs text-red-600">Không có lớp nào khác cùng khoá.</span>}</Field>
                              </ActionForm>
                            </DialogButton>
                            <ActionForm action={setEnrollment} submit="Bảo lưu" compact ghost className="inline-flex"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="PAUSED" /></ActionForm>
                            <ActionForm action={setEnrollment} submit="Cho nghỉ" compact ghost danger confirmText="Cho học viên nghỉ lớp này?" className="inline-flex"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="DROPPED" /></ActionForm>
                          </>
                        )}
                        {e.status === "PAUSED" && <ActionForm action={setEnrollment} submit="Học lại" compact ghost className="inline-flex"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="ACTIVE" /></ActionForm>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!list.length && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Lớp chưa có học viên.</td></tr>}
            </Table></div>
            <Pagination total={enrollTotal} page={pg.page} size={pg.size} path={base} params={{ tab: "students", size: sp.size }} />
          </div>
        );
      })()}

      {/* ===== Buổi học ===== */}
      {tab === "sessions" && await (async () => {
        const [sessTotal, list] = await Promise.all([db.session.count({ where: { classId: id } }), db.session.findMany({ where: { classId: id }, orderBy: [{ date: "asc" }, { startTime: "asc" }], skip: pg.skip, take: pg.take })]);
        const todayStr = new Date().toISOString().slice(0, 10);
        return (
          <div className="space-y-3">
            <Table head={["Ngày", "Giờ", "Trạng thái", "", ""]}>
              {list.map((s) => (
                <tr key={s.id} className={s.status === "CANCELLED" ? "text-slate-400 line-through" : s.date.toISOString().slice(0, 10) === todayStr ? "bg-orange-50" : ""}>
                  <td className="whitespace-nowrap">{WEEKDAYS[s.date.getUTCDay()]}, {fmtDate(s.date)}</td>
                  <td className="whitespace-nowrap">{s.startTime}-{s.endTime}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-xs no-underline ${s.status === "DONE" ? "bg-green-100 text-green-800" : s.status === "CANCELLED" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}>{SS[s.status]}</span> {s.note && <span className="text-xs">({s.note})</span>}</td>
                  <td>{s.status !== "CANCELLED" && <Link className="text-orange-700 hover:underline" href={`/diem-danh/${s.id}`}>Điểm danh</Link>}</td>
                  <td>{s.status === "PLANNED" && <ActionForm action={cancelSession} submit="Cho nghỉ" compact danger confirmText="Cho lớp nghỉ buổi này?" className="inline-flex"><input type="hidden" name="id" value={s.id} /></ActionForm>}</td>
                </tr>
              ))}
            </Table>
            <Pagination total={sessTotal} page={pg.page} size={pg.size} path={base} params={{ tab: "sessions", size: sp.size }} />
          </div>
        );
      })()}

      {/* ===== Bảng điểm ===== */}
      {tab === "grades" && await (async () => {
        if (!c.gradeTemplate) return <Card className="text-sm text-slate-600">Lớp chưa có bộ điểm. Vào tab <Link className="text-orange-700 underline" href="?tab=settings">Thông tin & Lịch</Link> để chọn bộ điểm.</Card>;
        const t = c.gradeTemplate;
        const [list, values] = await Promise.all([
          db.enrollment.findMany({ where: { classId: id, status: { in: ["ACTIVE", "PAUSED", "FINISHED"] } }, include: { student: true }, orderBy: { student: { fullName: "asc" } }, skip: pg.skip, take: pg.take }),
          db.gradeValue.findMany({ where: { classId: id } }),
        ]);
        const cols = t.columns.map((x) => ({ id: x.id, name: x.name, key: x.key, weight: x.weight, maxScore: x.maxScore }));
        return (
          <div className="space-y-3">
            <Card className="flex flex-wrap items-center gap-3 text-sm">
              <span>Bộ điểm: <b>{t.name}</b></span><span className="text-slate-500">Tổng: <code>{t.formula.trim() || "trung bình theo trọng số"}</code></span>
              <Link href={`${base}/diem`} className="ml-auto inline-flex h-9 items-center rounded-md bg-orange-600 px-4 font-medium text-white hover:bg-orange-700">Nhập / sửa điểm</Link>
            </Card>
            <Table head={["Học viên", ...cols.map((x) => x.name), "Tổng", "Xếp loại"]}>
              {list.map((e) => {
                const v: Record<string, number> = {};
                for (const g of values.filter((g) => g.studentId === e.studentId)) v[g.columnId] = g.value;
                const total = computeTotal(t, cols, v);
                return (
                  <tr key={e.id}>
                    <td><Link data-row href={`/hoc-vien/${e.studentId}?tab=grades`} className="text-orange-700 hover:underline">{e.student.fullName}</Link></td>
                    {cols.map((x) => <td key={x.id}>{v[x.id] ?? "-"}</td>)}
                    <td className="font-bold">{total ?? "-"}</td><td>{rankOf(total, t.ranks)}</td>
                  </tr>
                );
              })}
            </Table>
            <Pagination total={enrollTotal} page={pg.page} size={pg.size} path={base} params={{ tab: "grades", size: sp.size }} />
          </div>
        );
      })()}

      {/* ===== Thông tin & Lịch ===== */}
      {tab === "settings" && await (async () => {
        const [teachers, assistants, coordinators, rooms, templates, courses, branches] = await Promise.all([
          db.teacher.findMany({ orderBy: { fullName: "asc" } }), db.assistant.findMany({ orderBy: { fullName: "asc" } }), db.coordinator.findMany({ orderBy: { fullName: "asc" } }), db.room.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, branchId: true, capacity: true } }), db.gradeTemplate.findMany({ orderBy: { name: "asc" } }), db.course.findMany({ orderBy: { name: "asc" } }), db.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        ]);
        const sched = c.schedules[0];
        return (
          <div className="space-y-4">
            <Card>
              <h2 className="mb-3 font-semibold">Thông tin lớp</h2>
              <ActionForm action={updateClass} submit="Lưu thông tin lớp" reset={false} className="flex flex-col gap-4 [&>button]:self-start">
                <input type="hidden" name="id" value={c.id} />
                <ClassFormFields edit withSchedule={false} showRate={me.role === "ADMIN"} teachers={teachers} assistants={assistants} coordinators={coordinators} rooms={rooms} branches={branches} templates={templates} courses={courses}
                  defaults={{ name: c.name, mode: c.mode, teacherId: c.teacherId, assistantId: c.assistantId, coordinatorId: c.coordinatorId, billing: c.billing, teacherRate: c.teacherRate, roomId: c.roomId, maxStudents: c.maxStudents, tuitionFee: c.tuitionFee, finished: c.finished, gradeTemplateId: c.gradeTemplateId, courseId: c.courseId }} />
              </ActionForm>
            </Card>
            <Card>
              <h2 className="mb-1 font-semibold">Lịch học</h2>
              <p className="mb-3 text-sm text-slate-500">Đổi lịch sẽ sinh lại các buổi chưa dạy; các buổi đã dạy được giữ nguyên.</p>
              <ActionForm action={updateSchedule} submit="Lưu lịch học" reset={false} className="flex flex-col gap-4 [&>button]:self-start">
                <input type="hidden" name="id" value={c.id} />
                <ClassFormFields edit scheduleOnly teachers={[]} rooms={[]} defaults={{ days: c.schedules.map((s) => s.weekday), startTime: sched?.startTime, endTime: sched?.endTime }} />
              </ActionForm>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}

async function EnrollForm({ classId }: { classId: string }) {
  const enrolled = await db.enrollment.findMany({ where: { classId, status: { in: ["ACTIVE", "PAUSED"] } }, select: { studentId: true } });
  const students = await db.student.findMany({ where: { dropped: false, id: { notIn: enrolled.map((e) => e.studentId) } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, code: true }, take: 600 });
  return (
    <ActionForm action={enrollStudent} submit="Ghi danh" className="flex flex-col gap-3 [&>button]:self-start">
      <input type="hidden" name="classId" value={classId} />
      <Field label="Học viên">
        <select name="studentId" className={inputCls + " w-full"}>
          <option value="">-- chọn --</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.fullName} ({s.code})</option>)}
        </select>
      </Field>
    </ActionForm>
  );
}
