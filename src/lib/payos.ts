import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * PayOS (https://payos.vn). Mỗi "kênh thanh toán" có bộ khoá riêng:
 * kênh của nền tảng lấy từ biến môi trường, kênh của từng trung tâm lấy từ cài đặt (truyền vào qua `keys`).
 */
export type PayosKeys = { clientId: string; apiKey: string; checksumKey: string };

const BASE = "https://api-merchant.payos.vn";

export const platformKeys = (): PayosKeys | null => {
  const { PAYOS_CLIENT_ID: clientId, PAYOS_API_KEY: apiKey, PAYOS_CHECKSUM_KEY: checksumKey } = process.env;
  return clientId && apiKey && checksumKey ? { clientId, apiKey, checksumKey } : null;
};

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const sign = (data: string, key: string) => createHmac("sha256", key).update(data).digest("hex");

async function call<T>(keys: PayosKeys, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, { ...init, headers: { "Content-Type": "application/json", "x-client-id": keys.clientId, "x-api-key": keys.apiKey }, cache: "no-store" });
  const j = (await res.json().catch(() => null)) as { code?: string; desc?: string; data?: T } | null;
  if (!j || j.code !== "00") throw new Error(`PayOS: ${j?.desc ?? res.status}`);
  return j.data as T;
}

export type PayosLink = { checkoutUrl: string; paymentLinkId: string; orderCode: number; qrCode: string };

export async function createPaymentLink(keys: PayosKeys, o: { orderCode: number; amount: number; description: string; returnUrl: string; cancelUrl: string }) {
  const signature = sign(`amount=${o.amount}&cancelUrl=${o.cancelUrl}&description=${o.description}&orderCode=${o.orderCode}&returnUrl=${o.returnUrl}`, keys.checksumKey);
  return call<PayosLink>(keys, "/v2/payment-requests", { method: "POST", body: JSON.stringify({ ...o, signature }) });
}

export type PayosInfo = { orderCode: number; amount: number; amountPaid: number; status: "PENDING" | "PROCESSING" | "PAID" | "CANCELLED" | "EXPIRED" };

export const getPaymentInfo = (keys: PayosKeys, orderCode: number) => call<PayosInfo>(keys, `/v2/payment-requests/${orderCode}`);

export const cancelPaymentLink = (keys: PayosKeys, orderCode: number) =>
  call<unknown>(keys, `/v2/payment-requests/${orderCode}/cancel`, { method: "POST", body: JSON.stringify({}) });

/** Đăng ký địa chỉ webhook cho kênh (PayOS sẽ gọi thử địa chỉ này, nên phải là địa chỉ công khai). */
export const confirmWebhook = (keys: PayosKeys, webhookUrl: string) =>
  call<unknown>(keys, "/confirm-webhook", { method: "POST", body: JSON.stringify({ webhookUrl }) });

export type PayosWebhook = { code: string; desc?: string; success?: boolean; data: Record<string, unknown> & { orderCode: number; amount: number; code?: string }; signature: string };

/** Kiểm tra chữ ký webhook: ký các trường của `data` theo thứ tự chữ cái. */
export function verifyWebhook(body: PayosWebhook, checksumKey: string) {
  if (!body?.data || typeof body.signature !== "string") return false;
  const str = Object.keys(body.data).sort().map((k) => {
    const v = body.data[k];
    return `${k}=${v === null || v === undefined || v === "null" || v === "undefined" ? "" : Array.isArray(v) || typeof v === "object" ? JSON.stringify(v) : v}`;
  }).join("&");
  const a = Buffer.from(sign(str, checksumKey)), b = Buffer.from(body.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
