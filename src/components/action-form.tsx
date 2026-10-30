"use client";
import { useActionState, useEffect, useRef } from "react";
import { useDialogClose } from "@/components/dialog";
import type { Res } from "@/lib/action";

export function ActionForm({
  action,
  children,
  submit = "Lưu",
  className = "grid w-full grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  reset = true,
  danger = false,
  compact = false,
  ghost = false,
  block = false,
  confirmText,
}: {
  action: (p: Res, fd: FormData) => Promise<Res>;
  children?: React.ReactNode;
  submit?: React.ReactNode;
  className?: string;
  reset?: boolean;
  danger?: boolean;
  compact?: boolean;
  ghost?: boolean;
  /** Nút viền, cao 36px, rộng hết ô chứa — dùng cho cụm nút hành động trên điện thoại. */
  block?: boolean;
  confirmText?: string;
}) {
  const [res, fn, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const closeDialog = useDialogClose();
  // Trong hộp thoại: lưu xong thì tự đóng, trừ khi thông báo có mật khẩu cần người dùng đọc.
  useEffect(() => {
    if (closeDialog && res?.ok && !/mật khẩu/i.test(res.ok)) { const t = setTimeout(closeDialog, 600); return () => clearTimeout(t); }
  }, [res, closeDialog]);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        fn(fd);
        if (reset) setTimeout(() => ref.current?.reset(), 50);
      }}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
      className={className}
    >
      {children}
      <button
        disabled={pending}
        className={block
          ? `h-9 w-full whitespace-nowrap rounded-md border bg-white px-2 text-sm font-medium transition-colors disabled:opacity-50 ${danger ? "border-red-300 text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"}`
          : `${compact ? "h-9 px-3 text-sm sm:h-7 sm:px-2 sm:text-xs" : "h-9 px-4 text-sm"} justify-self-start whitespace-nowrap rounded-md font-medium transition-colors disabled:opacity-50 ${
          ghost ? (danger ? "text-red-600 hover:bg-red-50" : "text-orange-700 hover:bg-orange-50")
            // nút nhỏ trong dòng/bảng: viền nhẹ thay vì khối màu đặc để danh sách không bị "đỏ rực"
            : compact ? (danger ? "border border-red-300 bg-white text-red-600 hover:bg-red-50" : "border bg-white text-orange-700 hover:bg-orange-50")
            : `text-white ${danger ? "bg-red-700 hover:bg-red-800" : "bg-orange-600 hover:bg-orange-700"}`
        }`}>
        {pending ? "..." : submit}
      </button>
      {res?.error && <span className="col-span-full w-full text-sm text-red-600">{res.error}</span>}
      {res?.ok && <span className="col-span-full w-full whitespace-pre-line text-sm text-green-700">{res.ok}</span>}
    </form>
  );
}
