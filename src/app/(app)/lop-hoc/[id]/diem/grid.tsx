"use client";
import { useActionState, useMemo, useState } from "react";
import { computeTotal, rankOf, type Col, type Tpl } from "@/lib/grade";
import { saveGrades } from "../../../hoc-tap/actions";

type Stu = { id: string; name: string; code: string };

export function GradeGrid({ classId, cols, tpl, students, initial }: { classId: string; cols: Col[]; tpl: Tpl; students: Stu[]; initial: Record<string, number> }) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])));
  const [res, action, pending] = useActionState(saveGrades, null);
  const parse = (s: string | undefined) => { if (s == null || s.trim() === "") return undefined; const n = parseFloat(s.replace(",", ".")); return Number.isFinite(n) ? n : undefined; };

  const rows = useMemo(() => students.map((s) => {
    const v: Record<string, number | undefined> = {};
    for (const c of cols) v[c.id] = parse(vals[`${s.id}|${c.id}`]);
    const total = computeTotal(tpl, cols, v);
    return { s, total, rank: rankOf(total, tpl.ranks) };
  }), [vals, students, cols, tpl]);

  const changed = () => {
    const out: { studentId: string; columnId: string; value: number | null }[] = [];
    for (const s of students) for (const c of cols) {
      const k = `${s.id}|${c.id}`;
      const now = parse(vals[k]);
      const before = initial[k];
      if (now !== before) out.push({ studentId: s.id, columnId: c.id, value: now ?? null });
    }
    return out;
  };
  const dirty = changed().length;
  const colAvg = (c: Col) => {
    const a = students.map((s) => parse(vals[`${s.id}|${c.id}`])).filter((x): x is number => x != null);
    return a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : "-";
  };
  const totals = rows.map((r) => r.total).filter((x): x is number => x != null);
  const classAvg = totals.length ? (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(2) : "-";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="rows" value={JSON.stringify(changed())} />
      <div className="max-h-[calc(100vh-13rem)] overflow-auto rounded-xl border bg-white">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead className="text-left">
            <tr>
              <th className="sticky left-0 top-0 z-30 w-12 min-w-12 border-b bg-orange-50 px-3 py-2">#</th><th className="sticky left-12 top-0 z-30 w-64 min-w-64 border-b border-r bg-orange-50 px-3 py-2">Học viên</th>
              {cols.map((c) => <th key={c.id} className="sticky top-0 z-20 min-w-28 border-b bg-orange-50 px-2 py-2 text-center">{c.name}<div className="text-[10px] font-normal text-gray-500">/{c.maxScore} · hs {c.weight} · <code>{c.key}</code></div></th>)}
              <th className="sticky right-28 top-0 z-30 w-20 min-w-20 border-b border-l bg-orange-50 px-3 py-2 text-center">Tổng</th><th className="sticky right-0 top-0 z-30 w-28 min-w-28 border-b bg-orange-50 px-3 py-2">Xếp loại</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, total, rank }, ri) => (
              <tr key={s.id} className="[&>td]:border-b">
                <td className="sticky left-0 z-10 w-12 min-w-12 bg-white px-3 py-1 text-gray-500">{ri + 1}</td>
                <td className="sticky left-12 z-10 w-64 min-w-64 whitespace-nowrap border-r bg-white px-3 py-1">{s.name} <span className="text-xs text-gray-500">{s.code}</span></td>
                {cols.map((c, ci) => {
                  const k = `${s.id}|${c.id}`;
                  const n = parse(vals[k]);
                  const bad = n != null && (n < 0 || n > c.maxScore);
                  return (
                    <td key={c.id} className="px-1 py-1 text-center">
                      <input
                        data-r={ri} data-c={ci} value={vals[k] ?? ""} inputMode="decimal"
                        onChange={(e) => setVals((p) => ({ ...p, [k]: e.target.value }))}
                        onKeyDown={(e) => {
                          const mv = e.key === "Enter" || e.key === "ArrowDown" ? [1, 0] : e.key === "ArrowUp" ? [-1, 0] : null;
                          if (!mv) return;
                          e.preventDefault();
                          (document.querySelector(`[data-r="${ri + mv[0]}"][data-c="${ci}"]`) as HTMLInputElement | null)?.focus();
                        }}
                        className={`w-16 text-center border rounded-lg px-1 py-1 bg-white ${bad ? "border-red-500 bg-red-50" : ""}`}
                      />
                    </td>
                  );
                })}
                <td className="sticky right-28 z-10 w-20 min-w-20 border-l bg-white px-3 py-1 text-center font-bold text-orange-700">{total ?? "-"}</td>
                <td className="sticky right-0 z-10 w-28 min-w-28 bg-white px-3 py-1">{rank}</td>
              </tr>
            ))}
            <tr className="text-center text-xs">
              <td colSpan={2} className="sticky left-0 z-10 border-r bg-orange-50 px-3 py-2 text-left font-medium">Trung bình lớp</td>
              {cols.map((c) => <td key={c.id} className="bg-orange-50">{colAvg(c)}</td>)}
              <td className="sticky right-28 z-10 border-l bg-orange-50 font-bold">{classAvg}</td><td className="sticky right-0 z-10 bg-orange-50" />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 items-center flex-wrap">
        <button disabled={pending || !dirty} className="bg-orange-600 text-white rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-50">{pending ? "Đang lưu..." : `Lưu điểm${dirty ? ` (${dirty} ô thay đổi)` : ""}`}</button>
        {res?.ok && <span className="text-green-700 text-sm">{res.ok}</span>}
        {res?.error && <span className="text-red-600 text-sm">{res.error}</span>}
        <span className="text-xs text-gray-500">Enter / ↓ để xuống dòng. Xoá ô để bỏ điểm.</span>
      </div>
    </form>
  );
}
