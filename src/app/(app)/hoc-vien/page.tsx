import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { inputCls, Table, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { loadStudents, STATUS_LABEL, type StudentStatus } from "@/server/status";

const DOT: Record<StudentStatus, string> = { learning: "bg-green-500", waiting: "bg-sky-500", makeup: "bg-red-500", ending: "bg-yellow-300", finished: "bg-slate-400", dropped: "bg-slate-300" };
const TEXT: Record<StudentStatus, string> = { learning: "text-green-700", waiting: "text-sky-700", makeup: "text-red-600", ending: "text-yellow-700", finished: "text-slate-600", dropped: "text-slate-500" };
const SUB = (st: StudentStatus, remain: number | null) =>
  st === "waiting" ? "Chưa xếp lớp" : st === "finished" ? "Đã học hết khoá" : st === "dropped" ? "Đã nghỉ học" : st === "makeup" ? `Cần xếp buổi bù${remain != null ? ` · còn ${remain} buổi` : ""}` : remain != null ? `Còn ${remain} buổi` : "—";

const TABS: [string, string][] = [["all", "Tất cả"], ["learning", "Đang học"], ["waiting", "Chờ lớp"], ["makeup", "Nghỉ chưa xếp bù"], ["ending", "Sắp hết"], ["finished", "Hết khóa"], ["dropped", "Nghỉ học"]];

export default async function Students({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string; sort?: string; classId?: string; page?: string; size?: string }> }) {
  await requireRole(...STAFF_ROLES);
  const sp = await searchParams;
  const { q = "", tab = "all", sort = "az", classId = "" } = sp;
  const pg = getPaging(sp);
  const [all, classes] = await Promise.all([loadStudents(), db.class.findMany({ where: { finished: false }, orderBy: { name: "asc" }, select: { id: true, name: true } })]);
  const kw = q.toLowerCase();
  // lọc theo lớp + từ khoá trước, số đếm ở các tab phản ánh đúng kết quả đã lọc
  const base = all.filter((s) => (!classId || s.enrollments.some((e) => e.classId === classId && ["ACTIVE", "PAUSED"].includes(e.status))) && (!kw || `${s.fullName} ${s.code} ${s.phone ?? ""}`.toLowerCase().includes(kw)));
  const counts: Record<string, number> = { all: base.length };
  for (const s of base) counts[s.status] = (counts[s.status] ?? 0) + 1;
  let list = base.filter((s) => tab === "all" || s.status === tab);
  if (sort === "za") list = [...list].reverse();
  if (sort === "new") list = [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const shown = list.slice(pg.skip, pg.skip + pg.take);
  const params = { q, tab, sort, classId, size: sp.size };

  return (
    <div className="space-y-4">
      <Title right={<><a href="/api/export/students" className="text-sm underline">Xuất Excel (CSV)</a><Link href="/hoc-vien/them" className="inline-flex h-9 items-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700">+ Thêm học viên</Link></>}>Danh sách Học viên</Title>
      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/hoc-vien?tab=${k}&q=${encodeURIComponent(q)}&sort=${sort}&classId=${classId}`} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === k ? "border-orange-600 font-semibold text-orange-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {l} <span className="text-xs text-slate-400">({counts[k] ?? 0})</span>
          </Link>
        ))}
      </div>
      <form className="flex gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input name="q" defaultValue={q} placeholder="Tìm theo tên, mã, SĐT..." className={inputCls + " flex-1"} />
        <select name="classId" defaultValue={classId} className={inputCls + " max-w-56"}><option value="">Tất cả lớp</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select name="sort" defaultValue={sort} className={inputCls}><option value="az">Tên A-Z</option><option value="za">Tên Z-A</option><option value="new">Mới nhất</option></select>
        <button className="h-9 rounded-md border bg-white px-4 text-sm">Lọc</button>
      </form>
      <Table head={["Học viên", "Trạng thái", "Lớp đang học", "Phụ huynh"]}>
        {shown.map((s) => {
          const st = s.status as StudentStatus;
          const classes = s.enrollments.filter((e) => e.status === "ACTIVE").map((e) => e.class.name);
          const hue = [...s.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
          return (
            <tr key={s.id} className={`align-middle [&>td]:!py-3 ${st === "dropped" ? "opacity-60" : ""}`}>
              <td>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: `hsl(${hue} 70% 90%)`, color: `hsl(${hue} 60% 25%)` }}>{s.fullName.split(" ").pop()?.[0]}</span>
                  <div className="min-w-0">
                    <Link data-row href={`/hoc-vien/${s.id}`} className={`block truncate font-semibold hover:text-orange-700 ${st === "dropped" ? "line-through" : ""}`}>{s.fullName}</Link>
                    <div className="truncate text-xs text-slate-500">{s.code}{s.phone ? ` · ${s.phone}` : ""}</div>
                  </div>
                </div>
              </td>
              <td>
                <div className={`flex items-center gap-2 text-sm font-semibold ${TEXT[st]}`}><i className={`inline-block size-2 rounded-full ${DOT[st]}`} />{STATUS_LABEL[st]}</div>
                <div className="mt-0.5 pl-4 text-xs text-slate-500">{SUB(st, s.remain)}</div>
              </td>
              <td className="max-w-md">
                {classes.length ? (
                  <div className="flex flex-wrap gap-1">
                    {classes.slice(0, 2).map((c) => <span key={c} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c}</span>)}
                    {classes.length > 2 && <span title={classes.slice(2).join(", ")} className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">+{classes.length - 2}</span>}
                  </div>
                ) : <span className="text-slate-400">—</span>}
              </td>
              <td>
                {s.parent ? <><div className="truncate text-sm">{s.parent.fullName}</div><div className="text-xs text-slate-500">{s.parent.phone}</div></> : <span className="text-slate-400">—</span>}
              </td>
            </tr>
          );
        })}
        {!shown.length && <tr><td colSpan={4} className="py-8 text-center text-slate-500">Không có học viên phù hợp.</td></tr>}
      </Table>
      <Pagination total={list.length} page={pg.page} size={pg.size} path="/hoc-vien" params={params} />
    </div>
  );
}
