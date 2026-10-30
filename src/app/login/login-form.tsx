"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";

export function LoginForm({ name, logo }: { name: string; logo: string }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr("");
    const f = new FormData(e.currentTarget);
    const r = await signIn("credentials", { username: f.get("username"), password: f.get("password"), redirect: false });
    if (r?.ok) { window.location.href = "/"; return; }
    setBusy(false);
    setErr(r?.error === "TENANT_SUSPENDED" ? "Trung tâm đang bị tạm khoá. Vui lòng liên hệ đơn vị cung cấp." : "Sai tên đăng nhập hoặc mật khẩu");
  }

  return (
    <main className="theme-bg relative grid min-h-screen place-items-center overflow-hidden p-4">
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full opacity-20 blur-3xl" style={{ background: "var(--sidebar)" }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 size-[28rem] rounded-full bg-orange-500 opacity-15 blur-3xl" />

      <div className="relative w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt="" className="size-16 rounded-2xl object-cover shadow-md" /> : (
            <div className="theme-sidebar grid size-16 place-items-center rounded-2xl text-2xl font-bold shadow-md" style={{ color: "var(--sb-fg)" }}>{name.slice(0, 1).toUpperCase()}</div>
          )}
          <h1 className="mt-4 text-xl font-semibold">{name}</h1>
          <p className="mt-1 text-sm text-slate-500">Hệ thống quản lý trung tâm</p>
        </div>

        <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-white p-7 shadow-lg">
          <div>
            <h2 className="text-lg font-semibold">Đăng nhập</h2>
            <p className="text-sm text-slate-500">Nhập tài khoản được trung tâm cấp cho bạn.</p>
          </div>

          <label className="block text-xs font-medium text-slate-600">Tên đăng nhập / Mã học viên
            <span className="relative mt-1 block">
              <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input name="username" autoComplete="username" autoFocus required className="h-11 w-full rounded-lg border bg-white pl-10 pr-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25" placeholder="vd: HV12345678" />
            </span>
          </label>

          <label className="block text-xs font-medium text-slate-600">Mật khẩu
            <span className="relative mt-1 block">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="h-11 w-full rounded-lg border bg-white pl-10 pr-11 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25" placeholder="••••••••" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>

          {err && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600"><AlertCircle className="size-4 shrink-0" />{err}</div>}

          <button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-orange-600 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-60">
            {busy ? <><Loader2 className="size-4 animate-spin" />Đang đăng nhập...</> : "Đăng nhập"}
          </button>

          <p className="text-center text-xs text-slate-500">Học viên và phụ huynh dùng mã học viên hoặc số điện thoại cùng mật khẩu do trung tâm cấp. Quên mật khẩu? Liên hệ trung tâm để được cấp lại.</p>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} {name}</p>
      </div>
    </main>
  );
}
