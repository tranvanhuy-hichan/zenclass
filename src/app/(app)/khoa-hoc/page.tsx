import Link from "next/link";
import { ViewToggle, pickView } from "@/components/view-toggle";
import { AutoForm } from "@/components/auto-form";
import { BookOpen, CalendarDays, School } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { DialogButton } from "@/components/dialog";
import { Card, Field, inputCls, Table, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { fmtMoney } from "@/lib/format";
import { createCourse } from "./actions";

const ic = inputCls + " w-full";

export default async function Courses({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; size?: string; v?: string }> }) {
  await requireRole(...STAFF_ROLES);
  const sp = await searchParams;
  const view = pickView(sp.v, "cards");
  const pg = getPaging(sp, 12);
  const where = sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" as const } }, { subject: { contains: sp.q, mode: "insensitive" as const } }, { code: { contains: sp.q, mode: "insensitive" as const } }] } : {};
  const [total, list] = await Promise.all([
    db.course.count({ where }),
    db.course.findMany({ where, orderBy: { name: "asc" }, skip: pg.skip, take: pg.take, include: { classes: { select: { id: true, finished: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } } } }),
  ]);
  return (
    <div className="space-y-4">
      <Title right={
        <DialogButton wide label="+ Thêm khoá học" title="Thêm khoá học">
          <ActionForm action={createCourse} submit="Tạo khoá học" className="flex flex-col gap-3 [&>button]:self-start">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Tên khoá học *"><input name="name" className={ic} required placeholder="vd: IELTS Foundation" /></Field>
              <Field label="Mã khoá"><input name="code" className={ic} placeholder="vd: IELTS-F" /></Field>
              <Field label="Môn học"><input name="subject" className={ic} placeholder="vd: IELTS" /></Field>
              <Field label="Trình độ"><input name="level" className={ic} placeholder="vd: Cơ bản" /></Field>
              <Field label="Số buổi mặc định"><input name="totalSessions" defaultValue={24} className={ic} /></Field>
              <Field label="Học phí mặc định (đ)"><input name="tuitionFee" defaultValue={0} className={ic} /></Field>
            </div>
            <Field label="Mô tả"><input name="description" className={ic} /></Field>
          </ActionForm>
        </DialogButton>
      }>Khoá học ({total})</Title>
      <AutoForm className="flex gap-2"><input type="hidden" name="v" value={view} /><input name="q" defaultValue={sp.q} placeholder="Tìm khoá học, mã, môn..." className={inputCls + " flex-1"} /><ViewToggle path="/khoa-hoc" params={{ q: sp.q, size: sp.size }} view={view} /></AutoForm>
      {view === "cards" ? (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {list.map((c) => {
          const open = c.classes.filter((x) => !x.finished);
          return (
            <Link key={c.id} href={`/khoa-hoc/${c.id}`} className="group">
              <Card className={`flex h-full flex-col gap-4 transition-all group-hover:-translate-y-0.5 group-hover:border-orange-400 group-hover:shadow-md ${c.active ? "" : "opacity-60"}`}>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700"><BookOpen className="size-6" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold leading-snug group-hover:text-orange-700">{c.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        {c.subject && <span>{c.subject}</span>}
                        {c.level && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">{c.level}</span>}
                      </div>
                    </div>
                    {!c.active && <span className="rounded bg-slate-200 px-1.5 text-xs">Ngưng</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1.5"><School className="size-4 text-slate-400" /><b className="text-base" style={{ color: "var(--fg)" }}>{open.length}</b> lớp</span>
                    <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-slate-400" /><b className="text-base" style={{ color: "var(--fg)" }}>{c.totalSessions}</b> buổi</span>
                    {c.code && <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-xs">{c.code}</span>}
                  </div>
                  <div className="mt-auto flex items-end justify-between border-t pt-3">
                    <span className="text-xs text-slate-500">Học phí</span>
                    <span className="text-lg font-bold tabular-nums text-orange-700">{fmtMoney(c.tuitionFee)}</span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
        {!list.length && <p className="text-sm text-slate-500">Chưa có khoá học.</p>}
      </div>
      ) : (
        <Table head={["Khoá học", "Môn · Trình độ", "Số lớp", "Số buổi", "Học phí"]}>
          {list.map((c) => {
            const open = c.classes.filter((x) => !x.finished);
            return (
              <tr key={c.id} className={`align-middle [&>td]:!py-3 ${c.active ? "" : "opacity-60"}`}>
                <td><Link data-row href={`/khoa-hoc/${c.id}`} className="font-semibold text-orange-700 hover:underline">{c.name}</Link>{c.code && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{c.code}</span>}{!c.active && <span className="ml-2 rounded bg-slate-200 px-1.5 text-xs">Ngưng</span>}</td>
                <td>{c.subject ?? "-"}{c.level ? ` · ${c.level}` : ""}</td>
                <td>{open.length}</td><td>{c.totalSessions}</td><td className="tabular-nums">{fmtMoney(c.tuitionFee)}</td>
              </tr>
            );
          })}
          {!list.length && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Chưa có khoá học.</td></tr>}
        </Table>
      )}
      <Pagination total={total} page={pg.page} size={pg.size} path="/khoa-hoc" params={{ q: sp.q, size: sp.size, v: sp.v }} />
    </div>
  );
}
