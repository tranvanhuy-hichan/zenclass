const B = ({ className = "" }: { className?: string }) => <div className={`animate-pulse rounded-md bg-slate-200/80 ${className}`} />;

export function HeadSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <B className="h-7 w-56" />
      {action && <B className="h-9 w-36" />}
    </div>
  );
}

export function CardsSkeleton({ n = 9, cols = "md:grid-cols-2 xl:grid-cols-3" }: { n?: number; cols?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${cols}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-lg border bg-white p-4">
          <B className="h-3 w-16" /><B className="h-5 w-2/3" /><B className="h-3 w-full" /><B className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="flex gap-4 border-b bg-slate-50 px-3 py-3">{Array.from({ length: cols }).map((_, i) => <B key={i} className="h-3 flex-1" />)}</div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b px-3 py-3 last:border-0">{Array.from({ length: cols }).map((_, i) => <B key={i} className="h-4 flex-1" />)}</div>
      ))}
    </div>
  );
}

export function ToolbarSkeleton() {
  return <div className="mb-4 flex gap-2"><B className="h-9 flex-1" /><B className="h-9 w-20" /></div>;
}

export function TabsSkeleton({ n = 6 }: { n?: number }) {
  return <div className="mb-4 flex gap-2">{Array.from({ length: n }).map((_, i) => <B key={i} className="h-8 w-24 rounded-full" />)}</div>;
}

export function FormSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="rounded-lg border bg-white p-4">
          <B className="mb-4 h-4 w-40" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="space-y-1.5"><B className="h-3 w-24" /><B className="h-9 w-full" /></div>)}
          </div>
        </div>
      ))}
      <B className="h-9 w-48" />
    </div>
  );
}

export function StatsSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="space-y-2 rounded-lg border bg-white p-4"><B className="h-3 w-24" /><B className="h-7 w-16" /></div>)}
    </div>
  );
}

export function WeekSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {Array.from({ length: 7 }).map((_, d) => (
        <div key={d} className="space-y-2 rounded-lg border bg-white p-2">
          <B className="h-3 w-20" />
          {Array.from({ length: 2 + (d % 3) }).map((_, i) => <B key={i} className="h-14 w-full" />)}
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <HeadSkeleton />
      <div className="rounded-lg border bg-white p-4 space-y-3"><B className="h-4 w-40" /><B className="h-9 w-full" /><B className="h-9 w-2/3" /></div>
      <TableSkeleton rows={5} cols={4} />
      <div className="rounded-lg border bg-white p-4 space-y-3"><B className="h-4 w-32" /><B className="h-24 w-full" /></div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div>
      <HeadSkeleton />
      <CardsSkeleton n={6} />
    </div>
  );
}
