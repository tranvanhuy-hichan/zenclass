import { db } from "@/lib/db";

export async function audit(userId: string | null, action: string, entity: string, entityId?: string, diff?: object) {
  await db.auditLog.create({ data: { userId, action, entity, entityId, diff: diff as never } });
}
