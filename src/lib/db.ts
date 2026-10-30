import { AsyncLocalStorage } from "node:async_hooks";
import * as React from "react";
import { unstable_rethrow } from "next/navigation";
import { PrismaClient } from "@prisma/client";

/**
 * Hai kết nối tới cùng một CSDL:
 *  - `db`     : role app_rw, chịu Row-Level Security. Mọi truy vấn tự giới hạn trong trung tâm hiện tại
 *               (lấy từ phiên đăng nhập, hoặc từ withTenant()). Không có trung tâm => không thấy dòng nào.
 *  - `rootDb` : role chủ bảng, bỏ qua RLS. CHỈ dùng cho đăng nhập, quản trị nền tảng và tác vụ nền.
 *               Kết nối bằng ROOT_DATABASE_URL (nên là pooler, cổng 6543 + pgbouncer=true trên Vercel), mặc định DIRECT_URL.
 */
/**
 * Trên Vercel mỗi lần gọi hàm có thể mở một bản sao riêng, nên số kết nối phải nhỏ và đi qua pooler dạng giao dịch
 * (Supabase: cổng 6543). Cổng 5432 ("session mode") chỉ cho 15 kết nối cùng lúc và sẽ cạn ngay.
 * Chỉ chỉnh khi dùng pooler của Supabase; CSDL cục bộ giữ nguyên.
 */
function tune(url: string | undefined, conns: number) {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("pooler.supabase.com")) return url;
    if (u.port === "5432") u.port = "6543"; // session -> transaction pooler
    u.searchParams.set("pgbouncer", "true");
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", String(conns));
    return u.toString();
  } catch { return url; }
}

const g = globalThis as unknown as { base?: PrismaClient; root?: PrismaClient };
const debug = process.env.DB_DEBUG === "1";
const base = g.base ?? new PrismaClient({ datasourceUrl: tune(process.env.DATABASE_URL, 3), ...(debug ? { log: [{ emit: "event", level: "query" }] } : {}) });
// DB_DEBUG=1: in từng câu SQL để đếm số lượt truy vấn mỗi trang
if (debug && !g.base) (base as unknown as { $on: (e: string, cb: (q: { query: string; duration: number }) => void) => void }).$on("query", (q) => console.log("[sql]", q.duration + "ms", q.query.replace(/\s+/g, " ").slice(0, 90)));
export const rootDb = g.root ?? new PrismaClient({ datasourceUrl: tune(process.env.ROOT_DATABASE_URL ?? process.env.DIRECT_URL, 2) });
if (process.env.NODE_ENV !== "production") { g.base = base; g.root = rootDb; }

const als = new AsyncLocalStorage<string | null>();

/** Chạy `fn` với trung tâm chỉ định (cron, webhook, script). */
export const withTenant = <T>(tenantId: string | null, fn: () => Promise<T>) => als.run(tenantId, fn);

const cached = (typeof React.cache === "function" ? React.cache : <T extends (...a: never[]) => unknown>(f: T) => f) as <T extends (...a: never[]) => unknown>(f: T) => T;
const sessionTenant = cached(async (): Promise<string | null> => {
  try {
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/lib/auth");
    const s = await getServerSession(authOptions);
    return ((s?.user as { tenantId?: string | null } | undefined)?.tenantId) ?? null;
  } catch (e) {
    unstable_rethrow(e); // giữ nguyên tín hiệu "trang động" của Next, nếu không trang bị dựng tĩnh lúc build
    return null; // ngoài ngữ cảnh request (script, cron)
  }
});

/** Trung tâm hiện tại (null = chưa xác định / quản trị nền tảng). */
export async function currentTenantId(): Promise<string | null> {
  const s = als.getStore();
  return s !== undefined ? s : sessionTenant();
}

function scope(resolve: () => Promise<string | null>) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const tid = await resolve();
          const [, result] = await base.$transaction([base.$executeRaw`SELECT set_config('app.tenant_id', ${tid ?? ""}, TRUE)`, query(args)]);
          return result;
        },
      },
    },
  });
}

export const db = scope(currentTenantId);

/** Client cố định một trung tâm — dùng trong script seed. */
export const tenantClient = (tenantId: string) => scope(async () => tenantId);

/** Client cho script: tự tra mã trung tâm (mặc định biến môi trường TENANT hoặc "saomai"). */
export function slugClient(slug = process.env.TENANT ?? "saomai") {
  let id: string | undefined;
  return scope(async () => (id ??= (await rootDb.tenant.findUniqueOrThrow({ where: { slug } })).id));
}
export async function slugTenantId(slug = process.env.TENANT ?? "saomai") {
  return (await rootDb.tenant.findUniqueOrThrow({ where: { slug } })).id;
}
