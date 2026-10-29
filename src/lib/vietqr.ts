export function vietQrUrl(o: { bank: string; account: string; name: string; amount: number; info: string }) {
  const q = new URLSearchParams({ amount: String(o.amount), addInfo: o.info, accountName: o.name });
  return `https://img.vietqr.io/image/${o.bank}-${o.account}-compact2.png?${q}`;
}
