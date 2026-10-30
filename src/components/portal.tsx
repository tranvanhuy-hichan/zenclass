import Link from "next/link";
import { AutoForm } from "@/components/auto-form";
import { notFound } from "next/navigation";
import { AlertCircle, Award, CalendarCheck, School, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { Card, Table, Tabs, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { StudentOverview, type Section } from "@/components/student-overview";
import { getPaging } from "@/lib/paging";
import { WEEKDAYS, addDays, fmtDate, fmtMoney, isoDate, mondayOf, todayUTC, roomLabel } from "@/lib/format";

const INV_ST = { UNPAID: ["Chưa đóng", "bg-red-100 text-red-600"], PARTIAL: ["Đóng một phần", "bg-yellow-100 text-yellow-800"], PAID: ["Đã đóng đủ", "bg-green-100 text-green-800"], VOID: ["Đã huỷ", "bg-slate-200 text-slate-600"] } as const;

const ATT = {
  PRESENT: { label: "Đúng giờ", cell: "bg-green-300 text-green-900", chip: "bg-green-500 text-white" },
  LATE: { label: "Đi trễ", cell: "bg-yellow-200 text-yellow-900", chip: "bg-yellow-500 text-white" },
  ABSENT_EXCUSED: { label: "Nghỉ có phép", cell: "bg-sky-200 text-sky-900", chip: "bg-sky-500 text-white" },
  ABSENT: { label: "Nghỉ không phép", cell: "bg-red-200 text-red-900", chip: "bg-red-500 text-white" },
  MAKEUP: { label: "Học bù", cell: "bg-purple-200 text-purple-900", chip: "bg-purple-500 text-white" },
  CANCELLED: { label: "Lớp nghỉ", cell: "bg-gray-200 text-gray-600", chip: "bg-gray-400 text-white" },
  PLANNED: { label: "Sắp học", cell: "bg-orange-50 text-orange-900 ring-1 ring-inset ring-orange-300", chip: "bg-orange-400 text-white" },
  NOREC: { label: "Chưa điểm danh", cell: "bg-slate-100 text-slate-700", chip: "bg-slate-400 text-white" },
} as const;
type AK = keyof typeof ATT;
const PRIORITY: AK[] = ["ABSENT", "ABSENT_EXCUSED", "LATE", "PRESENT", "MAKEUP", "CANCELLED", "NOREC", "PLANNED"];

/** Lịch điểm danh: 1 / 3 / 6 tháng, mỗi ngày tô màu theo trạng thái (đúng giờ / đi trễ / nghỉ ...). */
async function AttendanceCalendar({ kidId, path, sp, mini = false }: { kidId: string; path: string; sp: SP; mini?: boolean }) {
  const nowVN = new Date(Date.now() + 7 * 3600_000);
  const curKey = `${nowVN.getUTCFullYear()}-${String(nowVN.getUTCMonth() + 1).padStart(2, "0")}`;
  const n = mini ? 1 : [1, 3, 6].includes(Number(sp.n)) ? Number(sp.n) : 6;
  const detail = n === 1 && !mini;
  // tháng đầu của cửa sổ: mặc định để tháng hiện tại nằm gần đầu (lùi 2 tháng với 6 tháng, 1 tháng với 3 tháng)
  const [cy, cm] = curKey.split("-").map(Number);
  const back = mini ? 0 : n === 6 ? 2 : n === 3 ? 1 : 0;
  const base = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m ?? "") ? sp.m! : `${new Date(Date.UTC(cy, cm - 1 - back, 1)).getUTCFullYear()}-${String(new Date(Date.UTC(cy, cm - 1 - back, 1)).getUTCMonth() + 1).padStart(2, "0")}`;
  const [by, bm] = base.split("-").map(Number);
  const monthStarts = Array.from({ length: n }, (_, i) => new Date(Date.UTC(by, bm - 1 + i, 1)));
  const rangeStart = mondayOf(monthStarts[0]);
  const rangeEnd = addDays(mondayOf(new Date(Date.UTC(by, bm - 1 + n, 0))), 6);
  const keyOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  const sessions = await db.session.findMany({
    where: {
      date: { gte: rangeStart, lte: rangeEnd },
      ...(sp.classId ? { classId: sp.classId } : {}),
      OR: [{ class: { enrollments: { some: { studentId: kidId, status: { in: ["ACTIVE", "PAUSED", "FINISHED"] } } } } }, { attendances: { some: { studentId: kidId } } }],
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { class: true, attendances: { where: { studentId: kidId } } },
  });
  const kindOf = (s: (typeof sessions)[number]): AK => {
    const a = s.attendances[0];
    if (a) return a.makeupClassId ? (a.status === "PRESENT" || a.status === "LATE" ? (a.status as AK) : "MAKEUP") : a.status === "PENDING" ? "MAKEUP" : (a.status as AK);
    if (s.status === "CANCELLED") return "CANCELLED";
    return s.status === "DONE" ? "NOREC" : "PLANNED";
  };
  const byDay = new Map<string, { s: (typeof sessions)[number]; k: AK }[]>();
  for (const s of sessions) byDay.set(isoDate(s.date), [...(byDay.get(isoDate(s.date)) ?? []), { s, k: kindOf(s) }]);

  const today = isoDate(todayUTC());
  const inWindow = new Set(monthStarts.map(keyOf));
  const counts = new Map<AK, number>();
  for (const [, list] of byDay) for (const x of list) if (inWindow.has(keyOf(x.s.date))) counts.set(x.k, (counts.get(x.k) ?? 0) + 1);

  const link = (o: Record<string, string | undefined>) => `${path}?${new URLSearchParams(Object.entries({ child: kidId, classId: sp.classId, view: "calendar", n: String(n), ...o }).filter(([, v]) => v) as [string, string][])}`;
  const shift = (k: number) => keyOf(new Date(Date.UTC(by, bm - 1 + k, 1)));
  const lastM = monthStarts[n - 1];
  const label = n === 1 ? `Tháng ${bm}/${by}` : `Tháng ${bm}/${by} – ${lastM.getUTCMonth() + 1}/${lastM.getUTCFullYear()}`;

  const MonthGrid = ({ start }: { start: Date }) => {
    const y = start.getUTCFullYear(), mo = start.getUTCMonth() + 1;
    const gs = mondayOf(start), ge = addDays(mondayOf(new Date(Date.UTC(y, mo, 0))), 6);
    const days: Date[] = [];
    for (let d = gs; d <= ge; d = addDays(d, 1)) days.push(d);
    return (
      <div className={detail ? "" : mini ? "" : "rounded-lg border p-2.5"}>
        {!detail && !mini && <div className="mb-1.5 text-sm font-semibold">Tháng {mo}/{y}</div>}
        <div className={`grid grid-cols-7 text-center font-semibold text-slate-500 ${detail ? "gap-1.5 pb-1.5 text-xs" : "gap-1 pb-1 text-[10px]"}`}>{(detail ? ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"] : ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]).map((d) => <div key={d}>{d}</div>)}</div>
        <div className={`grid grid-cols-7 ${detail ? "gap-1.5" : "gap-1"}`}>
          {days.map((d) => {
            const key = isoDate(d);
            const list = byDay.get(key) ?? [];
            const inMonth = d.getUTCMonth() === mo - 1;
            const main = PRIORITY.find((k) => list.some((x) => x.k === k));
            const tip = list.map(({ s, k }) => `${s.startTime} ${s.class.name} · ${ATT[k].label}`).join("\n");
            if (!detail) {
              if (!inMonth) return <div key={key} />;
              return <div key={key} title={tip} className={`grid h-8 place-items-center rounded text-xs ${main ? `${ATT[main].cell} font-bold` : "text-slate-500"} ${key === today ? "outline outline-2 outline-offset-1 outline-blue-500" : ""}`}>{d.getUTCDate()}</div>;
            }
            return (
              <div key={key} className={`min-h-24 rounded-lg p-1.5 text-xs ${main ? ATT[main].cell : "bg-slate-50 text-slate-500"} ${inMonth ? "" : "opacity-40"} ${key === today ? "outline outline-2 outline-offset-1 outline-blue-500" : ""}`}>
                <div className="mb-1 flex items-center justify-between"><b className="text-sm">{d.getUTCDate()}</b>{main && <span className="text-[10px] font-semibold uppercase opacity-80">{ATT[main].label}</span>}</div>
                <div className="space-y-1">
                  {list.map(({ s, k }) => <div key={s.id} title={`${s.class.name} · ${s.startTime}-${s.endTime} · ${ATT[k].label}`} className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${ATT[k].chip}`}>{s.startTime} {s.class.name}</div>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (mini) {
    return (
      <Card className="space-y-3 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Điểm danh tháng {bm}/{by}</h2><Link href={`/diem-danh-cua-toi?child=${kidId}`} className="text-sm text-orange-700 hover:underline">Xem chi tiết →</Link></div>
        <div className="space-y-3 px-4 pb-4">
          <div className="flex flex-wrap gap-1.5 text-[11px]">{(["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT", "PLANNED"] as AK[]).map((k) => <span key={k} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${ATT[k].cell}`}><b>{counts.get(k) ?? 0}</b> {ATT[k].label}</span>)}</div>
          <MonthGrid start={monthStarts[0]} />
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link className="inline-flex size-9 items-center justify-center rounded-md border bg-white hover:bg-slate-50" href={link({ m: shift(-n) })} aria-label="Trước">‹</Link>
          <span className="min-w-44 text-center text-base font-semibold">{label}</span>
          <Link className="inline-flex size-9 items-center justify-center rounded-md border bg-white hover:bg-slate-50" href={link({ m: shift(n) })} aria-label="Sau">›</Link>
          <Link className="ml-1 inline-flex h-9 items-center rounded-md bg-orange-600 px-3 font-medium text-white hover:bg-orange-700" href={link({ m: undefined })}>Hôm nay</Link>
        </div>
        <div className="flex overflow-hidden rounded-md border bg-white text-sm">
          {[[1, "1 tháng"], [3, "3 tháng"], [6, "6 tháng"]].map(([v, l], i) => <Link key={v} href={link({ n: String(v), m: undefined })} className={`px-3 py-2 ${i ? "border-l" : ""} ${n === v ? "bg-orange-600 text-white" : "hover:bg-slate-50"}`}>{l}</Link>)}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {(Object.keys(ATT) as AK[]).map((k) => <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${ATT[k].cell}`}><b>{counts.get(k) ?? 0}</b> {ATT[k].label}</span>)}
      </div>
      <div className="overflow-x-auto">
        <div className={detail ? "min-w-[640px]" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"}>
          {monthStarts.map((st) => <MonthGrid key={keyOf(st)} start={st} />)}
        </div>
      </div>
    </Card>
  );
}

/** Trang Học phí của học viên/phụ huynh: cùng phong cách với trang Tài chính của quản trị (chỉ xem). */
async function FeesView({ kidId, path, sp }: { kidId: string; path: string; sp: SP }) {
  const pg = getPaging({ size: sp.size, page: sp.page }, 10);
  const today = todayUTC();
  const where = { studentId: kidId };
  const [total, list, sums, overdue] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({ where, orderBy: { issueDate: "desc" }, skip: pg.skip, take: pg.take }),
    db.invoice.aggregate({ where: { ...where, status: { not: "VOID" } }, _sum: { total: true, paid: true } }),
    db.invoice.count({ where: { ...where, status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: today } } }),
  ]);
  const paid = sums._sum.paid ?? 0, owed = (sums._sum.total ?? 0) - paid;
  const Stat = ({ icon: I, label, value, tone, vt = "" }: { icon: typeof Wallet; label: string; value: React.ReactNode; tone: string; vt?: string }) => (
    <Card className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4"><span className={`grid size-9 shrink-0 place-items-center rounded-lg sm:size-10 ${tone}`}><I className="size-4 sm:size-5" /></span><div className="min-w-0"><div className="text-xs leading-tight text-slate-500">{label}</div><div className={`truncate text-lg font-bold sm:text-xl ${vt}`}>{value}</div></div></Card>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={Wallet} label="Tổng số phiếu" value={total} tone="bg-orange-100 text-orange-700" />
        <Stat icon={CalendarCheck} label="Đã đóng" value={fmtMoney(paid)} tone="bg-green-100 text-green-700" vt="text-green-700" />
        <Stat icon={Wallet} label="Còn nợ" value={fmtMoney(owed)} tone="bg-red-100 text-red-700" vt={owed ? "text-red-600" : ""} />
        <Stat icon={AlertCircle} label="Phiếu quá hạn" value={overdue} tone="bg-yellow-100 text-yellow-700" vt={overdue ? "text-red-600" : ""} />
      </div>
      <Table head={["Phiếu", "Ngày tạo", "Hạn đóng", "Tổng tiền", "Đã thu", "Còn nợ", "Trạng thái"]}>
        {list.map((i) => {
          const late = i.dueDate && i.dueDate < today && ["UNPAID", "PARTIAL"].includes(i.status);
          const [label, tone] = INV_ST[i.status];
          return (
            <tr key={i.id} className={late ? "bg-red-50/60" : ""}>
              <td><Link data-row href={`/hoa-don/${i.id}`} className="font-semibold text-orange-700 hover:underline">{i.code}</Link></td>
              <td>{fmtDate(i.issueDate)}</td><td className={late ? "font-medium text-red-600" : ""}>{fmtDate(i.dueDate)}{late && " ⚠"}</td>
              <td className="tabular-nums">{fmtMoney(i.total)}</td><td className="tabular-nums text-green-700">{fmtMoney(i.paid)}</td>
              <td className="tabular-nums font-medium">{i.status === "VOID" ? "-" : fmtMoney(i.total - i.paid)}</td>
              <td><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{label}</span></td>
            </tr>
          );
        })}
        {!list.length && <tr><td colSpan={7} className="py-8 text-center text-slate-500">Chưa có phiếu học phí nào.</td></tr>}
      </Table>
      <Pagination total={total} page={pg.page} size={pg.size} path={path} params={{ child: kidId, size: sp.size }} />
    </div>
  );
}
import { portalKids } from "@/server/portal";
import { computeTotal, rankOf } from "@/lib/grade";
import { bandOf } from "@/server/grades-stats";
import { loadStudents, STATUS_LABEL } from "@/server/status";

type SP = { child?: string; classId?: string; page?: string; size?: string; view?: string; m?: string; n?: string };

function Kids({ kids, kid, path }: { kids: { id: string; fullName: string }[]; kid: { id: string }; path: string }) {
  if (kids.length < 2) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-500">Xem của:</span>
      {kids.map((k) => <Link key={k.id} href={`${path}?child=${k.id}`} className={`rounded-full border px-3 py-1 ${k.id === kid.id ? "border-orange-600 bg-orange-600 text-white" : "bg-white hover:bg-slate-50"}`}>{k.fullName}</Link>)}
    </div>
  );
}

/** Trang Bảng điểm của học viên/phụ huynh: mỗi lớp một thẻ, cột điểm dạng ô + thanh. */
async function GradesView({ kidId }: { kidId: string }) {
  const [classes, values, remarks] = await Promise.all([
    db.class.findMany({
      where: { gradeTemplateId: { not: null }, enrollments: { some: { studentId: kidId } } },
      include: { teacher: true, gradeTemplate: { include: { columns: { orderBy: { order: "asc" } } } } }, orderBy: { name: "asc" },
    }),
    db.gradeValue.findMany({ where: { studentId: kidId } }),
    db.remark.findMany({ where: { studentId: kidId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const cards = classes.map((c) => {
    const t = c.gradeTemplate!;
    const m: Record<string, number> = {};
    for (const v of values.filter((v) => v.classId === c.id)) m[v.columnId] = v.value;
    const total = computeTotal(t, t.columns, m);
    const norm = total == null ? null : Math.round((total / t.scale) * 100) / 10;
    return { c, t, m, total, norm, rank: rankOf(total, t.ranks) };
  });
  const graded = cards.filter((x) => x.norm != null);
  const avg = graded.length ? graded.reduce((a, x) => a + x.norm!, 0) / graded.length : null;
  const best = [...graded].sort((a, b) => b.norm! - a.norm!)[0];
  const Stat = ({ icon: I, label, value, tone }: { icon: typeof Wallet; label: string; value: React.ReactNode; tone: string }) => (
    <Card className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4"><span className={`grid size-9 shrink-0 place-items-center rounded-lg sm:size-10 ${tone}`}><I className="size-4 sm:size-5" /></span><div className="min-w-0"><div className="text-xs leading-tight text-slate-500">{label}</div><div className="truncate text-lg font-bold sm:text-xl">{value}</div></div></Card>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={School} label="Môn / lớp có điểm" value={graded.length} tone="bg-orange-100 text-orange-700" />
        <Stat icon={AlertCircle} label="Điểm trung bình (thang 10)" value={avg != null ? avg.toFixed(2) : "-"} tone="bg-green-100 text-green-700" />
        <Stat icon={CalendarCheck} label="Điểm cao nhất" value={best ? `${best.norm!.toFixed(2)} · ${best.c.name}` : "-"} tone="bg-sky-100 text-sky-700" />
        <Stat icon={Wallet} label="Nhận xét" value={remarks.length} tone="bg-yellow-100 text-yellow-700" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {cards.map(({ c, t, m, total, norm, rank }) => {
          const band = norm != null ? bandOf(norm) : null;
          return (
            <Card key={c.id} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div><div className="text-base font-semibold">{c.name}</div><div className="text-xs text-slate-500">GV: {c.teacher?.fullName ?? "-"} · {t.name}</div></div>
                <div className="text-right"><div className="text-2xl font-bold leading-none" style={{ color: band?.color }}>{total ?? "-"}</div><div className="mt-1 text-xs font-medium" style={{ color: band?.color }}>{rank || "Chưa đủ điểm"}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {t.columns.map((col) => {
                  const v = m[col.id];
                  return (
                    <div key={col.id} className="rounded-md border p-2.5">
                      <div className="truncate text-xs text-slate-500">{col.name}</div>
                      <div className="text-lg font-bold">{v ?? "-"}<span className="text-xs font-normal text-slate-400">/{col.maxScore}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-1.5 rounded-full" style={{ width: `${v != null ? Math.min(100, (v / col.maxScore) * 100) : 0}%`, background: v != null ? bandOf((v / col.maxScore) * 10).color : undefined }} /></div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
        {!cards.length && <Card className="py-10 text-center text-sm text-slate-500 xl:col-span-2">Chưa có bảng điểm nào.</Card>}
      </div>

      <Card className="p-0">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Nhận xét của giáo viên</h2></div>
        <ul className="divide-y text-sm">
          {remarks.map((r) => <li key={r.id} className="px-4 py-3"><div className="text-xs text-slate-500">{fmtDate(r.createdAt)} · {r.author}</div><div>{r.content}</div></li>)}
          {!remarks.length && <li className="px-4 py-8 text-center text-slate-500">Chưa có nhận xét.</li>}
        </ul>
      </Card>
    </div>
  );
}

/** Trang con của cổng học viên/phụ huynh: một mục riêng cho mỗi trang. */
export async function PortalSection({ searchParams, title, sections, path, paged }: { searchParams: Promise<SP>; title: string; sections: Section[]; path: string; paged?: boolean }) {
  const me = await requireRole("STUDENT", "PARENT");
  const sp = await searchParams;
  const { kids, kid } = await portalKids(me, sp.child);
  if (!kid) notFound();
  const ap = getPaging({ size: sp.size, page: sp.page }, 15);
  const isAtt = sections.length === 1 && sections[0] === "attendance";

  // Điểm danh: lọc theo lớp + tóm tắt số buổi theo trạng thái
  let classes: { id: string; name: string }[] = [];
  let sum: { present: number; late: number; excused: number; absent: number } | null = null;
  if (isAtt) {
    classes = await db.class.findMany({ where: { sessions: { some: { attendances: { some: { studentId: kid.id } } } } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    const g = await db.attendance.groupBy({ by: ["status"], _count: true, where: { studentId: kid.id, status: { not: "PENDING" }, ...(sp.classId ? { session: { classId: sp.classId } } : {}) } });
    const n = (s: string) => g.find((x) => x.status === s)?._count ?? 0;
    sum = { present: n("PRESENT"), late: n("LATE"), excused: n("ABSENT_EXCUSED"), absent: n("ABSENT") };
  }
  const all = sum ? sum.present + sum.late + sum.excused + sum.absent : 0;

  return (
    <div className="space-y-4">
      <Title>{title} <span className="text-sm font-normal text-slate-500">· {kid.fullName} ({kid.code})</span></Title>
      <Kids kids={kids} kid={kid} path={path} />
      {isAtt && (() => {
        const href = (v: string) => `?${new URLSearchParams(Object.entries({ view: v, child: kid.id, classId: sp.classId }).filter(([, x]) => x) as [string, string][])}`;
        const view = sp.view === "list" ? "list" : "calendar";
        return <Tabs current={href(view)} items={[[href("calendar"), "Lịch tháng"], [href("list"), "Danh sách"]]} />;
      })()}
      {isAtt && sum && (
        <>
          <Card className="p-3">
            <AutoForm className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="child" value={kid.id} />
              <input type="hidden" name="view" value={sp.view === "list" ? "list" : "calendar"} />
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Lớp
                <select name="classId" defaultValue={sp.classId ?? ""} className="h-9 rounded-md border bg-white px-3 text-sm"><option value="">Tất cả lớp</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </label>
            </AutoForm>
          </Card>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {[["Có mặt", sum.present, "text-green-700"], ["Đi muộn", sum.late, "text-yellow-700"], ["Vắng có phép", sum.excused, "text-sky-700"], ["Vắng", sum.absent, "text-red-600"], ["Chuyên cần", all ? `${Math.round(((sum.present + sum.late) / all) * 100)}%` : "-", ""]].map(([l, v, c]) => (
              <Card key={String(l)} className="p-4"><div className="text-xs text-slate-500">{l}</div><div className={`text-2xl font-bold ${c}`}>{v}</div></Card>
            ))}
          </div>
        </>
      )}
      {sections.length === 1 && sections[0] === "invoices" ? <FeesView kidId={kid.id} path={path} sp={sp} /> : null}
      {sections.length === 1 && sections[0] === "grades" ? <GradesView kidId={kid.id} /> : null}
      {isAtt && sp.view !== "list" ? <AttendanceCalendar kidId={kid.id} path={path} sp={sp} /> : null}
      {!(isAtt && sp.view !== "list") && !(sections.length === 1 && (sections[0] === "invoices" || sections[0] === "grades")) && <StudentOverview
        studentId={kid.id} invoiceBase="/hoa-don" sections={sections} classId={sp.classId}
        attPaging={paged ? { page: ap.page, size: ap.size, path, params: { child: kid.id, classId: sp.classId, size: sp.size }, pageKey: "page" } : undefined}
      />}
    </div>
  );
}

/** Trang chủ cổng học viên/phụ huynh: tóm tắt nhanh. */
export async function PortalHome({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireRole("STUDENT", "PARENT");
  const sp = await searchParams;
  const { kids, kid } = await portalKids(me, sp.child);
  if (!kid) return <div className="space-y-4"><Title>Xin chào</Title><p className="text-slate-500">Tài khoản này chưa liên kết với học viên nào.</p></div>;

  const today = todayUTC();
  const nowVN = new Date(Date.now() + 7 * 3600_000);
  const nowMin = nowVN.getUTCHours() * 60 + nowVN.getUTCMinutes();
  const [row] = await loadStudents({ id: kid.id });
  const learnerSessions = { class: { enrollments: { some: { studentId: kid.id, status: "ACTIVE" as const } } } };
  const [enr, att, invoices, week, remarks, gradeClasses, gvalues, notis] = await Promise.all([
    db.enrollment.findMany({ where: { studentId: kid.id, status: "ACTIVE" }, include: { class: { include: { teacher: true } } } }),
    db.attendance.groupBy({ by: ["status"], where: { studentId: kid.id, status: { not: "PENDING" } }, _count: true }),
    db.invoice.findMany({ where: { studentId: kid.id, status: { in: ["UNPAID", "PARTIAL"] } }, orderBy: { dueDate: "asc" } }),
    db.session.findMany({ where: { date: { gte: today, lte: addDays(today, 7) }, status: { not: "CANCELLED" }, ...learnerSessions }, orderBy: [{ date: "asc" }, { startTime: "asc" }], include: { class: true, room: { include: { branch: true } }, teacher: true } }),
    db.remark.findMany({ where: { studentId: kid.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.class.findMany({ where: { gradeTemplateId: { not: null }, enrollments: { some: { studentId: kid.id } } }, include: { gradeTemplate: { include: { columns: { orderBy: { order: "asc" } } } } }, orderBy: { name: "asc" } }),
    db.gradeValue.findMany({ where: { studentId: kid.id } }),
    db.notification.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" }, take: 4 }),
  ]);
  const total = att.reduce((n, a) => n + a._count, 0);
  const present = att.filter((a) => ["PRESENT", "LATE"].includes(a.status)).reduce((n, a) => n + a._count, 0);
  const debt = invoices.reduce((n, i) => n + i.total - i.paid, 0);

  const grades = gradeClasses.map((c) => {
    const t = c.gradeTemplate!;
    const m: Record<string, number> = {};
    for (const v of gvalues.filter((v) => v.classId === c.id)) m[v.columnId] = v.value;
    const tot = computeTotal(t, t.columns, m);
    return { c, tot, norm: tot == null ? null : (tot / t.scale) * 10, rank: rankOf(tot, t.ranks) };
  });
  const gAvg = grades.filter((g) => g.norm != null);
  const avg = gAvg.length ? gAvg.reduce((a, g) => a + g.norm!, 0) / gAvg.length : null;

  // hôm nay & buổi kế tiếp
  const todayList = week.filter((s) => s.date.getTime() === today.getTime());
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const nextToday = todayList.find((s) => toMin(s.startTime) > nowMin);
  const next = nextToday ?? week.find((s) => s.date.getTime() > today.getTime());
  const inMin = nextToday ? toMin(nextToday.startTime) - nowMin : null;
  const hello = nowVN.getUTCHours() < 11 ? "Chào buổi sáng" : nowVN.getUTCHours() < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  const byDay = new Map<number, typeof week>();
  for (const s of week) byDay.set(s.date.getTime(), [...(byDay.get(s.date.getTime()) ?? []), s]);

  const Stat = ({ icon: I, label, value, tone = "bg-orange-100 text-orange-700", vt = "" }: { icon: typeof Wallet; label: string; value: React.ReactNode; tone?: string; vt?: string }) => (
    <Card className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4"><span className={`grid size-9 shrink-0 place-items-center rounded-lg sm:size-10 ${tone}`}><I className="size-4 sm:size-5" /></span><div className="min-w-0"><div className="text-xs leading-tight text-slate-500">{label}</div><div className={`truncate text-lg font-bold sm:text-xl ${vt}`}>{value}</div></div></Card>
  );

  return (
    <div className="space-y-4">
      {/* ===== Lời chào + việc hôm nay ===== */}
      <div className="rounded-xl p-5 text-white" style={{ background: "linear-gradient(135deg, var(--color-orange-600), var(--color-orange-800))" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm opacity-90">{hello},</div>
            <div className="text-2xl font-bold">{kid.fullName}</div>
            <div className="mt-1 text-sm opacity-90">{kid.code} · {STATUS_LABEL[row.status]}{kid.gradeLevel ? ` · ${kid.gradeLevel}` : ""}</div>
          </div>
          <div className="min-w-64 rounded-lg bg-white/15 p-3 text-sm">
            {todayList.length ? (
              <>
                <div className="font-semibold">Hôm nay có {todayList.length} buổi học</div>
                <ul className="mt-1 space-y-0.5">{todayList.map((s) => <li key={s.id} className={toMin(s.endTime) <= nowMin ? "opacity-60 line-through" : ""}>{s.startTime}–{s.endTime} · {s.class.name}{s.room ? ` · ${roomLabel(s.room)}` : ""}</li>)}</ul>
                {inMin != null && <div className="mt-2 font-medium">Buổi kế tiếp sau {inMin >= 60 ? `${Math.floor(inMin / 60)} giờ ${inMin % 60} phút` : `${inMin} phút`}</div>}
              </>
            ) : next ? (
              <><div className="font-semibold">Hôm nay không có lớp</div><div className="mt-1">Buổi kế tiếp: {WEEKDAYS[next.date.getUTCDay()]}, {fmtDate(next.date)} lúc {next.startTime} · {next.class.name}</div></>
            ) : <div className="font-semibold">Hôm nay không có lớp</div>}
          </div>
        </div>
      </div>
      <Kids kids={kids} kid={kid} path="/" />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Stat icon={School} label="Lớp đang học" value={enr.length} />
        <Stat icon={CalendarCheck} label="Số buổi còn lại" value={row.remain ?? "-"} tone="bg-sky-100 text-sky-700" />
        <Stat icon={AlertCircle} label="Chuyên cần" value={total ? `${Math.round((present / total) * 100)}%` : "-"} tone="bg-green-100 text-green-700" />
        <Stat icon={Award} label="Điểm trung bình (thang 10)" value={avg != null ? avg.toFixed(2) : "-"} tone="bg-yellow-100 text-yellow-700" />
        <Link href={`/hoc-phi-cua-toi?child=${kid.id}`}><Stat icon={Wallet} label="Còn nợ học phí" value={fmtMoney(debt)} tone="bg-red-100 text-red-700" vt={debt ? "text-red-600" : ""} /></Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Lịch học 7 ngày tới</h2><Link href={`/lich-hoc?child=${kid.id}`} className="text-sm text-orange-700 hover:underline">Xem lịch đầy đủ →</Link></div>
            <div className="divide-y">
              {[...byDay.entries()].map(([t, list]) => {
                const d = new Date(t);
                return (
                  <div key={t} className="flex gap-4 px-4 py-3">
                    <div className={`w-16 shrink-0 rounded-lg p-2 text-center ${t === today.getTime() ? "bg-orange-600 text-white" : "bg-slate-100"}`}><div className="text-[11px] uppercase">{WEEKDAYS[d.getUTCDay()]}</div><div className="text-xl font-bold leading-tight">{d.getUTCDate()}</div><div className="text-[11px] opacity-80">Th {d.getUTCMonth() + 1}</div></div>
                    <ul className="min-w-0 flex-1 space-y-1.5 self-center text-sm">{list.map((s) => <li key={s.id}><b className="tabular-nums">{s.startTime}–{s.endTime}</b> · {s.class.name}<div className="text-xs text-slate-500">{s.teacher?.fullName ?? "-"}{s.room ? ` · ${roomLabel(s.room)}` : ""}</div></li>)}</ul>
                  </div>
                );
              })}
              {!byDay.size && <p className="px-4 py-8 text-center text-sm text-slate-500">Không có buổi học nào trong 7 ngày tới.</p>}
            </div>
          </Card>

          <AttendanceCalendar kidId={kid.id} path="/diem-danh-cua-toi" sp={{ child: kid.id }} mini />

          <Card className="p-0">
            <div className="border-b px-4 py-3"><h2 className="font-semibold">Tiến độ khoá học</h2></div>
            <ul className="divide-y">
              {enr.map((e) => {
                const pct = Math.min(100, Math.round((e.usedSessions / Math.max(e.totalSessions, 1)) * 100));
                return (
                  <li key={e.id} className="space-y-1.5 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2"><b>{e.class.name}</b><span className="text-xs text-slate-500">GV {e.class.teacher?.fullName ?? "-"} · kết thúc dự kiến {fmtDate(e.class.endDate)}</span></div>
                    <div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-2 rounded-full bg-orange-500" style={{ width: `${pct}%` }} /></div><span className="w-28 text-right text-xs text-slate-500">{e.usedSessions}/{e.totalSessions} buổi · còn {Math.max(e.totalSessions - e.usedSessions, 0)}</span></div>
                  </li>
                );
              })}
              {!enr.length && <li className="px-4 py-8 text-center text-sm text-slate-500">Chưa có lớp nào.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Học phí cần đóng</h2><Link href={`/hoc-phi-cua-toi?child=${kid.id}`} className="text-sm text-orange-700 hover:underline">Tất cả →</Link></div>
            <ul className="divide-y text-sm">
              {invoices.map((i) => {
                const late = i.dueDate && i.dueDate < today;
                return (
                  <li key={i.id}><Link href={`/hoa-don/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                    <div><div className="font-semibold text-orange-700">{i.code}</div><div className={`text-xs ${late ? "font-medium text-red-600" : "text-slate-500"}`}>{late ? "Quá hạn " : "Hạn "}{fmtDate(i.dueDate)}</div></div>
                    <div className="text-right"><div className="font-bold text-red-600">{fmtMoney(i.total - i.paid)}</div><div className="text-xs text-orange-700">Xem & quét QR →</div></div>
                  </Link></li>
                );
              })}
              {!invoices.length && <li className="flex items-center gap-2 px-4 py-6 text-green-700"><CalendarCheck className="size-4" /> Không có khoản nào cần đóng.</li>}
            </ul>
          </Card>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Điểm số</h2><Link href={`/diem-cua-toi?child=${kid.id}`} className="text-sm text-orange-700 hover:underline">Chi tiết →</Link></div>
            <ul className="divide-y text-sm">
              {grades.map((g) => {
                const band = g.norm != null ? bandOf(g.norm) : null;
                return <li key={g.c.id} className="flex items-center justify-between gap-3 px-4 py-2.5"><span className="min-w-0 truncate">{g.c.name}</span><span className="shrink-0 font-bold" style={{ color: band?.color }}>{g.tot ?? "-"} <span className="text-xs font-normal">{g.rank}</span></span></li>;
              })}
              {!grades.length && <li className="px-4 py-6 text-center text-slate-500">Chưa có điểm.</li>}
            </ul>
          </Card>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Thông báo mới</h2><Link href="/thong-bao" className="text-sm text-orange-700 hover:underline">Xem →</Link></div>
            <ul className="divide-y text-sm">
              {notis.map((n) => <li key={n.id} className="px-4 py-2.5"><div className="flex items-center gap-2"><span className="font-medium">{n.title}</span>{!n.read && <i className="size-2 rounded-full bg-red-500" />}</div><div className="line-clamp-2 text-xs text-slate-500">{n.body}</div></li>)}
              {!notis.length && <li className="px-4 py-6 text-center text-slate-500">Chưa có thông báo.</li>}
            </ul>
          </Card>

          <Card className="p-0">
            <div className="border-b px-4 py-3"><h2 className="font-semibold">Nhận xét gần đây</h2></div>
            <ul className="divide-y text-sm">
              {remarks.map((r) => <li key={r.id} className="px-4 py-3"><div className="text-xs text-slate-500">{fmtDate(r.createdAt)} · {r.author}</div><div>{r.content}</div></li>)}
              {!remarks.length && <li className="px-4 py-6 text-center text-slate-500">Chưa có nhận xét.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
