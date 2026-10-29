export type Res = { ok?: string; error?: string; data?: Record<string, string> } | null;

/** Bọc server action: bắt lỗi → trả {error}, giữ nguyên redirect của Next. */
export function wrap(fn: (fd: FormData) => Promise<string | { ok: string; data?: Record<string, string> } | void>) {
  return async (_: Res, fd: FormData): Promise<Res> => {
    try {
      const r = await fn(fd);
      if (typeof r === "string") return { ok: r };
      if (r) return r;
      return { ok: "Đã lưu" };
    } catch (e) {
      const err = e as { digest?: string; message?: string };
      if (err.digest?.startsWith("NEXT_REDIRECT")) throw e;
      return { error: err.message ?? "Có lỗi xảy ra" };
    }
  };
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const int = (fd: FormData, k: string, d = 0) => {
  const v = parseInt(str(fd, k).replace(/\D/g, ""), 10);
  return Number.isFinite(v) ? v : d;
};
export const opt = (fd: FormData, k: string) => str(fd, k) || null;
