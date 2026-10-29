import Link from "next/link";
import { db } from "@/lib/db";
import { Card, Table } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { computeTotal, rankOf } from "@/lib/grade";
import { WEEKDAYS, fmtDate, fmtMoney, isoDate } from "@/lib/format";

const ST: Record<string, string> = { PRESENT: "Có mặt", LATE: "Muộn", ABSENT_EXCUSED: "Vắng có phép", ABSENT: "Vắng", PENDING: "Chờ học bù" };

export type Section = "courses" | "calendar" | "attendance" | "grades" | "invoices";

export async function StudentOverview({ studentId, invoiceBase, sections, attPaging }: {
  studentId: string; invoiceBase: string; sections?: Section[];
  attPaging?: { page: number; size: number; path: string; params: Record<string, string | undefined>; pageKey: string };
}) {
  const show = (k: Section) => !sections || sections.includes(k);
  const [enrollments, atts, gradeClasses, remarks, invoices] = await Promise.all([
    db.enrollment.findMany({ where: { studentId }, include: { class: { include: { schedules: true, sessions: true } } }, orderBy: { startDate: "desc" } }),
    db.attendance.findMany({ where: { studentId }, include: { session: { include: { class: true } } }, orderBy: { session: { date: "desc" } } }),
    db.class.findMany({
      where: { gradeTemplateId: { not: null }, enrollments: { some: { studentId } } },
      include: { gradeTemplate: { include: { columns: { orderBy: { order: "asc" } } } }, },
    }),
    db.remark.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.invoice.findMany({ where: { studentId }, orderBy: { issueDate: "desc" } }),
  ]);

  const gradeValues = await db.gradeValue.findMany({ where: { studentId } });

  // lịch: buổi của các lớp đang học + buổi học bù
  const cell = new Map<string, { label: string; cls: string }>();
  for (const e of enrollments.filter((e) => e.status === "ACTIVE" || e.status === "PAUSED")) {
    for (const s of e.class.sessions) {
      if (s.isMakeup) continue;
      const k = isoDate(s.date);
      const a = atts.find((x) => x.sessionId === s.id);
      if (s.status === "CANCELLED") cell.set(k, { label: "Nghỉ", cls: "bg-gray-200 text-gray-500" });
      else if (a) cell.set(k, a.status === "PRESENT" || a.status === "LATE" ? { label: "Đã học", cls: "bg-green-300" } : { label: ST[a.status], cls: "bg-red-200" });
      else cell.set(k, { label: s.status === "DONE" ? "Đã học" : "Chưa học", cls: s.status === "DONE" ? "bg-green-300" : "bg-yellow-200" });
    }
  }
  for (const a of atts.filter((a) => a.makeupForId)) cell.set(isoDate(a.session.date), { label: "Học bù", cls: "bg-purple-200" });
  const keys = [...cell.keys()].sort();
  const months: string[] = [];
  if (keys.length) {
    let [y, m] = keys[0].split("-").map(Number);
    const [ey, em] = keys[keys.length - 1].split("-").map(Number);
    while ((y < ey || (y === ey && m <= em)) && months.length < 12) {
      months.push(`${y}-${String(m).padStart(2, "0")}`);
      if (++m > 12) { m = 1; y++; }
    }
  }
  const today = isoDate(new Date());

  return (
    <div className="space-y-4">
      {show("courses") && (
      <Card className="space-y-1">
        <h2 className="font-semibold">Khoá học</h2>
        {enrollments.map((e) => (
          <div key={e.id} className="text-sm">
            <b>{e.class.name}</b> · {e.class.schedules.map((s) => `${WEEKDAYS[s.weekday]} ${s.startTime}-${s.endTime}`).join(", ")} ·{" "}
            đã học <b>{e.usedSessions}/{e.totalSessions}</b>, còn <b className="text-orange-600">{Math.max(e.totalSessions - e.usedSessions, 0)} buổi</b> · {e.status}
          </div>
        ))}
        {!enrollments.length && <p className="text-sm text-gray-500">Chưa có lớp.</p>}
      </Card>
      )}

      {show("calendar") && (
      <Card>
        <h2 className="font-semibold mb-2">Lịch học</h2>
        <div className="flex gap-3 text-xs mb-2 flex-wrap">
          <span className="px-2 bg-green-300 rounded">Đã học</span><span className="px-2 bg-yellow-200 rounded">Chưa học</span>
          <span className="px-2 bg-red-200 rounded">Vắng</span><span className="px-2 bg-purple-200 rounded">Học bù</span><span className="px-2 bg-gray-200 rounded">Lớp nghỉ</span>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {months.map((mo) => {
            const [y, m] = mo.split("-").map(Number);
            const first = new Date(Date.UTC(y, m - 1, 1));
            const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
            const pad = (first.getUTCDay() + 6) % 7;
            return (
              <div key={mo} className="border rounded-lg p-2">
                <div className="font-medium text-sm mb-1">Tháng {m}/{y}</div>
                <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-gray-500">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => <div key={d}>{d}</div>)}</div>
                <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
                  {Array.from({ length: pad }).map((_, i) => <div key={"p" + i} />)}
                  {Array.from({ length: days }).map((_, i) => {
                    const k = `${mo}-${String(i + 1).padStart(2, "0")}`;
                    const c = cell.get(k);
                    return <div key={k} title={c?.label} className={`rounded py-1 ${c ? c.cls : "bg-orange-50"} ${k === today ? "ring-2 ring-blue-500" : ""}`}>{i + 1}</div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      )}

      {show("attendance") && (
      <Card>
        <h2 className="font-semibold mb-2">Điểm danh gần đây</h2>
        <Table head={["Ngày", "Lớp", "Trạng thái", "Ghi chú"]}>
          {atts.slice(attPaging ? (attPaging.page - 1) * attPaging.size : 0, attPaging ? attPaging.page * attPaging.size : 20).map((a) => (
            <tr key={a.id}><td>{fmtDate(a.session.date)}</td><td>{a.session.class.name}</td><td>{ST[a.status]}</td><td>{a.note}</td></tr>
          ))}
        </Table>
        {attPaging && <Pagination total={atts.length} page={attPaging.page} size={attPaging.size} path={attPaging.path} params={attPaging.params} pageKey={attPaging.pageKey} />}
      </Card>
      )}

      {show("grades") && (
      <Card>
        <h2 className="font-semibold mb-2">Bảng điểm & nhận xét</h2>
        {gradeClasses.map((gc) => {
          const t = gc.gradeTemplate!;
          const vs = gradeValues.filter((v) => v.classId === gc.id);
          const byCol: Record<string, number> = {};
          for (const v of vs) byCol[v.columnId] = v.value;
          const total = computeTotal(t, t.columns, byCol);
          return (
            <div key={gc.id} className="mb-3">
              <div className="text-sm font-medium">{gc.name}</div>
              <Table head={[...t.columns.map((c) => c.name), "Tổng", "Xếp loại"]}>
                <tr>{t.columns.map((c) => <td key={c.id}>{byCol[c.id] ?? "-"}</td>)}<td className="font-bold">{total ?? "-"}</td><td>{rankOf(total, t.ranks)}</td></tr>
              </Table>
            </div>
          );
        })}
        {!gradeClasses.length && <p className="text-sm text-gray-500">Chưa có bảng điểm.</p>}
        <div className="mt-3 space-y-1 text-sm">
          {remarks.map((r) => <div key={r.id} className="border-l-4 border-orange-300 pl-2"><span className="text-xs text-gray-500">{fmtDate(r.createdAt)} · {r.author}</span><div>{r.content}</div></div>)}
        </div>
      </Card>
      )}

      {show("invoices") && (
      <Card>
        <h2 className="font-semibold mb-2">Học phí</h2>
        <Table head={["Phiếu", "Ngày", "Tổng", "Đã thu", "Trạng thái"]}>
          {invoices.map((i) => (
            <tr key={i.id}><td><Link className="underline" href={`${invoiceBase}/${i.id}`}>{i.code}</Link></td><td>{fmtDate(i.issueDate)}</td><td>{fmtMoney(i.total)}</td><td>{fmtMoney(i.paid)}</td><td>{{ UNPAID: "Chưa đóng", PARTIAL: "Đóng một phần", PAID: "Đã đóng", VOID: "Huỷ" }[i.status]}</td></tr>
          ))}
        </Table>
      </Card>
      )}
    </div>
  );
}
