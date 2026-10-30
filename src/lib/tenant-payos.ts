import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import type { PayosKeys } from "@/lib/payos";

type Stored = { clientId: string; apiKey: string; checksumKey: string; enabled: boolean };

/** Khoá PayOS của trung tâm hiện tại (null = chưa cấu hình hoặc đang tắt). */
export async function getTenantPayos(opts: { includeDisabled?: boolean } = {}): Promise<{ keys: PayosKeys; enabled: boolean } | null> {
  const r = await db.setting.findFirst({ where: { key: "payos" } });
  const v = r?.value as Stored | undefined;
  if (!v?.clientId || !v.apiKey || !v.checksumKey) return null;
  if (!v.enabled && !opts.includeDisabled) return null;
  try { return { keys: { clientId: v.clientId, apiKey: decrypt(v.apiKey), checksumKey: decrypt(v.checksumKey) }, enabled: v.enabled }; } catch { return null; }
}

export const packPayos = (k: PayosKeys, enabled: boolean): Stored => ({ clientId: k.clientId, apiKey: encrypt(k.apiKey), checksumKey: encrypt(k.checksumKey), enabled });
