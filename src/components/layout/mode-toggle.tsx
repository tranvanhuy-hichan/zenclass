"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ModeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.dark === "1"), []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.dark = next ? "1" : "0";
    document.cookie = `mode=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <button onClick={toggle} className="rounded-md p-2 hover:bg-slate-100" aria-label={dark ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"} title={dark ? "Chế độ sáng" : "Chế độ tối"}>
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
