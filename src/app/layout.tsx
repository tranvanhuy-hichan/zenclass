import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { fontsHref, themeCss } from "@/lib/theme";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: s.name, description: "Hệ thống quản lý trung tâm" };
}

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
