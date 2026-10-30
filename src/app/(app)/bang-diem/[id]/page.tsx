import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { DialogButton } from "@/components/dialog";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Title } from "@/components/ui";
import { ranksToText } from "@/lib/grade";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addColumn, applyTemplate, deleteColumn, deleteTemplate, duplicateTemplate, updateColumn, updateTemplate } from "../actions";

export default async function GradeTemplateDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const t = await db.gradeTemplate.findUnique({
    where: { id },
    include: { columns: { orderBy: { order: "asc" } }, classes: { select: { id: true, name: true } } },
  });
  if (!t) notFound();
  const classes = await db.class.findMany({ where: { finished: false }, orderBy: { name: "asc" }, select: { id: true, name: true, gradeTemplateId: true } });
  return (
    <div className="space-y-4">
      <Title right={<Link href="/bang-diem" className="hidden text-sm underline md:inline">← Danh sách bộ điểm</Link>}>{t.name}</Title>
      <Card className="p-0">
            <div className="divide-y">
              <section className="space-y-3 p-5">
                <h3 className="text-sm font-semibold">1. Cách tính tổng điểm</h3>
                <ActionForm action={updateTemplate} submit="Lưu cách tính" reset={false} className="grid w-full gap-3 md:grid-cols-12">
                  <input type="hidden" name="id" value={t.id} />
                  <div className="md:col-span-4"><Field label="Tên bộ điểm"><input name="name" defaultValue={t.name} className={inputCls + " w-full"} /></Field></div>
                  <div className="md:col-span-6"><Field label="Mô tả"><input name="description" defaultValue={t.description ?? ""} className={inputCls + " w-full"} /></Field></div>
                  <div className="md:col-span-2"><Field label="Thang điểm tổng"><input name="scale" defaultValue={t.scale} className={inputCls + " w-full"} /></Field></div>
                  <div className="md:col-span-12"><Field label="Công thức (để trống = trung bình theo trọng số các cột)"><input name="formula" defaultValue={t.formula} className={inputCls + " w-full font-mono"} placeholder={t.columns.length ? `(${t.columns.map((c) => `${c.key}*${c.weight}`).join(" + ")}) / ${t.columns.reduce((s, c) => s + c.weight, 0)}` : ""} /></Field></div>
                  <div className="md:col-span-5"><Field label="Xếp loại (mỗi dòng: điểm tối thiểu:tên)"><textarea name="ranks" rows={5} defaultValue={ranksToText(t.ranks)} className="w-full rounded-md border bg-white px-3 py-2 font-mono text-sm" /></Field></div>
                  <div className="flex items-end md:col-span-7"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="missingAsZero" defaultChecked={t.missingAsZero} /> Cột chưa nhập điểm được tính là 0</label></div>
                </ActionForm>
              </section>

              <section className="space-y-3 p-5">
                <h3 className="text-sm font-semibold">2. Các cột điểm</h3>
                <div className="hidden grid-cols-[56px_1.4fr_1fr_90px_100px_64px] gap-2 pr-[72px] text-xs font-medium text-slate-500 md:grid"><span>Thứ tự</span><span>Tên cột</span><span>Mã (dùng trong công thức)</span><span>Trọng số</span><span>Điểm tối đa</span><span /></div>
                {t.columns.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-2">
                    <ActionForm action={updateColumn} submit="Lưu" reset={false} className="grid min-w-0 flex-1 grid-cols-2 items-center gap-2 md:grid-cols-[56px_1.4fr_1fr_90px_100px_64px]">
                      <input type="hidden" name="id" value={c.id} />
                      <input name="order" defaultValue={c.order} className={inputCls + " w-full"} aria-label="Thứ tự" />
                      <input name="name" defaultValue={c.name} className={inputCls + " w-full"} aria-label="Tên cột" />
                      <input name="key" defaultValue={c.key} className={inputCls + " w-full font-mono"} aria-label="Mã" />
                      <input name="weight" defaultValue={c.weight} className={inputCls + " w-full"} aria-label="Trọng số" />
                      <input name="maxScore" defaultValue={c.maxScore} className={inputCls + " w-full"} aria-label="Điểm tối đa" />
                    </ActionForm>
                    <ActionForm action={deleteColumn} submit="Xoá" danger confirmText="Xoá cột sẽ xoá toàn bộ điểm đã nhập ở cột này. Tiếp tục?" className=""><input type="hidden" name="id" value={c.id} /></ActionForm>
                  </div>
                ))}
                {!t.columns.length && <p className="text-sm text-slate-500">Chưa có cột điểm nào.</p>}
                <DialogButton variant="secondary" label="+ Thêm cột điểm" title="Thêm cột điểm">
                  <ActionForm action={addColumn} submit="Thêm cột" className="flex flex-col gap-3 [&>button]:self-start">
                    <input type="hidden" name="templateId" value={t.id} />
                    <Field label="Tên cột"><input name="name" className={inputCls + " w-full"} required /></Field>
                    <Field label="Mã (dùng trong công thức, tự tạo nếu trống)"><input name="key" className={inputCls + " w-full font-mono"} /></Field>
                    <Field label="Trọng số"><input name="weight" defaultValue={1} className={inputCls + " w-full"} /></Field>
                    <Field label="Điểm tối đa"><input name="maxScore" defaultValue={10} className={inputCls + " w-full"} /></Field>
                  </ActionForm>
                </DialogButton>
              </section>

              <section className="space-y-3 p-5">
                <h3 className="text-sm font-semibold">3. Áp dụng cho lớp</h3>
                <ActionForm action={applyTemplate} submit="Áp dụng cho các lớp đã chọn" reset={false} className="w-full space-y-3">
                  <input type="hidden" name="templateId" value={t.id} />
                  <div className="flex flex-wrap gap-2">
                    {classes.map((c) => (
                      <label key={c.id} className="flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-sm has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50">
                        <input type="checkbox" name="classId" value={c.id} defaultChecked={c.gradeTemplateId === t.id} /> {c.name}
                      </label>
                    ))}
                    {!classes.length && <span className="text-sm text-slate-500">Chưa có lớp đang mở.</span>}
                  </div>
                </ActionForm>
              </section>

              <section className="flex flex-wrap gap-2 p-5">
                <ActionForm action={duplicateTemplate} submit="Nhân bản bộ điểm" reset={false} className=""><input type="hidden" name="id" value={t.id} /></ActionForm>
                <ActionForm action={deleteTemplate} submit="Xoá bộ điểm" danger confirmText="Xoá bộ điểm này?" className=""><input type="hidden" name="id" value={t.id} /></ActionForm>
              </section>
            </div>
      </Card>
    </div>
  );
}
