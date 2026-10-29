"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { ArrowLeft, Bell, ChevronRight, KeyRound, LogOut, Menu, X } from "lucide-react";
import clsx from "clsx";
import { NAV, ROLE_LABEL, titleOf, type NavGroup } from "@/lib/nav";
import type { Role } from "@/lib/guard";
import { ModeToggle } from "@/components/layout/mode-toggle";

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

function Brand({ name, logo }: { name: string; logo: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 border-b sb-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logo ? <img src={logo} alt="" className="h-9 w-9 rounded-md object-cover shrink-0" /> : <div className="h-9 w-9 rounded-md bg-white/20 grid place-items-center font-bold shrink-0">{name.slice(0, 1).toUpperCase()}</div>}
      <div className="min-w-0 leading-tight hidden lg:block"><div className="text-[13px] font-semibold truncate">{name}</div><div className="text-xs sb-muted">Quản lý trung tâm</div></div>
    </div>
  );
}

function Links({ groups, path, badges, onNavigate, compact }: { groups: NavGroup[]; path: string; badges: Record<string, number>; onNavigate?: () => void; compact?: boolean }) {
  return (
    <>
      {groups.map((g, i) => (
        <div key={i} className="mb-2">
          {g.title && <div className={clsx("px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider sb-muted", compact && "hidden lg:block")}>{g.title}</div>}
          <div className="space-y-0.5">
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} onClick={onNavigate} title={it.label} data-active={isActive(path, it.href)}
                className="nav-item relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors">
                <it.icon className="size-[18px] shrink-0" />
                <span className={clsx("flex-1 truncate", compact && "hidden lg:inline")}>{it.label}</span>
                {!!badges[it.href] && <span className="rounded-full bg-yellow-300 px-1.5 text-[11px] leading-5 font-bold text-slate-900">{badges[it.href]}</span>}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function Shell({ role, userName, name, logo, unread, mustChange, children }: { role: Role; userName: string; name: string; logo: string; unread: number; mustChange: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const groups = NAV[role];
  const badges = { "/thong-bao": unread };
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const segs = path.split("/").filter(Boolean);
  const crumbs = segs.map((s, i) => ({ href: "/" + segs.slice(0, i + 1).join("/"), label: titleOf(s) ?? (i > 0 ? "Chi tiết" : "") })).filter((c) => c.label);
  const flat = groups.flatMap((g) => g.items);
  const mobile = flat.slice(0, 4);

  return (
    <div className="min-h-screen">
      <aside className="no-print theme-sidebar fixed inset-y-0 left-0 z-30 hidden w-16 flex-col md:flex lg:w-60" style={{ color: "var(--sb-fg)" }}>
        <Brand name={name} logo={logo} />
        <nav className="flex-1 overflow-y-auto p-3" aria-label="Điều hướng chính"><Links groups={groups} path={path} badges={badges} compact /></nav>
        <div className="border-t sb-line p-3 text-xs sb-muted hidden lg:block truncate">{userName} · {ROLE_LABEL[role]}</div>
      </aside>

      <div className="md:pl-16 lg:pl-60 flex min-h-screen flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-white px-3 md:px-6">
          <button onClick={() => setDrawer(true)} className="md:hidden p-2 -ml-1" aria-label="Menu"><Menu className="size-5" /></button>
          {path !== "/" && (
            <button
              onClick={() => (window.history.length > 1 ? router.back() : router.push(crumbs.length > 1 ? crumbs[crumbs.length - 2].href : "/"))}
              className="mr-1 grid size-8 shrink-0 place-items-center rounded-md border hover:bg-slate-100" aria-label="Quay lại" title="Quay lại"
            ><ArrowLeft className="size-4" /></button>
          )}
          <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm text-slate-500" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-orange-700">Trang chủ</Link>
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="size-3.5 shrink-0" />
                {i === crumbs.length - 1 ? <span className="truncate font-medium" style={{ color: "var(--fg)" }}>{c.label}</span> : <Link href={c.href} className="hover:text-orange-700 truncate">{c.label}</Link>}
              </span>
            ))}
          </nav>
          <ModeToggle />
          <Link href="/thong-bao" className="relative rounded-md p-2 hover:bg-slate-100" aria-label="Thông báo">
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute right-0.5 top-0.5 rounded-full bg-red-700 px-1 text-[10px] leading-4 font-bold text-white">{unread}</span>}
          </Link>
          <div className="relative" ref={ref}>
            <button onClick={() => setMenu((o) => !o)} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100">
              <span className="grid size-8 place-items-center rounded-full bg-orange-100 text-sm font-semibold text-orange-800">{userName.slice(0, 1).toUpperCase()}</span>
              <span className="hidden sm:block text-left leading-tight"><span className="block text-[13px] font-medium max-w-32 truncate">{userName}</span><span className="block text-[11px] text-slate-500">{ROLE_LABEL[role]}</span></span>
            </button>
            {menu && (
              <div className="absolute right-0 mt-1 w-52 rounded-md border bg-white p-1 shadow-lg">
                <Link href="/doi-mat-khau" className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-slate-100"><KeyRound className="size-4" />Đổi mật khẩu</Link>
                <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-red-600 hover:bg-slate-100"><LogOut className="size-4" />Đăng xuất</button>
              </div>
            )}
          </div>
        </header>
        {mustChange && path !== "/doi-mat-khau" && (
          <div className="no-print bg-yellow-100 px-4 py-2 text-sm text-yellow-900">Bạn đang dùng mật khẩu tạm thời. <Link href="/doi-mat-khau" className="font-semibold underline">Đổi mật khẩu ngay</Link></div>
        )}
        <main className="w-full flex-1 min-w-0 p-4 pb-24 md:p-6 md:pb-6 lg:px-8">{children}</main>
      </div>

      {/* Mobile: thanh dưới + ngăn kéo */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t bg-white md:hidden">
        {mobile.map((it) => (
          <Link key={it.href} href={it.href} className={clsx("flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px]", isActive(path, it.href) ? "font-semibold text-orange-700" : "text-slate-500")}>
            <it.icon className="size-[22px]" strokeWidth={isActive(path, it.href) ? 2.4 : 1.8} /><span className="truncate max-w-full px-0.5">{it.label}</span>
          </Link>
        ))}
        <button onClick={() => setDrawer(true)} className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] text-slate-500"><Menu className="size-[22px]" strokeWidth={1.8} />Thêm</button>
      </nav>
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside onClick={(e) => e.stopPropagation()} className="theme-sidebar absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col" style={{ color: "var(--sb-fg)" }}>
            <div className="flex items-center justify-between pr-2"><Brand name={name} logo={logo} /><button onClick={() => setDrawer(false)} className="p-2"><X className="size-5" /></button></div>
            <nav className="flex-1 overflow-y-auto p-3"><Links groups={groups} path={path} badges={badges} onNavigate={() => setDrawer(false)} /></nav>
          </aside>
        </div>
      )}
    </div>
  );
}
