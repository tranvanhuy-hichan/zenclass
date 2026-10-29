// Tính điểm: công thức an toàn (không dùng eval). Dùng được cả server và client.

export type Col = { id: string; name: string; key: string; weight: number; maxScore: number };
export type Rank = { min: number; label: string };
export type Tpl = { formula: string; scale: number; missingAsZero: boolean; ranks: unknown };

type Tok = { t: "num" | "id" | "op"; v: string };
class Missing extends Error {}

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(?:(\d+(?:[.,]\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/(),]))/y;
  let i = 0;
  src = src.trim();
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new Error(`Ký tự không hợp lệ gần "${src.slice(i, i + 6)}"`);
    if (m[1]) out.push({ t: "num", v: m[1].replace(",", ".") });
    else if (m[2]) out.push({ t: "id", v: m[2] });
    else out.push({ t: "op", v: m[3] });
    i = re.lastIndex;
  }
  return out;
}

const FUNCS: Record<string, (a: number[]) => number> = {
  avg: (a) => a.reduce((s, x) => s + x, 0) / a.length,
  sum: (a) => a.reduce((s, x) => s + x, 0),
  min: (a) => Math.min(...a),
  max: (a) => Math.max(...a),
  round: (a) => { const n = a[1] ?? 0; const f = 10 ** n; return Math.round(a[0] * f) / f; },
};

function evaluate(formula: string, vars: Record<string, number | null>, known: Set<string>): number {
  const toks = tokenize(formula);
  let p = 0;
  const peek = () => toks[p];
  const eat = (v?: string) => { const t = toks[p]; if (!t || (v && t.v !== v)) throw new Error(v ? `Thiếu "${v}"` : "Công thức chưa đầy đủ"); p++; return t; };
  function expr(): number {
    let x = term();
    while (peek() && (peek().v === "+" || peek().v === "-") && peek().t === "op") x = eat().v === "+" ? x + term() : x - term();
    return x;
  }
  function term(): number {
    let x = unary();
    while (peek() && (peek().v === "*" || peek().v === "/") && peek().t === "op") {
      const o = eat().v; const y = unary();
      if (o === "/" && y === 0) throw new Missing("chia cho 0");
      x = o === "*" ? x * y : x / y;
    }
    return x;
  }
  function unary(): number {
    if (peek()?.t === "op" && peek().v === "-") { eat(); return -unary(); }
    return atom();
  }
  function atom(): number {
    const t = eat();
    if (t.t === "num") return parseFloat(t.v);
    if (t.t === "op" && t.v === "(") { const x = expr(); eat(")"); return x; }
    if (t.t === "id") {
      const name = t.v.toLowerCase();
      if (peek()?.v === "(" ) {
        const fn = FUNCS[name];
        if (!fn) throw new Error(`Hàm "${t.v}" không tồn tại (dùng avg, sum, min, max, round)`);
        eat("(");
        const args: number[] = [];
        if (peek()?.v !== ")") { args.push(expr()); while (peek()?.v === ",") { eat(","); args.push(expr()); } }
        eat(")");
        if (!args.length) throw new Error(`Hàm ${t.v} cần tham số`);
        return fn(args);
      }
      if (!known.has(t.v)) throw new Error(`Không có cột điểm "${t.v}"`);
      const v = vars[t.v];
      if (v == null) throw new Missing("thiếu điểm");
      return v;
    }
    throw new Error(`Không hiểu "${t.v}"`);
  }
  const r = expr();
  if (p < toks.length) throw new Error(`Thừa "${toks[p].v}"`);
  return r;
}

/** Kiểm tra cú pháp công thức theo danh sách mã cột. Trả về lỗi hoặc null. */
export function validateFormula(formula: string, cols: Col[]): string | null {
  if (!formula.trim()) return null;
  const vars: Record<string, number | null> = {};
  for (const c of cols) vars[c.key] = 1;
  try { evaluate(formula, vars, new Set(cols.map((c) => c.key))); return null; }
  catch (e) { return e instanceof Missing ? null : (e as Error).message; }
}

/** Tổng điểm của 1 học viên. values: columnId → điểm. null nếu chưa đủ dữ liệu. */
export function computeTotal(tpl: Tpl, cols: Col[], values: Record<string, number | undefined>): number | null {
  const present = cols.filter((c) => values[c.id] != null);
  if (!present.length) return null;
  let r: number;
  if (!tpl.formula.trim()) {
    const use = tpl.missingAsZero ? cols : present;
    const wsum = use.reduce((s, c) => s + c.weight, 0);
    if (!wsum) return null;
    r = (use.reduce((s, c) => s + ((values[c.id] ?? 0) / (c.maxScore || 10)) * c.weight, 0) / wsum) * tpl.scale;
  } else {
    const vars: Record<string, number | null> = {};
    for (const c of cols) vars[c.key] = values[c.id] ?? (tpl.missingAsZero ? 0 : null);
    try { r = evaluate(tpl.formula, vars, new Set(cols.map((c) => c.key))); }
    catch { return null; }
  }
  return Number.isFinite(r) ? Math.round(r * 100) / 100 : null;
}

export function parseRanks(v: unknown): Rank[] {
  if (!Array.isArray(v)) return [];
  return v.filter((r): r is Rank => r && typeof r.min === "number" && typeof r.label === "string").sort((a, b) => b.min - a.min);
}

export function rankOf(total: number | null, ranks: unknown): string {
  if (total == null) return "";
  return parseRanks(ranks).find((r) => total >= r.min)?.label ?? "";
}

export const DEFAULT_RANKS: Rank[] = [
  { min: 9, label: "Xuất sắc" }, { min: 8, label: "Giỏi" }, { min: 6.5, label: "Khá" }, { min: 5, label: "Trung bình" }, { min: 0, label: "Yếu" },
];

export function ranksToText(v: unknown) {
  return parseRanks(v).map((r) => `${r.min}:${r.label}`).join("\n");
}
export function textToRanks(t: string): Rank[] {
  return t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [m, ...rest] = l.split(":");
    const min = parseFloat(m.replace(",", "."));
    if (!Number.isFinite(min) || !rest.join(":").trim()) throw new Error(`Dòng xếp loại sai: "${l}" (đúng dạng 8:Giỏi)`);
    return { min, label: rest.join(":").trim() };
  });
}
