/* Biểu đồ thuần HTML/CSS (không cần thư viện) — chạy được ở server component. */

export function BarList({ items, max, unit = "" }: { items: { label: string; value: number; color?: string; hint?: string }[]; max?: number; unit?: string }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate" title={i.label}>{i.label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-3 rounded-full" style={{ width: `${Math.min(100, (i.value / m) * 100)}%`, background: i.color ?? "var(--color-orange-500)" }} /></div>
          <span className="w-20 text-right tabular-nums"><b>{i.value}</b>{unit}{i.hint && <span className="ml-1 text-xs text-slate-500">{i.hint}</span>}</span>
        </li>
      ))}
    </ul>
  );
}

export function ColumnChart({ items, height = 160 }: { items: { label: string; value: number; color?: string }[]; height?: number }) {
  const m = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex items-end gap-2" style={{ height: height + 40 }}>
      {items.map((i) => (
        <div key={i.label} className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs font-semibold tabular-nums">{i.value}</span>
          <div className="w-full max-w-14 rounded-t" style={{ height: `${(i.value / m) * height}px`, minHeight: i.value ? 3 : 0, background: i.color ?? "var(--color-orange-500)" }} />
          <span className="text-center text-[11px] leading-tight text-slate-500">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ items, center }: { items: { label: string; value: number; color: string }[]; center?: React.ReactNode }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  let acc = 0;
  const stops = items.filter((i) => i.value > 0).map((i) => { const a = (acc / total) * 100; acc += i.value; return `${i.color} ${a}% ${(acc / total) * 100}%`; });
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative size-40 shrink-0 rounded-full" style={{ background: total ? `conic-gradient(${stops.join(",")})` : "var(--color-slate-200)" }}>
        <div className="absolute inset-6 grid place-items-center rounded-full text-center" style={{ background: "var(--surface)" }}>{center}</div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2"><i className="inline-block size-3 rounded-sm" style={{ background: i.color }} /><span className="w-24">{i.label}</span><b className="tabular-nums">{i.value}</b><span className="text-xs text-slate-500">{total ? `(${Math.round((i.value / total) * 100)}%)` : ""}</span></li>
        ))}
      </ul>
    </div>
  );
}
