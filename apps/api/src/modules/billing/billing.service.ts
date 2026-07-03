import { normalizeCpf } from "../../utils/normalization.js";

export type BuyerFields = {
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  cpf?: string | null;
  endereco?: string | null;
};

export type TicketCredentials = {
  username: string;
  password: string;
};

function trimOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeBuyerFields(fields: BuyerFields): BuyerFields {
  const cpf = trimOrNull(fields.cpf);

  return {
    nome: trimOrNull(fields.nome),
    telefone: trimOrNull(fields.telefone),
    email: trimOrNull(fields.email)?.toLowerCase(),
    cpf: cpf ? normalizeCpf(cpf) : undefined,
    endereco: trimOrNull(fields.endereco),
  };
}

export function hasProspectData(fields: BuyerFields) {
  return Boolean(fields.nome || fields.telefone || fields.email || fields.cpf || fields.endereco);
}

export function buildTicketCredentials(fields: BuyerFields, generateCode: () => string): TicketCredentials {
  const normalized = normalizeBuyerFields(fields);
  const username = normalized.cpf || generateCode();
  return { username, password: username };
}

const TICKET_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function randomTicketCode(length = 10) {
  let code = "T";
  for (let index = 0; index < length - 1; index += 1) {
    code += TICKET_ALPHABET[Math.floor(Math.random() * TICKET_ALPHABET.length)];
  }
  return code;
}
