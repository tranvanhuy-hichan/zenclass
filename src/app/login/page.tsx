"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function Login() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const r = await signIn("credentials", {
      username: f.get("username"),
      password: f.get("password"),
      redirect: false,
    });
    setBusy(false);
    if (r?.ok) window.location.href = "/";
    else setErr("Sai tên đăng nhập hoặc mật khẩu");
  }

  return (
    <main className="min-h-screen grid place-items-center theme-bg p-4">
      <form onSubmit={submit} className="w-full max-w-sm overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="theme-sidebar px-6 py-5" style={{ color: "var(--sb-fg)" }}>
          <h1 className="text-lg font-semibold">Hệ thống quản lý trung tâm</h1>
          <p className="text-sm sb-muted">Đăng nhập để tiếp tục</p>
        </div>
        <div className="space-y-4 p-6">
          <label className="block text-xs font-medium text-slate-600">Tên đăng nhập / Mã học viên
            <input name="username" autoComplete="username" className="mt-1 h-10 w-full rounded-md border px-3 text-sm" required />
          </label>
          <label className="block text-xs font-medium text-slate-600">Mật khẩu
            <input name="password" type="password" autoComplete="current-password" className="mt-1 h-10 w-full rounded-md border px-3 text-sm" required />
          </label>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button disabled={busy} className="h-10 w-full rounded-md bg-orange-600 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">
            {busy ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
          <p className="text-xs text-slate-500">Học viên / phụ huynh: dùng mã hoặc SĐT và mật khẩu do trung tâm cấp.</p>
        </div>
      </form>
    </main>
  );
}
