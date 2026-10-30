import { rootDb } from "@/lib/db";

/** Phục vụ file công khai (logo trung tâm). Mỗi lần đổi logo là một id mới nên cache được vô thời hạn. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const f = await rootDb.storedFile.findUnique({ where: { id } });
  if (!f || !f.isPublic || !/^image\/(png|jpeg|webp)$/.test(f.mime)) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(f.data), { headers: { "Content-Type": f.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
