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
export { Tabs } from "@/components/tabs";
/** `bare`: dùng khi bảng đã nằm trong một Card — bỏ khung ngoài để không bị khung lồng khung. */
export function Table({ head, children, bare = false }: { head: string[]; children: React.ReactNode; bare?: boolean }) {
  return (
    <div className={bare ? "-mx-1 overflow-x-auto" : "overflow-x-auto rounded-lg border bg-white"}>
      <ResponsiveTable>
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>{head.map((h, i) => <th key={i} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="[&>tr]:border-t [&>tr:hover]:bg-slate-50 [&_td]:px-3 [&_td]:py-2.5">{children}</tbody>
      </ResponsiveTable>
    </div>
  );
}
