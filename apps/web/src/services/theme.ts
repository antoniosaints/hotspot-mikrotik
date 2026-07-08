import { ref } from "vue";

export type Theme = "light" | "dark";

const STORAGE_KEY = "hotspot-theme";

function storedTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" ? value : null;
}

// O visual original do painel e escuro, entao dark segue como padrao para
// quem nunca escolheu um tema (inclui os clientes do portal publico).
const theme = ref<Theme>(storedTheme() ?? "dark");

function applyTheme(value: Theme): void {
  document.documentElement.classList.toggle("dark", value === "dark");
}

export function initTheme(): void {
  applyTheme(theme.value);
}

export function toggleTheme(): void {
  theme.value = theme.value === "dark" ? "light" : "dark";
  localStorage.setItem(STORAGE_KEY, theme.value);
  applyTheme(theme.value);
}

export function useTheme() {
  return { theme, toggleTheme };
}
