import { AsyncLocalStorage } from "node:async_hooks";
import * as React from "react";
import { PrismaClient } from "@prisma/client";

/**
 * Hai kết nối tới cùng một CSDL:
 *  - `db`     : role app_rw, chịu Row-Level Security. Mọi truy vấn tự giới hạn trong trung tâm hiện tại
 *               (lấy từ phiên đăng nhập, hoặc từ withTenant()). Không có trung tâm => không thấy dòng nào.
 *  - `rootDb` : role chủ bảng, bỏ qua RLS. CHỈ dùng cho đăng nhập, quản trị nền tảng và tác vụ nền.
 */
const g = globalThis as unknown as { base?: PrismaClient; root?: PrismaClient };
const base = g.base ?? new PrismaClient();
export const rootDb = g.root ?? new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
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
  } catch {
    return null; // ngoài ngữ cảnh request
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
