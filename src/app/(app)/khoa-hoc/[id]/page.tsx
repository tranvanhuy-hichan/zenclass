import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, School, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Table, Tabs } from "@/components/ui";
import { ScheduleChips } from "@/components/schedule-chips";
import { fmtMoney, roomLabel } from "@/lib/format";
import { deleteCourse, updateCourse } from "../actions";

const TABS = [["overview", "Tổng quan"], ["classes", "Lớp thuộc khoá"], ["settings", "Thông tin & Xoá"]] as const;
const ic = inputCls + " w-full";

export default async function CourseDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const me = await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "overview";
  const c = await db.course.findUnique({
    where: { id },
    include: { classes: { orderBy: { name: "asc" }, include: { teacher: true, room: { include: { branch: true } }, schedules: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } } },
  });
  if (!c) notFound();
  const open = c.classes.filter((x) => !x.finished);

  const Stat = ({ icon: I, label, value, tone = "bg-orange-100 text-orange-700" }: { icon: typeof Wallet; label: string; value: React.ReactNode; tone?: string }) => (
    <Card className="flex items-center gap-3 p-4"><span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone}`}><I className="size-5" /></span><div><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold">{value}</div></div></Card>
  );
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700"><BookOpen className="size-7" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold">{c.name}</h1>{c.code && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c.code}</span>}{!c.active && <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">Ngưng</span>}</div>
          <div className="text-sm text-slate-600">{c.subject ?? "Chưa có môn"}{c.level ? ` · ${c.level}` : ""}{c.description ? ` · ${c.description}` : ""}</div>
        </div>
        <Link href="/khoa-hoc" className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm hover:bg-slate-50">← Danh sách</Link>
      </Card>
      <Tabs current={`?tab=${tab}`} items={TABS.map(([k, l]) => [`?tab=${k}`, l] as [string, string])} />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            <Stat icon={School} label="Lớp đang mở" value={open.length} />
            <Stat icon={BookOpen} label="Số buổi mặc định" value={c.totalSessions} tone="bg-green-100 text-green-700" />
            <Stat icon={Wallet} label="Học phí mặc định" value={fmtMoney(c.tuitionFee)} tone="bg-yellow-100 text-yellow-700" />
          </div>
        </div>
      )}

      {tab === "classes" && (
        <Table head={["Lớp", "Cơ sở · Phòng", "Giáo viên", "Lịch học", "Học viên", "Trạng thái"]}>
          {c.classes.map((x) => (
            <tr key={x.id} className="align-top">
              <td><Link data-row href={`/lop-hoc/${x.id}`} className="font-medium text-orange-700 hover:underline">{x.name}</Link></td>
              <td>{roomLabel(x.room) ?? "-"}</td>
              <td>{x.teacher?.fullName ?? "-"}</td><td><ScheduleChips list={x.schedules} /></td><td>{x._count.enrollments}/{x.maxStudents}</td>
              <td>{x.finished ? <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">Đã kết thúc</span> : <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Đang mở</span>}</td>
            </tr>
          ))}
          {!c.classes.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Chưa có lớp nào thuộc khoá này. Gán khoá học khi tạo hoặc sửa lớp.</td></tr>}
        </Table>
      )}

      {tab === "settings" && (
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <h2 className="font-semibold">Thông tin khoá học</h2>
            <p className="mb-4 text-sm text-slate-500">Số buổi và học phí mặc định được điền sẵn khi tạo lớp mới thuộc khoá này.</p>
            <ActionForm action={updateCourse} submit="Lưu thay đổi" reset={false} className="flex flex-col gap-4 [&>button]:self-start">
              <input type="hidden" name="id" value={c.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2"><Field label="Tên khoá học *"><input name="name" defaultValue={c.name} className={ic} required /></Field></div>
                <Field label="Mã khoá"><input name="code" defaultValue={c.code ?? ""} className={ic} /></Field>
                <Field label="Môn học"><input name="subject" defaultValue={c.subject ?? ""} className={ic} /></Field>
                <Field label="Trình độ"><input name="level" defaultValue={c.level ?? ""} className={ic} /></Field>
                <Field label="Số buổi mặc định"><input name="totalSessions" defaultValue={c.totalSessions} className={ic} /></Field>
                <div className="md:col-span-2"><Field label="Học phí mặc định (đ)"><input name="tuitionFee" defaultValue={c.tuitionFee} className={ic} /></Field></div>
                <div className="md:col-span-2"><Field label="Mô tả"><textarea name="description" defaultValue={c.description ?? ""} rows={3} className={ic} /></Field></div>
              </div>
              <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                <input type="checkbox" name="active" defaultChecked={c.active} className="size-4" />
                <span><b className="block">Đang mở đăng ký</b><span className="text-slate-500">Tắt khi khoá không còn nhận lớp hoặc học viên mới.</span></span>
              </label>
            </ActionForm>
          </Card>
          {me.role === "ADMIN" && (
            <Card className="space-y-3 border-red-300">
              <h2 className="font-semibold text-red-600">Vùng nguy hiểm</h2>
              <p className="text-sm text-slate-600">Xoá khoá học không thể hoàn tác. Chỉ xoá được khi không còn lớp nào ({c.classes.length} lớp hiện tại).</p>
              <ActionForm action={deleteCourse} submit="Xoá khoá học" danger confirmText={`Xoá khoá ${c.name}?`} className="inline-flex"><input type="hidden" name="id" value={c.id} /></ActionForm>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
