import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const fontFile = (n: string) => readFile(path.join(process.cwd(), "src/assets/fonts", n));

/** Tài liệu PDF mới kèm font thường/đậm đủ dấu tiếng Việt (DejaVu Sans). */
export async function createPdf() {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [reg, bold] = await Promise.all([pdf.embedFont(await fontFile("DejaVuSans.ttf"), { subset: true }), pdf.embedFont(await fontFile("DejaVuSans-Bold.ttf"), { subset: true })]);
  pdf.setProducer("ZenClass");
  pdf.setCreationDate(new Date());
  return { pdf, reg, bold };
}

/** Ngắt dòng theo độ rộng thực của font. */
export function wrapText(s: string, f: PDFFont, size: number, maxW: number) {
  const out: string[] = [];
  let cur = "";
  for (const w of s.split(/\s+/)) {
    const t = cur ? `${cur} ${w}` : w;
    if (f.widthOfTextAtSize(t, size) > maxW && cur) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}
