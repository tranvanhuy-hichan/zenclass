import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { currentTenantId } from "@/lib/db";
import { fontsHref, themeCss } from "@/lib/theme";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  // Biểu tượng thẻ trình duyệt: logo riêng của trung tâm (sau khi đăng nhập), nếu chưa có thì logo hệ thống.
  const own = s.theme.logo;
  const icons: Metadata["icons"] = own
    ? { icon: [{ url: own, type: "image/png" }], shortcut: own, apple: own }
    : { icon: [{ url: "/favicon.ico?v=1", type: "image/x-icon" }, { url: "/favicon.svg?v=1", type: "image/svg+xml" }, { url: "/icon-192.png?v=1", sizes: "192x192", type: "image/png" }, { url: "/icon-512.png?v=1", sizes: "512x512", type: "image/png" }], shortcut: "/favicon.ico?v=1", apple: [{ url: "/apple-touch-icon.png?v=1", sizes: "180x180" }] };
  // Chưa đăng nhập / quản trị nền tảng (không thuộc trung tâm nào): dùng tên hệ thống.
  const title = (await currentTenantId()) ? s.name : "ZenClass";
  return { title, description: "ZenClass — hệ thống quản lý trung tâm dạy học", icons };
}

// Mọi trang đều cần phiên đăng nhập / dữ liệu trung tâm: không dựng tĩnh lúc build (build không được chạm CSDL).
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { theme } = await getSettings();
  const mode = (await cookies()).get("mode")?.value;
  const dark = mode === "dark" ? true : mode === "light" ? false : theme.dark;
  const href = fontsHref(theme);
  return (
    <html lang="vi" data-dark={dark ? "1" : "0"} suppressHydrationWarning>
      <head>
        {href && <link rel="stylesheet" href={href} />}
        <style id="theme-vars" dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
