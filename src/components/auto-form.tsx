"use client";
import { useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Bộ lọc tự áp dụng: đổi ô chọn là lọc ngay, gõ ô tìm kiếm thì lọc sau 350ms.
 * Giá trị rỗng bị bỏ khỏi URL; mỗi lần lọc đều quay về trang 1.
 * `resets`: khi ô tên A đổi thì xoá các ô tên B (vd. đổi cơ sở thì bỏ phòng đã chọn).
 */
export function AutoForm({ children, className, resets = {} }: { children: React.ReactNode; className?: string; resets?: Record<string, string[]> }) {
  const router = useRouter();
  const path = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [pending, start] = useTransition();

  function apply(form: HTMLFormElement, changed?: string) {
    const fd = new FormData(form);
    const p = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      if (typeof v !== "string" || !v) continue;
      if (changed && resets[changed]?.includes(k)) continue;
      p.set(k, v);
    }
    p.delete("page");
    start(() => router.replace(p.size ? `${path}?${p}` : path, { scroll: false }));
  }

  return (
    <form
      className={className}
      data-pending={pending || undefined}
      onSubmit={(e) => { e.preventDefault(); clearTimeout(timer.current); apply(e.currentTarget as unknown as HTMLFormElement); }}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        const form = (e.currentTarget as unknown) as HTMLFormElement;
        clearTimeout(timer.current);
        if (t.tagName === "INPUT" && ["text", "search", ""].includes(t.type)) timer.current = setTimeout(() => apply(form, t.name), 350);
        else apply(form, t.name);
      }}
    >
      {children}
    </form>
  );
}
