import Link from "next/link";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { inputCls, Table, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { loadStudents, STATUS_COLOR, STATUS_LABEL, type StudentStatus } from "@/server/status";

const TABS: [string, string][] = [["all", "Tất cả"], ["learning", "Đang học"], ["waiting", "Chờ lớp"], ["makeup", "Nghỉ chưa xếp bù"], ["ending", "Sắp hết"], ["finished", "Hết khóa"], ["dropped", "Nghỉ học"]];

export default async function Students({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string; sort?: string; page?: string; size?: string }> }) {
  await requireRole(...STAFF_ROLES);
  const sp = await searchParams;
  const { q = "", tab = "all", sort = "az" } = sp;
  const pg = getPaging(sp);
  const all = await loadStudents();
  const counts: Record<string, number> = { all: all.length };
  for (const s of all) counts[s.status] = (counts[s.status] ?? 0) + 1;
  const kw = q.toLowerCase();
  let list = all.filter((s) => (tab === "all" || s.status === tab) && (!kw || `${s.fullName} ${s.code} ${s.phone ?? ""}`.toLowerCase().includes(kw)));
  if (sort === "za") list = [...list].reverse();
  if (sort === "new") list = [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const shown = list.slice(pg.skip, pg.skip + pg.take);
  const params = { q, tab, sort, size: sp.size };

  return (
    <div className="space-y-4">
      <Title right={<><a href="/api/export/students" className="text-sm underline">Xuất Excel (CSV)</a><Link href="/hoc-vien/them" className="inline-flex h-9 items-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700">+ Thêm học viên</Link></>}>Danh sách Học viên</Title>
      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/hoc-vien?tab=${k}&q=${encodeURIComponent(q)}&sort=${sort}`} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === k ? "border-orange-600 font-semibold text-orange-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {l} <span className="text-xs text-slate-400">({counts[k] ?? 0})</span>
          </Link>
        ))}
      </div>
      <form className="flex gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input name="q" defaultValue={q} placeholder="Tìm theo tên, mã, SĐT..." className={inputCls + " flex-1"} />
        <select name="sort" defaultValue={sort} className={inputCls}><option value="az">Tên A-Z</option><option value="za">Tên Z-A</option><option value="new">Mới nhất</option></select>
        <button className="h-9 rounded-md border bg-white px-4 text-sm">Lọc</button>
      </form>
      <Table head={["Mã", "Họ tên", "Trạng thái", "Còn lại", "Lớp đang học", "SĐT"]}>
        {shown.map((s) => {
          const st = s.status as StudentStatus;
          const classes = s.enrollments.filter((e) => e.status === "ACTIVE").map((e) => e.class.name);
          return (
            <tr key={s.id} className={st === "dropped" ? "opacity-60" : ""}>
              <td className="whitespace-nowrap text-slate-500">{s.code}</td>
              <td><Link href={`/hoc-vien/${s.id}`} className={`font-medium text-orange-700 hover:underline ${st === "dropped" ? "line-through" : ""}`}>{s.fullName}</Link></td>
              <td><span className={`font-medium ${STATUS_COLOR[st]}`}>{STATUS_LABEL[st]}</span></td>
              <td>{s.remain != null ? `${s.remain} buổi` : "-"}</td>
              <td className="max-w-xs">{classes.length ? classes.join(", ") : "-"}</td>
              <td>{s.phone ?? "-"}</td>
            </tr>
          );
        })}
        {!shown.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Không có học viên phù hợp.</td></tr>}
      </Table>
      <Pagination total={list.length} page={pg.page} size={pg.size} path="/hoc-vien" params={params} />
    </div>
  );
}
