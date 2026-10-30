"use client";
import { useActionState, useEffect, useState } from "react";
import { FONTS, PRESETS, themeCss, fontsHref, type Theme } from "@/lib/theme";
import { saveTheme, resetTheme } from "./actions";

const inp = "border rounded-lg px-3 py-2 text-sm bg-white";

export function ThemeEditor({ initial, name }: { initial: Theme; name: string }) {
  const [t, setT] = useState<Theme>(initial);
  const [cname, setName] = useState(name);
  const [res, save, pending] = useActionState(saveTheme, null);
  const [res2, reset, pending2] = useActionState(resetTheme, null);
  const set = <K extends keyof Theme>(k: K, v: Theme[K]) => setT((p) => ({ ...p, [k]: v }));

  // xem trước trực tiếp trên toàn trang
  useEffect(() => {
    const el = document.getElementById("theme-vars");
    if (el) el.textContent = themeCss(t);
    document.documentElement.dataset.dark = t.dark ? "1" : "0";
    const href = fontsHref(t);
    let link = document.getElementById("theme-font") as HTMLLinkElement | null;
    if (href) {
      if (!link) { link = document.createElement("link"); link.id = "theme-font"; link.rel = "stylesheet"; document.head.appendChild(link); }
      link.href = href;
    }
  }, [t]);

  const Color = ({ k, label }: { k: keyof Theme; label: string }) => (
    <label className="text-xs text-gray-600 flex flex-col gap-1">{label}
      <span className="flex gap-2 items-center"><input type="color" value={t[k] as string} onChange={(e) => set(k, e.target.value as never)} className="h-9 w-12 p-0 border rounded" /><code className="text-xs">{t[k] as string}</code></span>
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-4 space-y-2">
        <h2 className="font-semibold">Bộ giao diện có sẵn</h2>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(PRESETS).map(([n, p]) => (
            <button key={n} type="button" onClick={() => setT((x) => ({ ...x, ...p }))} className="border rounded-full px-3 py-1 text-sm flex items-center gap-2 bg-white">
              <span className="w-4 h-4 rounded-full" style={{ background: p.primary }} />{n}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 grid md:grid-cols-3 gap-4">
        <Color k="primary" label="Màu chủ đạo (nút, tiêu đề, điểm nhấn)" />
        <Color k="background" label="Màu nền trang" />
        <Color k="surface" label="Màu nền thẻ / bảng" />
        <Color k="sidebar" label="Màu nền menu trái" />
        <Color k="text" label="Màu chữ" />
        <Color k="line" label="Màu đường viền" />
        <label className="text-xs text-gray-600 flex flex-col gap-1">Kiểu chữ nội dung
          <select className={inp} value={t.font} onChange={(e) => set("font", e.target.value)}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></label>
        <label className="text-xs text-gray-600 flex flex-col gap-1">Kiểu chữ tiêu đề
          <select className={inp} value={t.headingFont} onChange={(e) => set("headingFont", e.target.value)}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></label>
        <label className="text-xs text-gray-600 flex flex-col gap-1">Cỡ chữ: {t.fontSize}px
          <input type="range" min={12} max={20} value={t.fontSize} onChange={(e) => set("fontSize", +e.target.value)} /></label>
        <label className="text-xs text-gray-600 flex flex-col gap-1">Độ bo viền thẻ/nút: {t.radius}px
          <input type="range" min={0} max={28} value={t.radius} onChange={(e) => set("radius", +e.target.value)} /></label>
        <div className="text-xs text-gray-600 flex flex-col gap-1">Logo<span className="rounded-md border bg-slate-50 px-3 py-2 text-sm">Đặt logo ở <a href="/cai-dat" className="text-orange-700 underline">Cài đặt → Trung tâm & ngân hàng</a></span></div>
        <label className="text-xs text-gray-600 flex flex-col gap-1">Tên trung tâm
          <input className={inp} value={cname} onChange={(e) => setName(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={t.dark} onChange={(e) => set("dark", e.target.checked)} /> Mặc định là chế độ tối (người dùng vẫn tự đổi được bằng nút ☾ trên thanh trên)</label>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-2">
        <h2 className="font-semibold">Xem trước</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <button type="button" className="bg-orange-600 text-white rounded-lg px-4 py-2 text-sm">Nút chính</button>
          <span className="bg-orange-100 text-orange-700 rounded-full px-3 py-1 text-sm">Nhãn</span>
          <span className="border rounded-lg px-3 py-2 text-sm">Thẻ viền</span>
          <span className="text-orange-600 font-semibold">Chữ nhấn</span>
        </div>
        <p>Đoạn chữ mẫu: Học viên Nguyễn Văn An — còn 3 buổi, học phí 3.000.000 đ.</p>
      </div>

      <form action={save} className="flex gap-2 flex-wrap items-center">
        <input type="hidden" name="theme" value={JSON.stringify(t)} />
        <input type="hidden" name="name" value={cname} />
        <button disabled={pending} className="bg-orange-600 text-white rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-50">{pending ? "..." : "Lưu giao diện"}</button>
        {res?.ok && <span className="text-green-700 text-sm">{res.ok}</span>}
        {res?.error && <span className="text-red-600 text-sm">{res.error}</span>}
      </form>
      <form action={reset} onSubmit={(e) => { if (!confirm("Khôi phục giao diện mặc định?")) e.preventDefault(); }}>
        <button disabled={pending2} className="border rounded-lg px-4 py-2 text-sm bg-white">Khôi phục mặc định</button>
        {res2?.ok && <span className="text-green-700 text-sm ml-2">{res2.ok}</span>}
      </form>
    </div>
  );
}
