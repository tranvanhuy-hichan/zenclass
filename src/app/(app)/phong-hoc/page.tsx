import Link from "next/link";
import { ViewToggle, pickView } from "@/components/view-toggle";
import { DoorOpen, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { DialogButton } from "@/components/dialog";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Table, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { todayUTC, toMinutes } from "@/lib/format";
import { createRoom } from "./actions";

export default async function Rooms({ searchParams }: { searchParams: Promise<{ page?: string; size?: string; branch?: string; v?: string }> }) {
  await requireRole(...STAFF_ROLES);
  const sp = await searchParams;
  const view = pickView(sp.v, "cards");
  const pg = getPaging(sp, 12);
  const today = todayUTC();
  const nowVN = new Date(Date.now() + 7 * 3600_000);
  const nowMin = nowVN.getUTCHours() * 60 + nowVN.getUTCMinutes();
  const where = sp.branch ? { branchId: sp.branch } : {};
  const branches = await db.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const [total, rooms] = await Promise.all([
    db.room.count({ where }),
    db.room.findMany({
      where, orderBy: [{ branch: { name: "asc" } }, { name: "asc" }], skip: pg.skip, take: pg.take,
      include: {
        branch: true,
        classes: { where: { finished: false }, select: { id: true, name: true }, take: 4, orderBy: { name: "asc" } },
        _count: { select: { classes: { where: { finished: false } } } },
        sessions: { where: { date: today, status: { not: "CANCELLED" } }, select: { id: true, startTime: true, endTime: true, class: { select: { name: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } }, teacher: { select: { fullName: true } } }, orderBy: { startTime: "asc" } },
      },
    }),
  ]);
  return (
    <div className="space-y-4">
      <Title right={<><ViewToggle path="/phong-hoc" params={{ branch: sp.branch, size: sp.size }} view={view} /><DialogButton label="+ Thêm phòng" title="Thêm phòng học">
        <ActionForm action={createRoom} submit="Thêm phòng" className="flex flex-col gap-3 [&>button]:self-start">
          <Field label="Cơ sở"><select name="branchId" defaultValue={sp.branch ?? ""} className={inputCls + " w-full"} required><option value="">-- chọn cơ sở --</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Tên phòng"><input name="name" className={inputCls + " w-full"} required /></Field>
          <Field label="Sức chứa"><input name="capacity" defaultValue={20} className={inputCls + " w-full"} /></Field>
        </ActionForm>
      </DialogButton></>}>Phòng học ({total})</Title>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={`/phong-hoc?v=${view}`} className={`rounded-full border px-3 py-1.5 ${!sp.branch ? "border-orange-600 bg-orange-600 text-white" : "bg-white hover:bg-slate-50"}`}>Tất cả cơ sở</Link>
        {branches.map((b) => <Link key={b.id} href={`/phong-hoc?branch=${b.id}&v=${view}`} className={`rounded-full border px-3 py-1.5 ${sp.branch === b.id ? "border-orange-600 bg-orange-600 text-white" : "bg-white hover:bg-slate-50"}`}>{b.name}</Link>)}
      </div>
      {view === "cards" ? (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {rooms.map((r) => (
          <Link key={r.id} href={`/phong-hoc/${r.id}`}>
          <Card className="flex h-full flex-col gap-3 transition-colors hover:border-orange-400">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-orange-100 text-orange-700"><DoorOpen className="size-5" /></span>
                <div>
                  <div className="text-base font-semibold leading-tight">{r.name}</div>
                  <div className="text-xs font-medium text-orange-700">{r.branch?.name ?? "Chưa gán cơ sở"}</div>
                  <div className="flex items-center gap-1 text-xs text-slate-500"><Users className="size-3.5" /> Sức chứa {r.capacity} chỗ</div>
                </div>
              </div>
              {(() => {
                const cur = r.sessions.find((x) => toMinutes(x.startTime) <= nowMin && nowMin < toMinutes(x.endTime));
                return cur ? <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"><i className="inline-block size-1.5 animate-pulse rounded-full bg-blue-500" />Đang học</span>
                  : <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.sessions.length ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}`}>{r.sessions.length ? `${r.sessions.length} buổi hôm nay` : "Trống hôm nay"}</span>;
              })()}
            </div>

            {(() => {
              const cur = r.sessions.find((x) => toMinutes(x.startTime) <= nowMin && nowMin < toMinutes(x.endTime));
              const next = r.sessions.find((x) => toMinutes(x.startTime) > nowMin);
              if (cur) return (
                <div className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm">
                  <div className="text-xs font-semibold text-blue-700">ĐANG HỌC · {cur.startTime}–{cur.endTime}</div>
                  <div className="font-semibold">{cur.class.name}</div>
                  <div className="text-xs text-slate-600">{cur.teacher?.fullName ?? "Chưa có GV"} · {cur.class._count.enrollments} học viên</div>
                </div>
              );
              if (next) return <div className="rounded-md bg-slate-100 px-3 py-2 text-sm"><span className="text-xs text-slate-500">Tiếp theo · {next.startTime}</span><div className="font-medium">{next.class.name}</div></div>;
              if (r.sessions.length) return <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">Hôm nay đã hết lớp</div>;
              return null;
            })()}

            <div className="text-sm">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Lớp sử dụng ({r._count.classes})</div>
              {r.classes.length ? (
                <div className="flex flex-wrap gap-1">
                  {r.classes.map((c) => <span key={c.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c.name}</span>)}
                  {r._count.classes > r.classes.length && <span className="px-1 text-xs text-slate-500">+{r._count.classes - r.classes.length}</span>}
                </div>
              ) : <span className="text-slate-400">Chưa gán lớp nào</span>}
            </div>

            {r.sessions.length > 0 && (
              <div className="space-y-0.5 border-t pt-2 text-xs text-slate-600">
                {r.sessions.map((s) => { const live = toMinutes(s.startTime) <= nowMin && nowMin < toMinutes(s.endTime); const past = nowMin >= toMinutes(s.endTime); return <div key={s.id} className={past ? "opacity-50" : live ? "font-semibold text-blue-600" : ""}>{live ? "● " : ""}<b>{s.startTime}-{s.endTime}</b> · {s.class.name}</div>; })}
              </div>
            )}

          </Card>
          </Link>
        ))}
        {!rooms.length && <p className="text-sm text-slate-500">Chưa có phòng học.</p>}
      </div>
      ) : (
        <Table head={["Phòng", "Cơ sở", "Sức chứa", "Lớp sử dụng", "Hôm nay"]}>
          {rooms.map((r) => {
            const cur = r.sessions.find((x) => toMinutes(x.startTime) <= nowMin && nowMin < toMinutes(x.endTime));
            return (
              <tr key={r.id} className="align-middle [&>td]:!py-3">
                <td><Link data-row href={`/phong-hoc/${r.id}`} className="font-semibold text-orange-700 hover:underline">{r.name}</Link></td>
                <td>{r.branch?.name ?? <span className="text-slate-400">Chưa gán</span>}</td>
                <td>{r.capacity} chỗ</td>
                <td className="max-w-md">{r.classes.length ? <div className="flex flex-wrap gap-1">{r.classes.map((c) => <span key={c.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c.name}</span>)}{r._count.classes > r.classes.length && <span className="px-1 text-xs text-slate-500">+{r._count.classes - r.classes.length}</span>}</div> : <span className="text-slate-400">-</span>}</td>
                <td>{cur ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">Đang học</span> : r.sessions.length ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">{r.sessions.length} buổi</span> : <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Trống</span>}</td>
              </tr>
            );
          })}
          {!rooms.length && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Chưa có phòng học.</td></tr>}
        </Table>
      )}
      <Pagination total={total} page={pg.page} size={pg.size} path="/phong-hoc" params={{ size: sp.size, branch: sp.branch, v: sp.v }} />
    </div>
  );
}
