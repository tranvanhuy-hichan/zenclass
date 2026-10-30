import Link from "next/link";
import { notFound } from "next/navigation";
import { DoorOpen, FileText, GraduationCap, MessageSquare, PenLine } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { DialogButton } from "@/components/dialog";
import { Card, Field, inputCls, Table, Tabs } from "@/components/ui";
import { ScheduleChips } from "@/components/schedule-chips";
import { fmtDate, roomLabel } from "@/lib/format";
import { addMaterial, addRemark, deleteMaterial } from "../../hoc-tap/actions";

const TABS = [["students", "Học viên"], ["materials", "Tài liệu"], ["remarks", "Nhận xét"]] as const;

export default async function MyClass({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const me = await requireRole("TEACHER", "ADMIN", "STAFF");
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "students";
  const c = await db.class.findFirst({
    where: { id, ...(me.role === "TEACHER" ? { OR: [{ teacher: { userId: me.id } }, { assistant: { userId: me.id } }] } : {}) },
    include: { schedules: true, course: true, gradeTemplate: true, room: { include: { branch: true } }, enrollments: { where: { status: { in: ["ACTIVE", "PAUSED"] } }, include: { student: { include: { parent: true } } }, orderBy: { student: { fullName: "asc" } } } },
  });
  if (!c) notFound();
  const studentIds = c.enrollments.map((e) => e.studentId);
  const [materials, remarks] = await Promise.all([
    db.material.findMany({ where: { classId: id }, orderBy: { createdAt: "desc" } }),
    db.remark.findMany({ where: { classId: id }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const nameOf = new Map(c.enrollments.map((e) => [e.studentId, e.student.fullName]));
  const lastRemark = new Map<string, Date>();
  for (const r of remarks) if (!lastRemark.has(r.studentId)) lastRemark.set(r.studentId, r.createdAt);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700"><GraduationCap className="size-7" /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">{c.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            <span>{c.course?.name ?? "Chưa có khoá"}</span>
            <span className="flex items-center gap-1.5"><DoorOpen className="size-4 text-slate-400" />{roomLabel(c.room) ?? "Chưa có phòng"}</span>
            <ScheduleChips list={c.schedules} />
          </div>
        </div>
        <div className="flex gap-2">
          {c.gradeTemplate && <Link href={`/lop-hoc/${c.id}/diem`} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700"><PenLine className="size-4" />Nhập điểm</Link>}
          <Link href="/lop-cua-toi" className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm hover:bg-slate-50">← Lớp của tôi</Link>
        </div>
      </Card>
      <Tabs current={`?tab=${tab}`} items={TABS.map(([k, l]) => [`?tab=${k}`, k === "students" ? `${l} (${c.enrollments.length})` : l] as [string, string])} />

      {tab === "students" && (
        <Table head={["Học viên", "Điện thoại", "Phụ huynh", "Đã học", "Nhận xét gần nhất"]}>
          {c.enrollments.map((e) => (
            <tr key={e.id} className="align-middle [&>td]:!py-3">
              <td><Link data-row href={`/hoc-vien/${e.studentId}`} className="font-semibold text-orange-700 hover:underline">{e.student.fullName}</Link><div className="text-xs text-slate-500">{e.student.code}{e.status === "PAUSED" ? " · Bảo lưu" : ""}</div></td>
              <td>{e.student.phone ?? "-"}</td>
              <td>{e.student.parent ? <>{e.student.parent.fullName}<div className="text-xs text-slate-500">{e.student.parent.phone}</div></> : "-"}</td>
              <td className="whitespace-nowrap">{e.usedSessions}/{e.totalSessions}</td>
              <td>{lastRemark.has(e.studentId) ? fmtDate(lastRemark.get(e.studentId)!) : <span className="text-slate-400">Chưa có</span>}</td>
            </tr>
          ))}
          {!c.enrollments.length && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Lớp chưa có học viên.</td></tr>}
        </Table>
      )}

      {tab === "materials" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <DialogButton label="+ Thêm tài liệu" title={`Thêm tài liệu · ${c.name}`}>
              <ActionForm action={addMaterial} submit="Thêm tài liệu" className="flex flex-col gap-3 [&>button]:self-start">
                <input type="hidden" name="classId" value={c.id} />
                <Field label="Tên tài liệu"><input name="title" className={inputCls + " w-full"} required /></Field>
                <Field label="Link (Google Drive, YouTube...)"><input name="url" className={inputCls + " w-full"} placeholder="https://" required /></Field>
              </ActionForm>
            </DialogButton>
          </div>
          <Table head={["Tài liệu", "Ngày thêm", ""]}>
            {materials.map((m) => (
              <tr key={m.id}>
                <td><a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-orange-700 hover:underline"><FileText className="size-4" />{m.title}</a></td>
                <td>{fmtDate(m.createdAt)}</td>
                <td><ActionForm action={deleteMaterial} submit="Xoá" compact danger confirmText="Xoá tài liệu?" className="inline-flex"><input type="hidden" name="id" value={m.id} /></ActionForm></td>
              </tr>
            ))}
            {!materials.length && <tr><td colSpan={3} className="py-8 text-center text-slate-500">Lớp chưa có tài liệu.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "remarks" && (
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-1">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><MessageSquare className="size-4 text-orange-700" />Viết nhận xét</h2>
            <ActionForm action={addRemark} submit="Gửi nhận xét" className="flex flex-col gap-3 [&>button]:self-start">
              <input type="hidden" name="classId" value={c.id} />
              <Field label="Học viên"><select name="studentId" className={inputCls + " w-full"} required><option value="">-- chọn học viên --</option>{c.enrollments.map((e) => <option key={e.studentId} value={e.studentId}>{e.student.fullName}</option>)}</select></Field>
              <Field label="Nội dung"><textarea name="content" rows={4} className={inputCls + " h-auto w-full py-2"} required placeholder="Nhận xét về buổi học, thái độ, tiến bộ..." /></Field>
              <p className="text-xs text-slate-500">Học viên và phụ huynh sẽ nhận được thông báo.</p>
            </ActionForm>
          </Card>
          <Card className="p-0 xl:col-span-2">
            <div className="border-b px-4 py-3 font-semibold">Nhận xét đã gửi ({remarks.length})</div>
            <ul className="divide-y">
              {remarks.map((r) => (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2"><b>{nameOf.get(r.studentId) ?? "Học viên đã rời lớp"}</b><span className="text-xs text-slate-500">{fmtDate(r.createdAt)}{r.author ? ` · ${r.author}` : ""}</span></div>
                  <p className="mt-1 whitespace-pre-line text-slate-700">{r.content}</p>
                </li>
              ))}
              {!remarks.length && <li className="px-4 py-8 text-center text-sm text-slate-500">Chưa có nhận xét nào cho lớp này.</li>}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
