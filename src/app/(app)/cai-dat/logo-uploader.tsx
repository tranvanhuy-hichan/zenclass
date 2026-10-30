"use client";
import { useActionState, useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import { removeLogo, saveLogo } from "./actions";

/** Chọn ảnh → thu nhỏ còn tối đa 256px ngay trên trình duyệt → tải lên. */
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Không đọc được ảnh")); i.src = url; });
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) throw new Error("Ảnh không hợp lệ");
    const k = Math.min(1, 256 / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob((x) => (x ? res(x) : rej(new Error("Không đọc được ảnh"))), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

export function LogoUploader({ current, isDefault }: { current: string; isDefault: boolean }) {
  const [saveRes, saveAction, saving] = useActionState(saveLogo, null);
  const [rmRes, rmAction, removing] = useActionState(removeLogo, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function pick(f?: File) {
    setErr("");
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setErr("Chỉ nhận ảnh PNG, JPG hoặc WebP");
    try { const b = await shrink(f); setBlob(b); setPreview(URL.createObjectURL(b)); } catch (e) { setErr((e as Error).message || "Không đọc được ảnh này"); }
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview ?? current} alt="Logo" className="size-20 rounded-2xl border bg-white object-contain p-1" />
      <div className="space-y-2">
        <div className="text-sm text-slate-600">{isDefault && !preview ? "Đang dùng logo mặc định của hệ thống." : "Logo riêng của trung tâm."} Logo hiển thị ở menu, trang đăng nhập và làm biểu tượng trên thẻ trình duyệt.</div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <button type="button" onClick={() => input.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-sm hover:bg-slate-50"><ImageUp className="size-4" /> Chọn ảnh</button>
          {blob && (
            <form action={(fd) => { fd.set("file", new File([blob], "logo.png", { type: "image/png" })); saveAction(fd); setBlob(null); }}>
              <button disabled={saving} className="h-9 rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu logo"}</button>
            </form>
          )}
          {!isDefault && !blob && (
            <form action={rmAction}><button disabled={removing} className="h-9 rounded-md px-3 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">Dùng logo mặc định</button></form>
          )}
        </div>
        <p className="text-xs text-slate-500">Nên dùng ảnh vuông (PNG nền trong suốt càng tốt). Ảnh được thu nhỏ tự động.</p>
        {(err || saveRes?.error || rmRes?.error) && <p className="text-sm text-red-600">{err || saveRes?.error || rmRes?.error}</p>}
        {(saveRes?.ok || rmRes?.ok) && !blob && <p className="text-sm text-green-700">{saveRes?.ok || rmRes?.ok}</p>}
      </div>
    </div>
  );
}
