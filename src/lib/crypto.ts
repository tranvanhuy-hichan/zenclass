import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Mã hoá khoá bí mật của trung tâm (AES-256-GCM). Khoá lấy từ SECRETS_KEY, mặc định NEXTAUTH_SECRET. */
const key = () => createHash("sha256").update(process.env.SECRETS_KEY ?? process.env.NEXTAUTH_SECRET ?? "").digest();

export function encrypt(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decrypt(value: string) {
  const [v, iv, tag, data] = value.split(":");
  if (v !== "v1") throw new Error("Dữ liệu mã hoá không hợp lệ");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}
