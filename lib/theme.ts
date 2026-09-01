export type ThemeName = "dark" | "minimalist" | "glassmorphism" | "skeuomorphism";

const LS_KEY = "dashboard.theme.v1";

export const THEMES: { value: ThemeName; label: string }[] = [
  { value: "dark", label: "Dark Mode" },
  { value: "minimalist", label: "Minimalist" },
  { value: "glassmorphism", label: "Glassmorphism" },
  { value: "skeuomorphism", label: "Skeuomorphism" },
];

export function loadTheme(): ThemeName {
  if (typeof window === "undefined") return "dark";
  const v = localStorage.getItem(LS_KEY) as ThemeName | null;
  return v && THEMES.some(t => t.value === v) ? v : "dark";
}

export function applyTheme(name: ThemeName) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", name);
  try { localStorage.setItem(LS_KEY, name); } catch {}
}
