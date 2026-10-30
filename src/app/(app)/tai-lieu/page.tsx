import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { DialogButton } from "@/components/dialog";
import { ActionForm } from "@/components/action-form";
import { Field, inputCls, Table, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { fmtDate } from "@/lib/format";
import { addMaterial, deleteMaterial } from "../hoc-tap/actions";

export default async function Materials({ searchParams }: { searchParams: Promise<{ page?: string; size?: string }> }) {
  const me = await requireRole();
  const sp = await searchParams;
  const pg = getPaging(sp);
  const canEdit = ["ADMIN", "STAFF", "TEACHER"].includes(me.role);
  let where = {};
  if (me.role === "STUDENT") {
    const e = await db.enrollment.findMany({ where: { student: { userId: me.id } }, select: { classId: true } });
    where = { OR: [{ classId: null }, { classId: { in: e.map((x) => x.classId) } }] };
  }
  const [total, list, classes] = await Promise.all([db.material.count({ where }), db.material.findMany({ where, orderBy: { createdAt: "desc" }, skip: pg.skip, take: pg.take }), db.class.findMany({ orderBy: { name: "asc" } })]);
  const names = new Map(classes.map((c) => [c.id, c.name]));
  return (
    <div className="space-y-4">
      <Title right={canEdit && <DialogButton label="+ Thêm tài liệu" title="Thêm tài liệu">
        <ActionForm action={addMaterial} submit="Thêm tài liệu" className="flex flex-col gap-3 [&>button]:self-start">
          <Field label="Tên tài liệu"><input name="title" className={inputCls + " w-full"} required /></Field>
          <Field label="Link (Google Drive, YouTube...)"><input name="url" className={inputCls + " w-full"} placeholder="https://" required /></Field>
          <Field label="Lớp"><select name="classId" className={inputCls + " w-full"}><option value="">Tất cả</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </ActionForm>
      </DialogButton>}>Tài liệu giảng dạy</Title>
      <Table head={["Tài liệu", "Lớp", "Ngày thêm", ""]}>
        {list.map((m) => (
          <tr key={m.id}>
            <td><a href={m.url} target="_blank" rel="noopener noreferrer" className="font-medium text-orange-700 hover:underline">{m.title}</a></td>
            <td>{m.classId ? names.get(m.classId) : "Tất cả lớp"}</td><td>{fmtDate(m.createdAt)}</td>
            <td>{canEdit && <ActionForm action={deleteMaterial} submit="Xoá" compact danger confirmText="Xoá tài liệu?" className=""><input type="hidden" name="id" value={m.id} /></ActionForm>}</td>
          </tr>
        ))}
        {!list.length && <tr><td colSpan={4} className="py-8 text-center text-slate-500">Chưa có tài liệu.</td></tr>}
      </Table>
      <Pagination total={total} page={pg.page} size={pg.size} path="/tai-lieu" params={{ size: sp.size }} />
    </div>
  );
}
