import Link from "next/link";
import { ViewToggle, pickView } from "@/components/view-toggle";
import { Building, DoorOpen, MapPin, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { DialogButton } from "@/components/dialog";
import { Card, Field, inputCls, Table, Title } from "@/components/ui";
import { createBranch } from "./actions";

const V = "flex flex-col gap-3 [&>button]:self-start";
const ic = inputCls + " w-full";

export default async function Branches({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  await requireRole(...STAFF_ROLES);
  const view = pickView((await searchParams).v, "cards");
  const list = await db.branch.findMany({
    orderBy: { name: "asc" },
    include: { rooms: { select: { id: true, name: true, _count: { select: { classes: { where: { finished: false } } } } } } },
  });
  return (
    <div className="space-y-4">
      <Title right={<>
        <ViewToggle path="/co-so" view={view} />
        <DialogButton label="+ Thêm cơ sở" title="Thêm cơ sở">
          <ActionForm action={createBranch} submit="Thêm cơ sở" className={V}>
            <Field label="Tên cơ sở *"><input name="name" className={ic} required placeholder="vd: Cơ sở Cầu Giấy" /></Field>
            <Field label="Địa chỉ"><input name="address" className={ic} /></Field>
            <Field label="Số điện thoại"><input name="phone" className={ic} /></Field>
            <Field label="Ghi chú"><input name="note" className={ic} /></Field>
          </ActionForm>
        </DialogButton>
      </>}>Cơ sở ({list.length})</Title>

      {view === "cards" ? (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {list.map((b) => {
          const classes = b.rooms.reduce((n, r) => n + r._count.classes, 0);
          return (
            <Card key={b.id} className="relative flex cursor-pointer flex-col gap-3 transition-shadow hover:shadow-md">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-orange-100 text-orange-700"><Building className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><Link href={`/co-so/${b.id}`} className="text-base font-semibold after:absolute after:inset-0 hover:text-orange-700">{b.name}</Link>{!b.active && <span className="rounded bg-slate-200 px-1.5 text-xs">Tạm ngưng</span>}</div>
                  <div className="mt-1 space-y-0.5 text-sm text-slate-600">
                    <div className="flex items-start gap-1.5"><MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />{b.address ?? "Chưa có địa chỉ"}</div>
                    {b.phone && <div className="flex items-center gap-1.5"><Phone className="size-4 text-slate-400" />{b.phone}</div>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                <div><div className="text-xs text-slate-500">Phòng học</div><b>{b.rooms.length}</b> phòng</div>
                <div><div className="text-xs text-slate-500">Lớp đang mở</div><b>{classes}</b> lớp</div>
              </div>
              {b.rooms.length > 0 && <div className="flex flex-wrap gap-1">{b.rooms.map((r) => <span key={r.id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs"><DoorOpen className="size-3" />{r.name}</span>)}</div>}
            </Card>
          );
        })}
        {!list.length && <p className="text-sm text-slate-500">Chưa có cơ sở nào. Hãy thêm cơ sở đầu tiên rồi gán phòng cho nó.</p>}
      </div>
      ) : (
        <Table head={["Cơ sở", "Địa chỉ", "Điện thoại", "Phòng học", "Lớp đang mở", "Trạng thái"]}>
          {list.map((b) => (
            <tr key={b.id} className="align-middle [&>td]:!py-3">
              <td><Link data-row href={`/co-so/${b.id}`} className="font-semibold text-orange-700 hover:underline">{b.name}</Link></td>
              <td>{b.address ?? "-"}</td><td>{b.phone ?? "-"}</td>
              <td>{b.rooms.length}</td><td>{b.rooms.reduce((n, r) => n + r._count.classes, 0)}</td>
              <td>{b.active ? "Hoạt động" : "Tạm ngưng"}</td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Chưa có cơ sở nào.</td></tr>}
        </Table>
      )}
    </div>
  );
}
