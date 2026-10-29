import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { DialogButton } from "@/components/dialog";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { Info } from "lucide-react";
import { createTemplate, duplicateTemplate } from "./actions";

export default async function GradeTemplates({ searchParams }: { searchParams: Promise<{ page?: string; size?: string }> }) {
  await requireRole(...STAFF_ROLES);
  const sp = await searchParams;
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
      <Title right={<DialogButton label="+ Tạo bộ điểm" title="Tạo bộ điểm mới">
        <ActionForm action={createTemplate} submit="Tạo bộ điểm" className="flex flex-col gap-3 [&>button]:self-start">
          <Field label="Tên bộ điểm"><input name="name" className={inputCls + " w-full"} required placeholder="vd: Tiếng Anh giao tiếp" /></Field>
          <Field label="Bắt đầu từ"><select name="preset" className={inputCls + " w-full"}><option value="standard">Chuyên cần + Giữa kỳ + Cuối kỳ</option><option value="ielts">IELTS 4 kỹ năng</option><option value="blank">Trống</option></select></Field>
        </ActionForm>
      </DialogButton>}>Bộ điểm ({total})</Title>

      <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-orange-700" />
        <p>Mỗi <b>bộ điểm</b> gồm các <b>cột điểm</b> và <b>cách tính tổng</b> (trung bình theo trọng số hoặc công thức tự viết). Tạo một lần rồi <b>áp dụng cho nhiều lớp</b>; giáo viên chỉ việc nhập điểm.</p>
      </div>

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
      <Pagination total={total} page={pg.page} size={pg.size} path="/bang-diem" params={{ size: sp.size }} />
    </div>
  );
}
