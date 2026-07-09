export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeVoucherCode(value: string) {
  return value.replace(/\s+/g, "").trim().toUpperCase();
}

// MAC canonico usado como chave do dispositivo: hex maiusculo separado por ":".
// Aceita entradas com "-", "." ou sem separador; retorna "" quando nao houver
// exatamente 12 digitos hexadecimais (ex.: MAC ausente ou mascarado).
export function normalizeMac(value: string | null | undefined) {
  if (!value) return "";
  const hex = value.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (hex.length !== 12) return "";
  return hex.match(/.{2}/g)?.join(":") ?? "";
}
