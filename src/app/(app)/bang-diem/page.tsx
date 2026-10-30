import Link from "next/link";
import { ViewToggle, pickView } from "@/components/view-toggle";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { DialogButton } from "@/components/dialog";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Table, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { createTemplate, duplicateTemplate } from "./actions";

export default async function GradeTemplates({ searchParams }: { searchParams: Promise<{ page?: string; size?: string; v?: string }> }) {
  await requireRole(...STAFF_ROLES);
  const sp = await searchParams;
  const view = pickView(sp.v, "cards");
  const pg = getPaging(sp, 12);
  const [total, templates] = await Promise.all([
    db.gradeTemplate.count(),
    db.gradeTemplate.findMany({
      orderBy: { name: "asc" }, skip: pg.skip, take: pg.take,
      include: { columns: { orderBy: { order: "asc" } }, classes: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    }),
  ]);
  return (
    <div className="space-y-4">
      <Title right={<><ViewToggle path="/bang-diem" params={{ size: sp.size, v: sp.v }} view={view} /><DialogButton label="+ Tạo bộ điểm" title="Tạo bộ điểm mới">
        <ActionForm action={createTemplate} submit="Tạo bộ điểm" className="flex flex-col gap-3 [&>button]:self-start">
          <Field label="Tên bộ điểm"><input name="name" className={inputCls + " w-full"} required placeholder="vd: Tiếng Anh giao tiếp" /></Field>
          <Field label="Bắt đầu từ"><select name="preset" className={inputCls + " w-full"}><option value="standard">Chuyên cần + Giữa kỳ + Cuối kỳ</option><option value="ielts">IELTS 4 kỹ năng</option><option value="blank">Trống</option></select></Field>
        </ActionForm>
      </DialogButton></>}>Bộ điểm ({total})</Title>

      {view === "cards" ? (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.id} className="flex flex-col gap-3">
            <div>
              <Link href={`/bang-diem/${t.id}`} className="text-base font-semibold text-orange-700 hover:underline">{t.name}</Link>
              {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
            </div>

            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Cột điểm ({t.columns.length})</div>
              <div className="flex flex-wrap gap-1">
                {t.columns.map((c) => <span key={c.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c.name} <b className="text-slate-500">×{c.weight}</b></span>)}
                {!t.columns.length && <span className="text-sm text-slate-400">Chưa có cột nào</span>}
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Cách tính tổng (thang {t.scale})</div>
              {t.formula.trim() ? <code className="block rounded bg-slate-100 px-2 py-1 text-xs">{t.formula}</code> : <span className="text-sm text-slate-600">Trung bình theo trọng số</span>}
            </div>

            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Đang dùng ở {t.classes.length} lớp</div>
              <div className="flex flex-wrap gap-1">
                {t.classes.slice(0, 4).map((c) => <span key={c.id} className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-800">{c.name}</span>)}
                {t.classes.length > 4 && <span className="px-1 text-xs text-slate-500">+{t.classes.length - 4}</span>}
                {!t.classes.length && <span className="text-sm text-slate-400">Chưa áp dụng cho lớp nào</span>}
              </div>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
              <Link href={`/bang-diem/${t.id}`} className="inline-flex h-9 items-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700">Chỉnh sửa</Link>
              <ActionForm action={duplicateTemplate} submit="Nhân bản" reset={false} className="inline-flex"><input type="hidden" name="id" value={t.id} /></ActionForm>
            </div>
          </Card>
        ))}
        {!templates.length && <p className="text-sm text-slate-500">Chưa có bộ điểm nào. Hãy tạo bộ đầu tiên.</p>}
      </div>
      ) : (
        <Table head={["Bộ điểm", "Cột điểm", "Thang", "Cách tính", "Lớp áp dụng", ""]}>
          {templates.map((t) => (
            <tr key={t.id} className="align-middle [&>td]:!py-3">
              <td><Link data-row href={`/bang-diem/${t.id}`} className="font-semibold text-orange-700 hover:underline">{t.name}</Link></td>
              <td className="max-w-xs"><div className="flex flex-wrap gap-1">{t.columns.map((c) => <span key={c.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c.name} ×{c.weight}</span>)}</div></td>
              <td>{t.scale}</td>
              <td>{t.formula.trim() ? <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{t.formula}</code> : "Trung bình trọng số"}</td>
              <td>{t.classes.length} lớp</td>
              <td><ActionForm action={duplicateTemplate} submit="Nhân bản" reset={false} compact className="inline-flex"><input type="hidden" name="id" value={t.id} /></ActionForm></td>
            </tr>
          ))}
          {!templates.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Chưa có bộ điểm nào.</td></tr>}
        </Table>
      )}
      <Pagination total={total} page={pg.page} size={pg.size} path="/bang-diem" params={{ size: sp.size, v: sp.v }} />
    </div>
  );
}
