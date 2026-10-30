import Link from "next/link";
import { DoorOpen, GraduationCap, UserCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { Card, inputCls, Table, Title } from "@/components/ui";
import { AutoForm } from "@/components/auto-form";
import { ViewToggle, pickView } from "@/components/view-toggle";
import { Pagination } from "@/components/pagination";
import { ScheduleChips } from "@/components/schedule-chips";
import { getPaging } from "@/lib/paging";
import { roomLabel } from "@/lib/format";

export default async function MyClasses({ searchParams }: { searchParams: Promise<{ q?: string; branch?: string; page?: string; size?: string; v?: string }> }) {
  const me = await requireRole("TEACHER", "ADMIN", "STAFF");
  const sp = await searchParams;
  const view = pickView(sp.v, "cards");
  const pg = getPaging(sp, 12);
  const mine = me.role === "TEACHER" ? { OR: [{ teacher: { userId: me.id } }, { assistant: { userId: me.id } }] } : {};
  const where = {
    finished: false, ...mine,
    ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" as const } } : {}),
    ...(sp.branch ? { room: { branchId: sp.branch } } : {}),
  };
  const branches = await db.branch.findMany({ where: { rooms: { some: { classes: { some: { finished: false, ...mine } } } } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const [total, classes] = await Promise.all([
    db.class.count({ where }),
    db.class.findMany({
      where, orderBy: { name: "asc" }, skip: pg.skip, take: pg.take,
      include: { schedules: true, course: true, teacher: true, assistant: true, room: { include: { branch: true } }, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
    }),
  ]);
  return (
    <div className="space-y-4">
      <Title>Lớp của tôi ({total})</Title>
      <AutoForm className="flex flex-wrap gap-2">
        <input type="hidden" name="v" value={view} />
        <input name="q" defaultValue={sp.q} placeholder="Tìm lớp..." className={inputCls + " min-w-48 flex-1"} />
        {branches.length > 1 && <select name="branch" defaultValue={sp.branch ?? ""} className={inputCls}><option value="">Tất cả cơ sở</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
        <ViewToggle path="/lop-cua-toi" params={{ q: sp.q, branch: sp.branch, size: sp.size }} view={view} />
      </AutoForm>
      {view === "table" ? (
        <Table head={["Lớp", "Khoá", "Lịch học", "Phòng", "Học viên"]}>
          {classes.map((c) => (
            <tr key={c.id} className="align-middle [&>td]:!py-3">
              <td><Link data-row href={`/lop-cua-toi/${c.id}`} className="font-semibold text-orange-700 hover:underline">{c.name}</Link></td>
              <td>{c.course?.name ?? "-"}</td><td><ScheduleChips list={c.schedules} /></td><td>{roomLabel(c.room) ?? "-"}</td><td>{c._count.enrollments}</td>
            </tr>
          ))}
          {!classes.length && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Không có lớp phù hợp.</td></tr>}
        </Table>
      ) : (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {classes.map((c) => (
          <Link key={c.id} href={`/lop-cua-toi/${c.id}`}>
            <Card className="flex h-full flex-col gap-3 transition-colors hover:border-orange-400">
              <div>
                <div className="text-base font-semibold">{c.name}</div>
                <div className="text-xs text-slate-500">{c.course?.name ?? "Chưa có khoá"}{c.teacher && me.role !== "TEACHER" ? ` · ${c.teacher.fullName}` : ""}</div>
              </div>
              <ScheduleChips list={c.schedules} />
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-sm text-slate-600">
                <span className="flex items-center gap-1.5"><GraduationCap className="size-4 text-slate-400" /><b>{c._count.enrollments}</b> học viên</span>
                <span className="flex items-center gap-1.5"><DoorOpen className="size-4 text-slate-400" />{roomLabel(c.room) ?? "Chưa có phòng"}</span>
                {me.role === "TEACHER" && c.assistant && c.teacher && <span className="flex items-center gap-1.5"><UserCheck className="size-4 text-slate-400" />TG: {c.assistant.fullName}</span>}
              </div>
            </Card>
          </Link>
        ))}
        {!classes.length && <p className="text-sm text-slate-500">Không có lớp phù hợp.</p>}
      </div>
      )}
      <Pagination total={total} page={pg.page} size={pg.size} path="/lop-cua-toi" params={{ q: sp.q, branch: sp.branch, size: sp.size, v: sp.v }} />
    </div>
  );
}
