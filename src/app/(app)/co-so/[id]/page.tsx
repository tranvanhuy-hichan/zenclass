import Link from "next/link";
import { notFound } from "next/navigation";
import { Building, DoorOpen, MapPin, Phone, School, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Tabs } from "@/components/ui";
import { todayUTC, toMinutes } from "@/lib/format";
import { deleteBranch, updateBranch } from "../actions";

const TABS = [["overview", "Tổng quan"], ["rooms", "Phòng học"], ["settings", "Thông tin & Xoá"]] as const;
const ic = inputCls + " w-full";

export default async function BranchDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const me = await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "overview";
  const b = await db.branch.findUnique({
    where: { id },
    include: { rooms: { orderBy: { name: "asc" }, include: { classes: { where: { finished: false }, select: { id: true, name: true } }, sessions: { where: { date: todayUTC(), status: { not: "CANCELLED" } }, orderBy: { startTime: "asc" }, select: { id: true, startTime: true, endTime: true, class: { select: { name: true } } } } } } },
  });
  if (!b) notFound();
  const vn = new Date(Date.now() + 7 * 3600_000);
  const nowMin = vn.getUTCHours() * 60 + vn.getUTCMinutes();
  const classes = b.rooms.flatMap((r) => r.classes.map((c) => ({ ...c, room: r.name })));
  const Stat = ({ icon: I, label, value, tone = "bg-orange-100 text-orange-700" }: { icon: typeof Building; label: string; value: React.ReactNode; tone?: string }) => (
    <Card className="flex items-center gap-3 p-4"><span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone}`}><I className="size-5" /></span><div><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold">{value}</div></div></Card>
  );
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700"><Building className="size-7" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h1 className="text-xl font-semibold">{b.name}</h1>{!b.active && <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">Tạm ngưng</span>}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-slate-600">
            <span className="flex items-center gap-1.5"><MapPin className="size-4 text-slate-400" />{b.address ?? "Chưa có địa chỉ"}</span>
            {b.phone && <span className="flex items-center gap-1.5"><Phone className="size-4 text-slate-400" />{b.phone}</span>}
          </div>
        </div>
        <Link href="/co-so" className="hidden h-9 items-center rounded-md border bg-white px-3 text-sm hover:bg-slate-50 md:inline-flex">← Danh sách</Link>
      </Card>
      <Tabs current={`?tab=${tab}`} items={TABS.map(([k, l]) => [`?tab=${k}`, l] as [string, string])} />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat icon={DoorOpen} label="Phòng học" value={b.rooms.length} />
            <Stat icon={School} label="Lớp đang mở" value={classes.length} tone="bg-sky-100 text-sky-700" />
          </div>
          {b.note && <Card className="text-sm text-slate-600">{b.note}</Card>}
        </div>
      )}

      {tab === "rooms" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {b.rooms.map((r) => {
            const cur = r.sessions.find((x) => toMinutes(x.startTime) <= nowMin && nowMin < toMinutes(x.endTime));
            return (
              <Link key={r.id} href={`/phong-hoc/${r.id}`}>
                <Card className="flex h-full flex-col gap-3 transition-colors hover:border-orange-400">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-lg bg-orange-100 text-orange-700"><DoorOpen className="size-5" /></span>
                      <div>
                        <div className="text-base font-semibold leading-tight">{r.name}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-500"><Users className="size-3.5" /> Sức chứa {r.capacity} chỗ</div>
                      </div>
                    </div>
                    {cur ? <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"><i className="inline-block size-1.5 animate-pulse rounded-full bg-blue-500" />Đang học</span>
                      : <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.sessions.length ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}`}>{r.sessions.length ? `${r.sessions.length} buổi hôm nay` : "Trống hôm nay"}</span>}
                  </div>
                  <div className="text-sm">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Lớp sử dụng ({r.classes.length})</div>
                    {r.classes.length ? <div className="flex flex-wrap gap-1">{r.classes.map((c) => <span key={c.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c.name}</span>)}</div> : <span className="text-slate-400">Chưa gán lớp nào</span>}
                  </div>
                  {r.sessions.length > 0 && (
                    <div className="space-y-0.5 border-t pt-2 text-xs text-slate-600">
                      {r.sessions.map((x) => { const live = toMinutes(x.startTime) <= nowMin && nowMin < toMinutes(x.endTime); const past = nowMin >= toMinutes(x.endTime); return <div key={x.id} className={past ? "opacity-50" : live ? "font-semibold text-blue-600" : ""}>{live ? "● " : ""}<b>{x.startTime}-{x.endTime}</b> · {x.class.name}</div>; })}
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
          {!b.rooms.length && <p className="text-sm text-slate-500">Chưa có phòng. Thêm phòng ở mục Phòng học.</p>}
        </div>
      )}

      {tab === "settings" && (
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <h2 className="font-semibold">Thông tin cơ sở</h2>
            <p className="mb-4 text-sm text-slate-500">Địa chỉ và số điện thoại hiển thị trên phiếu thu, lịch học và cổng học viên.</p>
            <ActionForm action={updateBranch} submit="Lưu thay đổi" reset={false} className="flex flex-col gap-4 [&>button]:self-start">
              <input type="hidden" name="id" value={b.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tên cơ sở *"><input name="name" defaultValue={b.name} className={ic} required /></Field>
                <Field label="Số điện thoại"><input name="phone" defaultValue={b.phone ?? ""} className={ic} /></Field>
                <div className="md:col-span-2"><Field label="Địa chỉ"><input name="address" defaultValue={b.address ?? ""} className={ic} /></Field></div>
                <div className="md:col-span-2"><Field label="Ghi chú"><textarea name="note" defaultValue={b.note ?? ""} rows={3} className={ic} placeholder="Hướng dẫn đường đi, giờ mở cửa..." /></Field></div>
              </div>
              <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                <input type="checkbox" name="active" defaultChecked={b.active} className="size-4" />
                <span><b className="block">Đang hoạt động</b><span className="text-slate-500">Tắt khi cơ sở tạm ngưng nhận lớp mới.</span></span>
              </label>
            </ActionForm>
          </Card>
          {me.role === "ADMIN" && (
            <Card className="space-y-3 border-red-300">
              <h2 className="font-semibold text-red-600">Vùng nguy hiểm</h2>
              <p className="text-sm text-slate-600">Xoá cơ sở không thể hoàn tác. Chỉ xoá được khi không còn phòng nào ({b.rooms.length} phòng hiện tại).</p>
              <ActionForm action={deleteBranch} submit="Xoá cơ sở" danger confirmText={`Xoá ${b.name}?`} className="inline-flex"><input type="hidden" name="id" value={b.id} /></ActionForm>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
