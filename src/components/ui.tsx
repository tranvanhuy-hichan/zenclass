import Link from "next/link";
import { ResponsiveTable } from "@/components/responsive-table";

export const inputCls = "h-9 border rounded-md px-3 text-sm bg-white";

export { Title } from "@/components/page-title";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const pad = /(^|\s)p-\d/.test(className) ? "" : "p-4";
  return <div className={`bg-white rounded-lg border ${pad} ${className}`}>{children}</div>;
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      {children}
    </label>
  );
}
export function Tabs({ items, current }: { items: [string, string][]; current: string }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b">
      {items.map(([href, label]) => (
        <Link key={href} href={href} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${current === href ? "border-orange-600 font-semibold text-orange-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          {label}
        </Link>
      ))}
    </div>
  );
}
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <ResponsiveTable>
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>{head.map((h, i) => <th key={i} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="[&>tr]:border-t [&>tr:hover]:bg-slate-50 [&_td]:px-3 [&_td]:py-2.5">{children}</tbody>
      </ResponsiveTable>
    </div>
  );
}
