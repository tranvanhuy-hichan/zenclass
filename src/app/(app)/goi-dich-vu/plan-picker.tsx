"use client";
import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { createOrder } from "./actions";

type Plan = { code: string; name: string; monthlyPrice: number; maxStudents: number; maxBranches: number; features: string[] };
type Price = { base: number; pct: number; total: number };
const DUR = [1, 3, 6, 12];
const vnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`;

/** Chọn gói + kỳ hạn rồi tạo đơn. */
export function PlanPicker({ current, plans, prices, hasPending }: { current: string; plans: Plan[]; prices: Record<string, Record<number, Price>>; hasPending: boolean }) {
  const [plan, setPlan] = useState(plans.find((p) => p.code === current)?.code ?? plans[0]?.code ?? "");
  const [months, setMonths] = useState(12);
  const [res, action, pending] = useActionState(createOrder, null);
  const p = prices[plan]?.[months];
  return (
    <form action={action} className="space-y-4 rounded-lg border bg-white p-5">
      <input type="hidden" name="plan" value={plan} /><input type="hidden" name="months" value={months} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Đăng ký / nâng cấp / gia hạn</h2>
        <div className="flex w-full overflow-hidden rounded-md border text-sm sm:w-auto">
          {DUR.map((m) => (
            <button type="button" key={m} onClick={() => setMonths(m)} className={`flex flex-1 flex-col items-center whitespace-nowrap px-2.5 py-1 leading-tight sm:flex-none sm:px-3 ${months === m ? "bg-orange-600 text-white" : "hover:bg-slate-50"} ${m > 1 ? "border-l" : ""}`}>
              <span>{m} tháng</span>
              <span className={`text-[11px] ${(prices[plan]?.[m]?.pct ?? 0) > 0 ? (months === m ? "text-orange-100" : "text-green-700") : "invisible"}`}>-{prices[plan]?.[m]?.pct ?? 0}%</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((x) => {
          const pr = prices[x.code][months];
          const on = plan === x.code;
          return (
            <button type="button" key={x.code} onClick={() => setPlan(x.code)} className={`flex flex-col gap-2 rounded-lg border p-4 text-left transition ${on ? "border-orange-600 ring-2 ring-orange-500/30" : "hover:border-orange-300"}`}>
              <div className="flex items-center justify-between"><b>{x.name}</b>{x.code === current && <span className="rounded bg-sky-100 px-1.5 text-[11px] text-sky-800">Đang dùng</span>}</div>
              <div><span className="text-xl font-bold text-orange-700">{vnd(Math.round(pr.total / months / 1000) * 1000)}</span><span className="text-xs text-slate-500"> / tháng</span></div>
              <ul className="space-y-1 text-xs text-slate-600">{x.features.map((f) => <li key={f} className="flex gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-green-600" />{f}</li>)}</ul>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm">
        <div>{p && <>Thành tiền <b className="text-lg text-orange-700">{vnd(p.total)}</b>{p.pct > 0 && <span className="ml-2 text-slate-500 line-through">{vnd(p.base)}</span>}<span className="ml-2 text-slate-500">cho {months} tháng</span></>}</div>
        <button disabled={pending || hasPending || !plan} className="h-10 rounded-md bg-orange-600 px-5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">{pending ? "Đang tạo đơn..." : "Tạo đơn & thanh toán"}</button>
      </div>
      {res?.error && <p className="text-sm text-red-600">{res.error}</p>}
      {res?.ok && <p className="text-sm text-green-700">{res.ok}</p>}
      <p className="text-xs text-slate-500">Gia hạn cùng gói sẽ được cộng nối tiếp vào hạn hiện tại. Đổi sang gói khác sẽ tính từ ngày kích hoạt.</p>
    </form>
  );
}
