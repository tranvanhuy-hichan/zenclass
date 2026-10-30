import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarCheck, Clock, Mail, MoreHorizontal, Phone, Users, Wallet, GraduationCap } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, Table, Tabs } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { TeacherFields } from "@/components/person-fields";
import { getPaging } from "@/lib/paging";
import { WEEKDAYS, addDays, fmtDate, fmtMoney, todayUTC, roomLabel } from "@/lib/format";
import { computePay, monthRange, PAY_LABEL } from "@/server/payroll";
import { deleteTeacher, resetUserPassword, updateTeacher } from "../actions";

const ALL_TABS = [["overview", "Tổng quan"], ["info", "Thông tin cá nhân"], ["classes", "Lớp phụ trách"], ["schedule", "Lịch dạy"], ["pay", "Chấm công & Lương"], ["account", "Tài khoản"]] as const;
const fm = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export default async function TeacherDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; page?: string; size?: string; all?: string }> }) {
  const me = await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const sp = await searchParams;
  const TABS = me.role === "ADMIN" ? ALL_TABS : ALL_TABS.filter(([k]) => k !== "pay"); // chỉ Admin xem lương
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "overview";
  const pg = getPaging(sp, 10);

  const t = await db.teacher.findUnique({ where: { id }, include: { user: true } });
  if (!t) notFound();
  const today = todayUTC();
  const nowVN = new Date(Date.now() + 7 * 3600_000);
  const thisMonth = fm(nowVN);
  const { from, to } = monthRange(thisMonth);
  const mine = { teacherId: id };

  const [activeClasses, studentCount, monthSessions, upcoming5] = await Promise.all([
    db.class.findMany({ where: { ...mine, finished: false }, include: { schedules: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } }, orderBy: { name: "asc" } }),
    db.enrollment.count({ where: { status: "ACTIVE", class: { ...mine, finished: false } } }),
    db.session.findMany({ where: { teacherId: id, status: "DONE", date: { gte: from, lt: to } }, select: { startTime: true, endTime: true, originalTeacherId: true, payAmount: true, class: { select: { teacherRate: true } } } }),
    db.session.findMany({ where: { teacherId: id, status: "PLANNED", date: { gte: today } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 5, include: { class: true, room: { include: { branch: true } } } }),
  ]);
  const pay = computePay(t, monthSessions);

  const Stat = ({ icon: I, label, value, tone = "bg-orange-100 text-orange-700" }: { icon: typeof Users; label: string; value: React.ReactNode; tone?: string }) => (
    <Card className="flex items-center gap-3 p-4">
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone}`}><I className="size-5" /></span>
      <div className="min-w-0"><div className="truncate text-xs text-slate-500">{label}</div><div className="truncate text-xl font-bold">{value}</div></div>
    </Card>
  );
  const menuForm = "flex flex-col items-stretch gap-1 [&>button]:w-full [&>button]:justify-self-stretch";

  return (
    <div className="space-y-4">
      {/* ===== Đầu trang ===== */}
      <Card className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {t.avatarUrl ? <img src={t.avatarUrl} alt="" className="size-16 rounded-full object-cover" /> : <span className="grid size-16 shrink-0 place-items-center rounded-full bg-orange-100 text-2xl font-bold text-orange-700">{t.fullName.split(" ").pop()?.[0]}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{t.fullName}</h1>
            {t.specialty && <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">{t.specialty}</span>}
            {t.user && !t.user.isActive && <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-600">Tài khoản bị khoá</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {t.phone && <span className="flex items-center gap-1"><Phone className="size-4" />{t.phone}</span>}
            {t.email && <span className="flex items-center gap-1"><Mail className="size-4" />{t.email}</span>}
            {t.degree && <span className="flex items-center gap-1"><GraduationCap className="size-4" />{t.degree}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/lich-hoc?teacher=${t.id}`} className="inline-flex h-9 items-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700">Xem lịch dạy</Link>
          <Link href="/giao-vien" className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm hover:bg-slate-50">← Danh sách</Link>
          {me.role === "ADMIN" && (
            <details className="relative">
              <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1 rounded-md border bg-white px-3 text-sm hover:bg-slate-50"><MoreHorizontal className="size-4" /> Khác</summary>
              <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border bg-white p-2 shadow-lg">
                <ActionForm action={deleteTeacher} submit="Xoá giáo viên" danger confirmText="Xoá giáo viên này?" className={menuForm}><input type="hidden" name="id" value={t.id} /></ActionForm>
              </div>
            </details>
          )}
        </div>
      </Card>

      <Tabs current={`?tab=${tab}`} items={TABS.map(([k, l]) => [`?tab=${k}`, l] as [string, string])} />

      {/* ===== Tổng quan ===== */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat icon={BookOpen} label="Lớp đang phụ trách" value={activeClasses.length} />
            <Stat icon={Users} label="Học viên đang dạy" value={studentCount} tone="bg-sky-100 text-sky-700" />
            <Stat icon={CalendarCheck} label={`Buổi dạy tháng ${nowVN.getUTCMonth() + 1}`} value={pay.sessions} tone="bg-green-100 text-green-700" />
            {me.role === "ADMIN" && <Stat icon={Wallet} label="Lương tạm tính tháng này" value={fmtMoney(pay.total)} tone="bg-yellow-100 text-yellow-700" />}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-0">
              <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Lớp đang phụ trách</h2><Link href="?tab=classes" className="text-sm text-orange-700 hover:underline">Xem tất cả →</Link></div>
              <ul className="divide-y text-sm">
                {activeClasses.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0"><Link href={`/lop-hoc/${c.id}`} className="font-medium text-orange-700 hover:underline">{c.name}</Link><div className="truncate text-xs text-slate-500">{c.schedules.map((s) => `${WEEKDAYS[s.weekday]} ${s.startTime}-${s.endTime}`).join(" • ")}</div></div>
                    <span className="shrink-0 text-xs text-slate-500">{c._count.enrollments} HV</span>
                  </li>
                ))}
                {!activeClasses.length && <li className="px-4 py-8 text-center text-slate-500">Chưa phụ trách lớp nào.</li>}
              </ul>
            </Card>
            <Card className="p-0">
              <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Buổi dạy sắp tới</h2><Link href="?tab=schedule" className="text-sm text-orange-700 hover:underline">Xem tất cả →</Link></div>
              <ul className="divide-y text-sm">
                {upcoming5.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div><b className="tabular-nums">{WEEKDAYS[s.date.getUTCDay()]} {fmtDate(s.date)}</b> · {s.startTime}-{s.endTime}<div className="text-xs text-slate-500">{s.class.name}{s.room ? ` · ${roomLabel(s.room)}` : ""}</div></div>
                  </li>
                ))}
                {!upcoming5.length && <li className="px-4 py-8 text-center text-slate-500">Không có buổi dạy sắp tới.</li>}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* ===== Thông tin cá nhân ===== */}
      {tab === "info" && (
        <ActionForm action={updateTeacher} submit="Lưu thông tin" reset={false} className="flex flex-col gap-4 [&>button]:self-start">
          <input type="hidden" name="id" value={t.id} />
          <TeacherFields t={t} showPay={me.role === "ADMIN"} />
        </ActionForm>
      )}

      {/* ===== Lớp phụ trách ===== */}
      {tab === "classes" && await (async () => {
        const where = { ...mine, ...(sp.all ? {} : { finished: false }) };
        const [total, list] = await Promise.all([
          db.class.count({ where }),
          db.class.findMany({ where, orderBy: { name: "asc" }, skip: pg.skip, take: pg.take, include: { schedules: true, room: { include: { branch: true } }, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } }),
        ]);
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{total} lớp</span>
              <Link href={sp.all ? "?tab=classes" : "?tab=classes&all=1"} className="text-orange-700 hover:underline">{sp.all ? "Chỉ lớp đang mở" : "Hiện cả lớp đã kết thúc"}</Link>
            </div>
            <Table head={["Lớp", "Lịch học", "Phòng", "Học viên", "Trạng thái"]}>
              {list.map((c) => (
                <tr key={c.id}>
                  <td><Link data-row href={`/lop-hoc/${c.id}`} className="font-medium text-orange-700 hover:underline">{c.name}</Link></td>
                  <td>{c.schedules.map((s) => `${WEEKDAYS[s.weekday]} ${s.startTime}-${s.endTime}`).join(" • ")}</td>
                  <td>{roomLabel(c.room) ?? "-"}</td><td>{c._count.enrollments}/{c.maxStudents}</td>
                  <td>{c.finished ? <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">Đã kết thúc</span> : <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Đang mở</span>}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Chưa có lớp.</td></tr>}
            </Table>
            <Pagination total={total} page={pg.page} size={pg.size} path={`/giao-vien/${id}`} params={{ tab: "classes", all: sp.all, size: sp.size }} />
          </div>
        );
      })()}

      {/* ===== Lịch dạy ===== */}
      {tab === "schedule" && await (async () => {
        const where = { teacherId: id, date: { gte: today }, status: { not: "CANCELLED" as const } };
        const [total, list] = await Promise.all([
          db.session.count({ where }),
          db.session.findMany({ where, orderBy: [{ date: "asc" }, { startTime: "asc" }], skip: pg.skip, take: pg.take, include: { class: { include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } }, room: { include: { branch: true } } } }),
        ]);
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm"><span className="text-slate-600">{total} buổi sắp tới</span><Link href={`/lich-hoc?teacher=${id}`} className="text-orange-700 hover:underline">Mở lịch dạng lưới →</Link></div>
            <Table head={["Ngày", "Giờ", "Lớp", "Phòng", "Học viên", ""]}>
              {list.map((s) => (
                <tr key={s.id} className={s.date.getTime() === today.getTime() ? "bg-orange-50" : ""}>
                  <td className="whitespace-nowrap">{WEEKDAYS[s.date.getUTCDay()]}, {fmtDate(s.date)}{s.date.getTime() === today.getTime() && <span className="ml-1 rounded bg-orange-600 px-1.5 text-[10px] text-white">Hôm nay</span>}</td>
                  <td className="whitespace-nowrap">{s.startTime}-{s.endTime}</td><td>{s.class.name}{s.originalTeacherId && <span className="ml-1 rounded bg-sky-100 px-1.5 text-[11px] text-sky-700">Dạy thế</span>}</td><td>{roomLabel(s.room) ?? "-"}</td><td>{s.class._count.enrollments}</td>
                  <td><Link href={`/diem-danh/${s.id}`} className="text-orange-700 hover:underline">Điểm danh</Link></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Không có buổi dạy sắp tới.</td></tr>}
            </Table>
            <Pagination total={total} page={pg.page} size={pg.size} path={`/giao-vien/${id}`} params={{ tab: "schedule", size: sp.size }} />
          </div>
        );
      })()}

      {/* ===== Chấm công & Lương ===== */}
      {tab === "pay" && await (async () => {
        const months = Array.from({ length: 6 }, (_, i) => fm(new Date(Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth() - i, 1))));
        const [payrolls, sessions] = await Promise.all([
          db.payroll.findMany({ where: { teacherId: id, month: { in: months } } }),
          db.session.findMany({ where: { teacherId: id, status: "DONE", date: { gte: monthRange(months[months.length - 1]).from } }, select: { date: true, startTime: true, endTime: true, originalTeacherId: true, payAmount: true, class: { select: { teacherRate: true } } } }),
        ]);
        return (
          <div className="space-y-3">
            <Card className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span><span className="text-slate-500">Kiểu lương:</span> <b>{PAY_LABEL[t.payType]}</b></span>
              <span><span className="text-slate-500">Mức:</span> <b>{fmtMoney(t.payRate)}</b></span>
              <span><span className="text-slate-500">Đơn giá dạy thế:</span> <b>{t.substituteRate ? fmtMoney(t.substituteRate) : "như mức thường"}</b></span>
              {t.bankAccount && <span><span className="text-slate-500">Tài khoản:</span> <b>{t.bankName} · {t.bankAccount}</b></span>}
              <Link href={`/cong?m=${thisMonth}`} className="ml-auto text-orange-700 hover:underline">Mở bảng lương chung →</Link>
            </Card>
            <Table head={["Tháng", "Số buổi", "Số giờ", "Lương cơ bản", "Dạy thế", "Điều chỉnh", "Thực nhận", "Trạng thái"]}>
              {months.map((m) => {
                const r = monthRange(m);
                const live = computePay(t, sessions.filter((s) => s.date >= r.from && s.date < r.to));
                const p = payrolls.find((x) => x.month === m);
                const base = p ? p.baseAmount : live.base, sub = p ? p.substituteAmount : live.substitute, adj = p?.adjustment ?? 0;
                return (
                  <tr key={m}>
                    <td className="font-medium">{r.mo}/{r.y}</td><td>{p ? p.sessions : live.sessions}</td><td>{(p ? p.hours : live.hours).toFixed(1)}</td>
                    <td>{fmtMoney(base)}</td><td className="text-sky-700">{sub ? `+${fmtMoney(sub)}` : "-"}</td><td className={adj < 0 ? "text-red-600" : adj > 0 ? "text-green-700" : ""}>{adj ? `${adj > 0 ? "+" : ""}${fmtMoney(adj)}` : "-"}</td>
                    <td className="font-bold text-orange-700">{fmtMoney(base + sub + adj)}</td>
                    <td>{p?.status === "PAID" ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Đã trả {fmtDate(p.paidAt)}</span> : p ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">Đã chốt</span> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Chưa chốt</span>}</td>
                  </tr>
                );
              })}
            </Table>
          </div>
        );
      })()}

      {/* ===== Tài khoản ===== */}
      {tab === "account" && (
        <Card className="max-w-xl space-y-3">
          <h2 className="font-semibold">Tài khoản đăng nhập</h2>
          {t.user ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-slate-500">Tên đăng nhập</div><b>{t.user.username}</b></div>
                <div><div className="text-xs text-slate-500">Trạng thái</div>{t.user.isActive ? <span className="text-green-700">Đang hoạt động</span> : <span className="text-red-600">Đã khoá</span>}</div>
                <div><div className="text-xs text-slate-500">Ngày tạo</div>{fmtDate(t.user.createdAt)}</div>
                <div><div className="text-xs text-slate-500">Bắt buộc đổi mật khẩu</div>{t.user.mustChangePwd ? "Có" : "Không"}</div>
              </div>
              <ActionForm action={resetUserPassword} submit="Cấp lại mật khẩu" reset={false} className="flex flex-col gap-2 [&>button]:self-start"><input type="hidden" name="userId" value={t.user.id} /></ActionForm>
              <p className="text-xs text-slate-500">Mật khẩu mới chỉ hiện một lần sau khi cấp. Giáo viên nên đổi lại sau lần đăng nhập đầu.</p>
            </>
          ) : <p className="text-sm text-slate-600">Giáo viên này chưa có tài khoản. Hãy thêm số điện thoại hoặc tạo tài khoản khi thêm mới giáo viên.</p>}
        </Card>
      )}
    </div>
  );
}
