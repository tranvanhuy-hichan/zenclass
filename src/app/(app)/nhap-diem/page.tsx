import Link from "next/link";
import { AutoForm } from "@/components/auto-form";
import { MobileCollapse } from "@/components/mobile-collapse";
import { BarChart3, ClipboardCheck, Percent, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole, teachingIds } from "@/lib/guard";
import { Card, Field, inputCls, Table, Tabs, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { BarList, ColumnChart, Donut } from "@/components/charts";
import { getPaging } from "@/lib/paging";
import { BANDS, bandOf, gradeStats, type ClassStat } from "@/server/grades-stats";

const TABS = [["classes", "Danh sách lớp"], ["stats", "Thống kê"]] as const;
const fmt = (n: number | null, d = 1) => (n == null ? "-" : n.toFixed(d));

export default async function GradeEntry({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; templateId?: string; classId?: string; all?: string; page?: string; size?: string }> }) {
  const me = await requireRole("ADMIN", "STAFF", "TEACHER");
  const sp = await searchParams;
  const tab = sp.tab === "stats" ? "stats" : "classes";
  const pg = getPaging(sp, 12);

  // giáo viên / trợ giảng chỉ thấy lớp mình phụ trách
  let classIds: string[] | undefined;
  if (me.role === "TEACHER") {
    const ids = await teachingIds(me.id);
    classIds = (await db.class.findMany({ where: { OR: [{ teacherId: ids.teacherId ?? "-" }, { assistantId: ids.assistantId ?? "-" }] }, select: { id: true } })).map((c) => c.id);
  }
  const templates = await db.gradeTemplate.findMany({ orderBy: { name: "asc" } });
  let stats = await gradeStats({ classIds, templateId: sp.templateId || undefined, q: tab === "classes" ? sp.q : undefined });
  if (!sp.all && tab === "classes") stats = stats.filter((c) => !c.finished);

  return (
    <div className="space-y-4">
      <Title>Nhập điểm</Title>
      <Tabs current={`?tab=${tab}`} items={TABS.map(([k, l]) => [`?tab=${k}`, l] as [string, string])} />

      {/* ===================== DANH SÁCH LỚP ===================== */}
      {tab === "classes" && (() => {
        const total = stats.length;
        const page = stats.slice(pg.skip, pg.skip + pg.take);
        return (
          <div className="space-y-3">
            <AutoForm className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="tab" value="classes" />
              <input name="q" defaultValue={sp.q} placeholder="Tìm lớp..." className={inputCls + " min-w-0 flex-1 md:min-w-48"} />
              <MobileCollapse active={[sp.templateId, sp.all].filter(Boolean).length}>
                <select name="templateId" defaultValue={sp.templateId ?? ""} className={inputCls}><option value="">Tất cả bộ điểm</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50"><input type="checkbox" name="all" value="1" defaultChecked={!!sp.all} /> Gồm lớp đã kết thúc</label>
              </MobileCollapse>
            </AutoForm>
            {/* Điện thoại: thẻ lớp gọn thay cho bảng */}
            <div className="space-y-2 md:hidden">
              {page.map((c) => {
                const pct = c.expected ? Math.round((c.filled / c.expected) * 100) : 0;
                const band = c.avgNorm != null ? bandOf(c.avgNorm) : null;
                const href = c.templateId ? `/lop-hoc/${c.id}/diem` : `/lop-hoc/${c.id}?tab=settings`;
                return (
                  <Link key={c.id} href={href} className="block rounded-xl border bg-white p-3.5 shadow-sm transition-colors active:bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><div className="font-semibold leading-snug">{c.name}</div><div className="text-xs text-slate-500">GV: {c.teacher ?? "-"}{c.finished ? " · Đã kết thúc" : ""} · {c.students} học viên</div></div>
                      {c.template ? <span className="shrink-0 rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">{c.template}</span> : <span className="shrink-0 text-xs text-red-600">Chưa có bộ điểm</span>}
                    </div>
                    {c.templateId && (
                      <div className="mt-3 grid grid-cols-2 gap-4 border-t pt-3">
                        <div className="min-w-0">
                          <div className="flex justify-between text-xs"><span className="text-slate-500">Đã nhập</span><b>{pct}%</b></div>
                          <div className="mt-0.5 text-sm"><b>{c.filled}</b><span className="text-slate-500">/{c.expected} ô</span></div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "#22c55e" : "var(--color-orange-500)" }} /></div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500">Điểm TB (thang 10)</div>
                          {band ? <div className="mt-0.5 font-semibold" style={{ color: band.color }}>{fmt(c.avgNorm, 2)} <span className="text-xs font-normal text-slate-500">· {band.label}</span></div> : <div className="mt-0.5 text-slate-400">—</div>}
                        </div>
                      </div>
                    )}
                    <span className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-orange-600 text-sm font-medium text-white">{c.templateId ? "Nhập điểm" : "Chọn bộ điểm"}</span>
                  </Link>
                );
              })}
              {!page.length && <p className="py-8 text-center text-sm text-slate-500">Không có lớp nào.</p>}
            </div>
            <div className="hidden md:block"><Table head={["Lớp", "Bộ điểm", "Học viên", "Tiến độ nhập điểm", "Điểm TB (thang 10)", ""]}>
              {page.map((c) => {
                const pct = c.expected ? Math.round((c.filled / c.expected) * 100) : 0;
                const band = c.avgNorm != null ? bandOf(c.avgNorm) : null;
                const href = c.templateId ? `/lop-hoc/${c.id}/diem` : `/lop-hoc/${c.id}?tab=settings`;
                return (
                  <tr key={c.id} className="align-middle [&>td]:!py-3">
                    <td className="min-w-48"><Link data-row href={href} className="block font-semibold hover:text-orange-700">{c.name}</Link><div className="text-xs text-slate-500">GV: {c.teacher ?? "-"}{c.finished ? " · Đã kết thúc" : ""}</div></td>
                    <td>{c.template ? <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">{c.template}</span> : <span className="text-xs text-red-600">Chưa có bộ điểm</span>}</td>
                    <td>{c.students}</td>
                    <td className="min-w-44">
                      {c.templateId ? (
                        <>
                          <div className="flex justify-between text-xs"><span>{c.filled}/{c.expected} ô</span><b>{pct}%</b></div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "#22c55e" : "var(--color-orange-500)" }} /></div>
                        </>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td>{band ? <span className="font-semibold" style={{ color: band.color }}>{fmt(c.avgNorm, 2)} <span className="text-xs font-normal text-slate-500">· {band.label}</span></span> : <span className="text-slate-400">—</span>}</td>
                    <td><Link href={href} className="inline-flex h-8 items-center rounded-md bg-orange-600 px-3 text-xs font-medium text-white hover:bg-orange-700">{c.templateId ? "Nhập điểm" : "Chọn bộ điểm"}</Link></td>
                  </tr>
                );
              })}
              {!page.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Không có lớp nào.</td></tr>}
            </Table></div>
            <Pagination total={total} page={pg.page} size={pg.size} path="/nhap-diem" params={{ tab: "classes", q: sp.q, templateId: sp.templateId, all: sp.all, size: sp.size }} />
          </div>
        );
      })()}

      {/* ===================== THỐNG KÊ ===================== */}
      {tab === "stats" && (() => {
        const withT = stats.filter((c) => c.templateId);
        const scope: ClassStat[] = sp.classId ? withT.filter((c) => c.id === sp.classId) : withT;
        const rows = scope.flatMap((c) => c.rows.filter((r) => r.norm != null).map((r) => ({ ...r, cls: c.name })));
        const filled = scope.reduce((a, c) => a + c.filled, 0), expected = scope.reduce((a, c) => a + c.expected, 0);
        const avg = rows.length ? rows.reduce((a, r) => a + r.norm!, 0) / rows.length : null;
        const bands = BANDS.map((b) => ({ label: b.label, color: b.color, value: rows.filter((r) => bandOf(r.norm!).key === b.key).length }));
        const bins = Array.from({ length: 10 }, (_, i) => ({ label: `${i}–${i + 1}`, value: rows.filter((r) => (i === 9 ? r.norm! >= 9 : r.norm! >= i && r.norm! < i + 1)).length, color: bandOf(i + 0.5).color }));
        const byClass = [...scope].filter((c) => c.avgNorm != null).sort((a, b) => b.avgNorm! - a.avgNorm!);
        const top = [...rows].sort((a, b) => b.norm! - a.norm!).slice(0, 8);
        const low = [...rows].filter((r) => r.norm! < 5).sort((a, b) => a.norm! - b.norm!).slice(0, 8);
        const one = sp.classId ? scope[0] : null;

        const Stat = ({ icon: I, label, value, tone = "bg-orange-100 text-orange-700" }: { icon: typeof Users; label: string; value: React.ReactNode; tone?: string }) => (
          <Card className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4"><span className={`grid size-9 shrink-0 place-items-center rounded-lg sm:size-10 ${tone}`}><I className="size-4 sm:size-5" /></span><div className="min-w-0"><div className="text-xs leading-tight text-slate-500">{label}</div><div className="truncate text-lg font-bold sm:text-xl">{value}</div></div></Card>
        );
        return (
          <div className="space-y-4">
            <AutoForm className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="tab" value="stats" />
              <MobileCollapse block active={[sp.classId, sp.templateId].filter(Boolean).length}>
                <Field label="Lớp"><select name="classId" defaultValue={sp.classId ?? ""} className={inputCls + " max-md:w-full"}><option value="">Tất cả lớp</option>{stats.filter((c) => c.templateId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Bộ điểm"><select name="templateId" defaultValue={sp.templateId ?? ""} className={inputCls + " max-md:w-full"}><option value="">Tất cả</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
              </MobileCollapse>
            </AutoForm>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Stat icon={ClipboardCheck} label="Lớp có bộ điểm" value={scope.length} />
              <Stat icon={Users} label="Học viên đã có điểm" value={rows.length} tone="bg-sky-100 text-sky-700" />
              <Stat icon={BarChart3} label="Điểm trung bình (thang 10)" value={fmt(avg, 2)} tone="bg-green-100 text-green-700" />
              <Stat icon={Percent} label="Tiến độ nhập điểm" value={expected ? `${Math.round((filled / expected) * 100)}%` : "-"} tone="bg-yellow-100 text-yellow-700" />
            </div>

            {!rows.length ? <Card className="py-10 text-center text-sm text-slate-500">Chưa có dữ liệu điểm để thống kê.</Card> : (
              <>
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card><h2 className="mb-4 font-semibold">Phân bố xếp loại</h2><Donut items={bands} center={<div><div className="text-2xl font-bold">{rows.length}</div><div className="text-xs text-slate-500">học viên</div></div>} /></Card>
                  <Card><h2 className="mb-4 font-semibold">Phân bố điểm tổng (thang 10)</h2><ColumnChart items={bins} /></Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {one ? (
                    <Card><h2 className="mb-4 font-semibold">Điểm trung bình từng cột — {one.name}</h2>
                      <BarList max={10} items={one.cols.filter((c) => c.avg != null).map((c) => ({ label: c.name, value: Math.round(((c.avg ?? 0) / c.max) * 1000) / 100, hint: `(${c.avg}/${c.max})`, color: bandOf(((c.avg ?? 0) / c.max) * 10).color }))} />
                      <p className="mt-2 text-xs text-slate-500">Quy về thang 10 để so sánh các cột.</p></Card>
                  ) : (
                    <Card><h2 className="mb-4 font-semibold">Điểm trung bình theo lớp</h2>
                      <BarList max={10} items={byClass.map((c) => ({ label: c.name, value: c.avgNorm!, color: bandOf(c.avgNorm!).color }))} /></Card>
                  )}
                  <Card><h2 className="mb-4 font-semibold">Tiến độ nhập điểm theo lớp</h2>
                    <BarList max={100} unit="%" items={scope.map((c) => ({ label: c.name, value: c.expected ? Math.round((c.filled / c.expected) * 100) : 0, color: c.expected && c.filled >= c.expected ? "#22c55e" : undefined }))} /></Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="p-0"><div className="border-b px-4 py-3"><h2 className="font-semibold">Điểm cao nhất</h2></div>
                    <ul className="divide-y text-sm">{top.map((r, i) => <li key={r.studentId + r.cls} className="flex items-center gap-3 px-4 py-2.5"><span className="w-5 text-slate-400">{i + 1}</span><div className="min-w-0 flex-1"><Link href={`/hoc-vien/${r.studentId}?tab=grades`} className="font-medium hover:text-orange-700">{r.name}</Link><div className="text-xs text-slate-500">{r.cls}</div></div><b style={{ color: bandOf(r.norm!).color }}>{fmt(r.norm, 2)}</b></li>)}</ul></Card>
                  <Card className="p-0"><div className="border-b px-4 py-3"><h2 className="font-semibold">Cần chú ý (dưới 5 điểm)</h2></div>
                    <ul className="divide-y text-sm">{low.map((r) => <li key={r.studentId + r.cls} className="flex items-center gap-3 px-4 py-2.5"><div className="min-w-0 flex-1"><Link href={`/hoc-vien/${r.studentId}?tab=grades`} className="font-medium hover:text-orange-700">{r.name}</Link><div className="text-xs text-slate-500">{r.cls}</div></div><b className="text-red-600">{fmt(r.norm, 2)}</b></li>)}
                      {!low.length && <li className="px-4 py-8 text-center text-slate-500">Không có học viên nào dưới 5 điểm.</li>}</ul></Card>
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
