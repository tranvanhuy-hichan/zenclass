import Link from "next/link";
import { PersonCard } from "@/components/person-card";
import { ViewToggle, pickView } from "@/components/view-toggle";
import { AutoForm } from "@/components/auto-form";
import { notFound } from "next/navigation";
import { BookOpen, CalendarCheck, Mail, Phone, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, inputCls, Table, Tabs, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { StaffFields } from "@/components/person-fields";
import { ScheduleChips } from "@/components/schedule-chips";
import { getPaging } from "@/lib/paging";
import { WEEKDAYS, addDays, fmtDate, fmtMoney, isoDate, todayUTC, roomLabel } from "@/lib/format";
import { KINDS, repo, type Kind } from "@/server/people";
import * as AA from "@/app/(app)/tro-giang/actions";
import * as CA from "@/app/(app)/giao-vu/actions";

/** Server action phải đi từ file "use server" của từng mục. */
const actionsOf = (kind: Kind) => kind === "assistant"
  ? { create: AA.createAssistant, update: AA.updateAssistant, remove: AA.deleteAssistant, reset: AA.resetAssistantPassword }
  : { create: CA.createCoordinator, update: CA.updateCoordinator, remove: CA.deleteCoordinator, reset: CA.resetCoordinatorPassword };

type SP = { q?: string; page?: string; size?: string; tab?: string; v?: string };
const btn = "inline-flex h-9 items-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700";

/** Một dòng danh sách nhân sự (giáo viên / trợ giảng / giáo vụ): các trường khác nhau tuỳ loại nên để mở. */
type PersonRow = { id: string; fullName: string; phone: string | null; email: string | null; avatarUrl: string | null; specialty?: string | null; position?: string | null; payRate?: number; salary?: number; _count: { classes: number } };

/* ===================== Danh sách (thẻ) ===================== */
export async function PeopleList({ kind, searchParams }: { kind: Kind; searchParams: Promise<SP> }) {
  const me = await requireRole(...STAFF_ROLES);
  const K = KINDS[kind];
  const sp = await searchParams;
  const { q } = sp;
  const view = pickView(sp.v, "cards");
  const pg = getPaging(sp, 12);
  const where = q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {};
  const [total, list] = await Promise.all([
    repo(kind).count({ where }),
    repo(kind).findMany({ where, orderBy: { fullName: "asc" }, skip: pg.skip, take: pg.take, include: { user: true, _count: { select: { classes: { where: { finished: false } } } } } }),
  ]);
  return (
    <div className="space-y-4">
      <Title right={<Link href={`${K.base}/them`} className={btn}>+ Thêm {K.label.toLowerCase()}</Link>}>{K.label} ({total})</Title>
      <AutoForm className="flex gap-2"><input type="hidden" name="v" value={view} /><input name="q" defaultValue={q} placeholder="Tìm theo tên, SĐT..." className={inputCls + " min-w-0 flex-1"} /><div className="hidden md:block"><ViewToggle path={K.base} params={{ q, size: sp.size }} view={view} /></div></AutoForm>
      {view !== "cards" && (
        <div className="space-y-2 md:hidden">
          {list.map((p: PersonRow) => <div key={p.id}><PersonCard href={`${K.base}/${p.id}`} name={p.fullName} avatarUrl={p.avatarUrl} tag={(kind === "assistant" ? p.specialty : p.position) ?? K.label} phone={p.phone} email={p.email} stats={[{ label: "Phụ trách", value: `${p._count.classes} lớp` }, ...(me.role === "ADMIN" ? [{ label: kind === "assistant" ? "Mức lương" : "Lương tháng", value: fmtMoney((kind === "assistant" ? p.payRate : p.salary) ?? 0) }] : [])]} /></div>)}
          {!list.length && <p className="py-8 text-center text-sm text-slate-500">Chưa có {K.label.toLowerCase()}.</p>}
        </div>
      )}
      {view === "cards" ? (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-3 2xl:grid-cols-4">
        {list.map((p: PersonRow) => <div key={p.id}><PersonCard href={`${K.base}/${p.id}`} name={p.fullName} avatarUrl={p.avatarUrl} tag={(kind === "assistant" ? p.specialty : p.position) ?? K.label} phone={p.phone} email={p.email} stats={[{ label: "Phụ trách", value: `${p._count.classes} lớp` }, ...(me.role === "ADMIN" ? [{ label: kind === "assistant" ? "Mức lương" : "Lương tháng", value: fmtMoney((kind === "assistant" ? p.payRate : p.salary) ?? 0) }] : [])]} /></div>)}
        {!list.length && <p className="text-sm text-slate-500">Chưa có {K.label.toLowerCase()}.</p>}
      </div>
      ) : (
        <div className="hidden md:block"><Table head={[K.label, kind === "assistant" ? "Chuyên môn" : "Chức vụ", "Điện thoại", "Email", "Phụ trách", ...(me.role === "ADMIN" ? [kind === "assistant" ? "Mức lương" : "Lương tháng"] : [])]}>
          {list.map((p: PersonRow) => (
            <tr key={p.id} className="align-middle [&>td]:!py-3">
              <td><Link data-row href={`${K.base}/${p.id}`} className="font-semibold text-orange-700 hover:underline">{p.fullName}</Link></td>
              <td>{(kind === "assistant" ? p.specialty : p.position) ?? "-"}</td><td>{p.phone ?? "-"}</td><td className="max-w-48 truncate">{p.email ?? "-"}</td>
              <td>{p._count.classes} lớp</td>
              {me.role === "ADMIN" && <td className="tabular-nums">{fmtMoney((kind === "assistant" ? p.payRate : p.salary) ?? 0)}</td>}
            </tr>
          ))}
          {!list.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Chưa có {K.label.toLowerCase()}.</td></tr>}
        </Table></div>
      )}
      <Pagination total={total} page={pg.page} size={pg.size} path={K.base} params={{ q, size: sp.size, v: sp.v }} />
    </div>
  );
}

/* ===================== Thêm mới ===================== */
export async function PeopleNew({ kind }: { kind: Kind }) {
  const me = await requireRole(...STAFF_ROLES);
  const K = KINDS[kind];
  const A = actionsOf(kind);
  return (
    <div className="space-y-4">
      <Title right={<Link href={K.base} className="text-sm underline">← Danh sách {K.label.toLowerCase()}</Link>}>Thêm {K.label.toLowerCase()}</Title>
      <ActionForm action={A.create} submit={`Lưu ${K.label.toLowerCase()}`} className="flex w-full flex-col gap-4 [&>button]:self-start"><StaffFields kind={kind} create showPay={me.role === "ADMIN"} /></ActionForm>
    </div>
  );
}

/* ===================== Chi tiết (tab) ===================== */
const TABS = [["overview", "Tổng quan"], ["info", "Thông tin cá nhân"], ["classes", "Lớp phụ trách"], ["account", "Tài khoản"]] as const;

export async function PeopleDetail({ kind, id, searchParams }: { kind: Kind; id: string; searchParams: Promise<SP> }) {
  const me = await requireRole(...STAFF_ROLES);
  const K = KINDS[kind];
  const A = actionsOf(kind);
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "overview";
  const pg = getPaging(sp, 10);
  const p = await repo(kind).findUnique({ where: { id }, include: { user: true } });
  if (!p) notFound();
  const key = K.classKey;
  const today = todayUTC();
  const [classes, studentCount, weekSessions, upcoming] = await Promise.all([
    db.class.findMany({ where: { [key]: id, finished: false }, include: { schedules: true, teacher: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } }, orderBy: { name: "asc" } }),
    db.enrollment.count({ where: { status: "ACTIVE", class: { [key]: id, finished: false } } }),
    db.session.count({ where: { class: { [key]: id }, status: { not: "CANCELLED" }, date: { gte: today, lte: addDays(today, 6) } } }),
    db.session.findMany({ where: { class: { [key]: id }, status: "PLANNED", date: { gte: today } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 5, include: { class: true, room: { include: { branch: true } } } }),
  ]);
  const Stat = ({ icon: I, label, value, tone = "bg-orange-100 text-orange-700" }: { icon: typeof Users; label: string; value: React.ReactNode; tone?: string }) => (
    <Card className="flex items-center gap-3 p-4"><span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone}`}><I className="size-5" /></span><div className="min-w-0"><div className="truncate text-xs text-slate-500">{label}</div><div className="truncate text-xl font-bold">{value}</div></div></Card>
  );

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="size-16 rounded-full object-cover" /> : <span className="grid size-16 shrink-0 place-items-center rounded-full bg-orange-100 text-2xl font-bold text-orange-700">{p.fullName.split(" ").pop()?.[0]}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold">{p.fullName}</h1><span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">{K.label}</span></div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {p.phone && <span className="flex items-center gap-1"><Phone className="size-4" />{p.phone}</span>}
            {p.email && <span className="flex items-center gap-1"><Mail className="size-4" />{p.email}</span>}
            {(kind === "assistant" ? p.specialty : p.position) && <span>{kind === "assistant" ? p.specialty : p.position}</span>}
          </div>
        </div>
        <Link href={K.base} className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm hover:bg-slate-50">← Danh sách</Link>
      </Card>

      <Tabs current={`?tab=${tab}`} items={TABS.map(([k, l]) => [`?tab=${k}`, l] as [string, string])} />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat icon={BookOpen} label="Lớp đang phụ trách" value={classes.length} />
            <Stat icon={Users} label="Học viên" value={studentCount} tone="bg-sky-100 text-sky-700" />
            <Stat icon={CalendarCheck} label="Buổi học 7 ngày tới" value={weekSessions} tone="bg-green-100 text-green-700" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-0">
              <div className="border-b px-4 py-3"><h2 className="font-semibold">Lớp đang phụ trách</h2></div>
              <ul className="divide-y text-sm">
                {classes.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5"><div className="min-w-0"><Link href={`/lop-hoc/${c.id}`} className="font-medium text-orange-700 hover:underline">{c.name}</Link><div className="text-xs text-slate-500">GV: {c.teacher?.fullName ?? "-"}</div></div><span className="text-xs text-slate-500">{c._count.enrollments} HV</span></li>
                ))}
                {!classes.length && <li className="px-4 py-8 text-center text-slate-500">Chưa phụ trách lớp nào.</li>}
              </ul>
            </Card>
            <Card className="p-0">
              <div className="border-b px-4 py-3"><h2 className="font-semibold">Buổi học sắp tới của các lớp</h2></div>
              <ul className="divide-y text-sm">
                {upcoming.map((s) => <li key={s.id} className="px-4 py-2.5"><b>{WEEKDAYS[s.date.getUTCDay()]} {fmtDate(s.date)}</b> · {s.startTime}-{s.endTime}<div className="text-xs text-slate-500">{s.class.name}{s.room ? ` · ${roomLabel(s.room)}` : ""}</div></li>)}
                {!upcoming.length && <li className="px-4 py-8 text-center text-slate-500">Không có buổi nào sắp tới.</li>}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {tab === "info" && (
        <ActionForm action={A.update} submit="Lưu thông tin" reset={false} className="flex flex-col gap-4 [&>button]:self-start">
          <input type="hidden" name="id" value={p.id} />
          <StaffFields kind={kind} p={p} showPay={me.role === "ADMIN"} />
        </ActionForm>
      )}

      {tab === "classes" && await (async () => {
        const [total, list] = await Promise.all([
          db.class.count({ where: { [key]: id } }),
          db.class.findMany({ where: { [key]: id }, orderBy: { name: "asc" }, skip: pg.skip, take: pg.take, include: { schedules: true, teacher: true, room: { include: { branch: true } }, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } }),
        ]);
        return (
          <div className="space-y-3">
            <Table head={["Lớp", "Giáo viên", "Lịch học", "Phòng", "Học viên", "Trạng thái"]}>
              {list.map((c) => (
                <tr key={c.id} className="align-top">
                  <td><Link data-row href={`/lop-hoc/${c.id}`} className="font-medium text-orange-700 hover:underline">{c.name}</Link></td>
                  <td>{c.teacher?.fullName ?? "-"}</td><td><ScheduleChips list={c.schedules} /></td><td>{roomLabel(c.room) ?? "-"}</td><td>{c._count.enrollments}/{c.maxStudents}</td>
                  <td>{c.finished ? <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">Đã kết thúc</span> : <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Đang mở</span>}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Chưa có lớp.</td></tr>}
            </Table>
            <Pagination total={total} page={pg.page} size={pg.size} path={`${K.base}/${id}`} params={{ tab: "classes", size: sp.size }} />
          </div>
        );
      })()}

      {tab === "account" && (
        <div className="space-y-4">
          <Card className="max-w-xl space-y-3">
            <h2 className="font-semibold">Tài khoản đăng nhập</h2>
            {p.user ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-slate-500">Tên đăng nhập</div><b>{p.user.username}</b></div>
                  <div><div className="text-xs text-slate-500">Trạng thái</div>{p.user.isActive ? <span className="text-green-700">Đang hoạt động</span> : <span className="text-red-600">Đã khoá</span>}</div>
                  <div><div className="text-xs text-slate-500">Ngày tạo</div>{fmtDate(p.user.createdAt)}</div>
                  <div><div className="text-xs text-slate-500">Quyền</div>{kind === "assistant" ? "Điểm danh & nhập điểm lớp mình phụ trách" : "Như nhân viên (quản lý học viên, lớp, học phí)"}</div>
                </div>
                <ActionForm action={A.reset} submit="Cấp lại mật khẩu" reset={false} className="flex flex-col gap-2 [&>button]:self-start"><input type="hidden" name="userId" value={p.user.id} /></ActionForm>
              </>
            ) : <p className="text-sm text-slate-600">Chưa có tài khoản đăng nhập.</p>}
          </Card>
          {me.role === "ADMIN" && (
            <Card className="max-w-xl space-y-2 border-red-300">
              <h2 className="font-semibold text-red-600">Xoá {K.label.toLowerCase()}</h2>
              <p className="text-sm text-slate-600">Chỉ xoá được khi không còn được gán vào lớp nào ({isoDate(today)}).</p>
              <ActionForm action={A.remove} submit={`Xoá ${K.label.toLowerCase()}`} danger confirmText={`Xoá ${p.fullName}?`} className="inline-flex"><input type="hidden" name="id" value={p.id} /></ActionForm>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
