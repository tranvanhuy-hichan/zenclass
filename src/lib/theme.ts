export type Theme = {
  primary: string;
  background: string;
  surface: string;
  text: string;
  line: string;
  sidebar: string;
  font: string;
  headingFont: string;
  fontSize: number; // px
  radius: number; // px
  logo: string;
  dark: boolean;
};

export const DEFAULT_THEME: Theme = {
  primary: "#0b63b8", background: "#f8fafc", surface: "#ffffff", text: "#172033", line: "#e2e8f0",
  sidebar: "#084a8c", font: "Segoe UI", headingFont: "Segoe UI", fontSize: 14, radius: 8, logo: "", dark: false,
};

export const FONTS = ["Segoe UI", "Be Vietnam Pro", "Inter", "Roboto", "Nunito", "Montserrat", "Lexend", "Quicksand", "Open Sans", "Merriweather", "Playfair Display", "System"];

export const PRESETS: Record<string, Partial<Theme>> = {
  "Xanh dương (mặc định)": { primary: "#0b63b8", background: "#f8fafc", surface: "#ffffff", text: "#172033", line: "#e2e8f0", sidebar: "#084a8c", dark: false },
  "Xanh lá": { primary: "#15803d", background: "#f6faf7", surface: "#ffffff", text: "#172033", line: "#dde7df", sidebar: "#14532d", dark: false },
  "Cam": { primary: "#ea580c", background: "#fff7ed", surface: "#ffffff", text: "#1f2937", line: "#e5e7eb", sidebar: "#7c2d12", dark: false },
  "Tím": { primary: "#7c3aed", background: "#f7f5ff", surface: "#ffffff", text: "#1f2937", line: "#e4defa", sidebar: "#4c1d95", dark: false },
  "Đỏ đô": { primary: "#be123c", background: "#fdf6f8", surface: "#ffffff", text: "#1f2937", line: "#f0dce2", sidebar: "#881337", dark: false },
  "Tối": { primary: "#3b82f6", background: "#0f172a", surface: "#1e293b", text: "#e2e8f0", line: "#334155", sidebar: "#020617", dark: true },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export function sanitizeTheme(t: Partial<Theme>): Theme {
  const d = DEFAULT_THEME;
  const col = (v: unknown, f: string) => (typeof v === "string" && HEX.test(v) ? v : f);
  const font = (v: unknown, f: string) => (typeof v === "string" && FONTS.includes(v) ? v : f);
  const num = (v: unknown, lo: number, hi: number, f: number) => (typeof v === "number" && v >= lo && v <= hi ? v : f);
  return {
    primary: col(t.primary, d.primary), background: col(t.background, d.background), surface: col(t.surface, d.surface),
    text: col(t.text, d.text), line: col(t.line, d.line), sidebar: col(t.sidebar, d.sidebar),
    font: font(t.font, d.font), headingFont: font(t.headingFont, d.headingFont),
    fontSize: num(t.fontSize, 12, 20, d.fontSize), radius: num(t.radius, 0, 28, d.radius),
    logo: typeof t.logo === "string" && /^https?:\/\/[^\s"'<>()]+$/.test(t.logo) ? t.logo : "",
    dark: !!t.dark,
  };
}

function mix(hex: string, to: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex), b = p(to);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/** Bảng màu 50–900 từ 1 màu chủ đạo. */
export function palette(primary: string, dark: boolean) {
  const W = "#ffffff", K = "#000000";
  if (dark) {
    // Tối: 50–200 là nền tối pha màu chủ đạo; 600+ sáng dần để chữ/liên kết đọc được trên nền tối
    return {
      50: mix(primary, K, 0.82), 100: mix(primary, K, 0.72), 200: mix(primary, K, 0.55), 300: mix(primary, K, 0.35), 400: mix(primary, K, 0.15),
      500: primary, 600: primary, 700: mix(primary, W, 0.4), 800: mix(primary, W, 0.58), 900: mix(primary, W, 0.72),
    } as Record<number, string>;
  }
  const light = [0.93, 0.85, 0.7, 0.45, 0.2];
  return {
    50: mix(primary, W, light[0]), 100: mix(primary, W, light[1]), 200: mix(primary, W, light[2]), 300: mix(primary, W, light[3]), 400: mix(primary, W, light[4]),
    500: primary, 600: mix(primary, K, 0.12), 700: mix(primary, K, 0.28), 800: mix(primary, K, 0.42), 900: mix(primary, K, 0.56),
  } as Record<number, string>;
}

const stack = (f: string) =>
  f === "System" ? "system-ui, sans-serif" : f === "Segoe UI" ? '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif' : `"${f}", system-ui, sans-serif`;

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const LIGHT_COLORS = { background: "#f8fafc", surface: "#ffffff", text: "#172033", line: "#e2e8f0", sidebar: "#084a8c" };
const DARK_COLORS = { background: "#0f172a", surface: "#1e293b", text: "#e2e8f0", line: "#334155", sidebar: "#020617" };

function block(t: Theme, dark: boolean) {
  // Màu của quản trị dùng cho chế độ trùng với mặc định của họ; chế độ còn lại dùng bộ màu chuẩn.
  const own = t.dark === dark;
  const c = own ? t : dark ? DARK_COLORS : LIGHT_COLORS;
  const pal = palette(t.primary, dark);
  const vars = Object.entries(pal).map(([k, v]) => `--color-orange-${k}:${v};`).join("");
  return `${vars}--bg:${c.background};--surface:${c.surface};--fg:${c.text};--line:${c.line};--sidebar:${c.sidebar};--sb-fg:${lum(c.sidebar) > 0.6 ? "#1f2937" : "#ffffff"};color-scheme:${dark ? "dark" : "light"};`;
}

/** Sinh CSS cho cả hai chế độ: :root là sáng, [data-dark="1"] là tối. */
export function themeCss(t: Theme) {
  return `:root{${block(t, false)}--r:${t.radius}px;--fs:${t.fontSize}px;--font-body:${stack(t.font)};--font-head:${stack(t.headingFont)}}
:root[data-dark="1"]{${block(t, true)}}`;
}

export function fontsHref(t: Theme) {
  const fams = [...new Set([t.font, t.headingFont])].filter((f) => f !== "System" && f !== "Segoe UI");
  if (!fams.length) return null;
  return "https://fonts.googleapis.com/css2?" + fams.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700`).join("&") + "&display=swap";
}
