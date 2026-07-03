export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeVoucherCode(value: string) {
  return value.replace(/\s+/g, "").trim().toUpperCase();
}
