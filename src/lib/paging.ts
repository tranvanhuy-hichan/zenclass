export const PAGE_SIZES = [10, 20, 50, 100];

export function getPaging(sp: { page?: string; size?: string }, def = 20, key = "page") {
  const rawSize = parseInt(sp.size ?? "", 10);
  const size = PAGE_SIZES.includes(rawSize) ? rawSize : def;
  const rawPage = parseInt((sp as Record<string, string | undefined>)[key] ?? "", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  return { page, size, skip: (page - 1) * size, take: size, key };
}
