/** Tiêu đề trang: luôn hiển thị, kèm các nút thao tác bên phải. */
export function Title({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h1 className="text-xl font-semibold tracking-tight">{children}</h1>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}
