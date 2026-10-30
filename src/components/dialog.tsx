"use client";
import { createContext, useContext, useRef } from "react";
import { X } from "lucide-react";

const Ctx = createContext<(() => void) | null>(null);
/** Form trong hộp thoại gọi hàm này để tự đóng sau khi lưu thành công. */
export const useDialogClose = () => useContext(Ctx);

export function DialogButton({
  label, title, children, wide = false, variant = "primary", size = "md", block = false,
}: { label: React.ReactNode; title: string; children: React.ReactNode; wide?: boolean; variant?: "primary" | "secondary" | "ghost"; size?: "md" | "sm"; block?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium transition-colors ${block ? "h-9 w-full px-2 text-sm" : size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm"} ${variant === "primary" ? "bg-orange-600 text-white hover:bg-orange-700" : variant === "ghost" ? "text-orange-700 hover:bg-orange-50" : "border bg-white hover:bg-slate-50"}`}
      >
        {label}
      </button>
      <dialog
        ref={ref}
        onMouseDown={(e) => { if (e.target === ref.current) close(); }}
        className={`m-auto w-[min(94vw,${wide ? "860px" : "540px"})] rounded-lg border bg-white p-0 shadow-xl backdrop:bg-black/45`}
        style={{ width: `min(94vw, ${wide ? 860 : 540}px)`, color: "var(--fg)", background: "var(--surface)" }}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={close} className="rounded p-1 hover:bg-slate-100" aria-label="Đóng"><X className="size-5" /></button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto p-5">
          <Ctx.Provider value={close}>{children}</Ctx.Provider>
        </div>
      </dialog>
    </>
  );
}

/** Bấm vào một khối bất kỳ (vd: ô lịch) để mở hộp thoại. */
export function DialogTrigger({
  trigger, title, children, className = "", style, wide = false,
}: { trigger: React.ReactNode; title: string; children: React.ReactNode; className?: string; style?: React.CSSProperties; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={className} style={style}>{trigger}</button>
      <dialog
        ref={ref}
        onMouseDown={(e) => { if (e.target === ref.current) close(); }}
        className="m-auto rounded-lg border bg-white p-0 shadow-xl backdrop:bg-black/45"
        style={{ width: `min(94vw, ${wide ? 860 : 520}px)`, color: "var(--fg)", background: "var(--surface)" }}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={close} className="rounded p-1 hover:bg-slate-100" aria-label="Đóng"><X className="size-5" /></button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto p-5"><Ctx.Provider value={close}>{children}</Ctx.Provider></div>
      </dialog>
    </>
  );
}
