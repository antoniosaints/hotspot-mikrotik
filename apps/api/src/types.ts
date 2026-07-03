export const LoginType = {
  VOUCHER: "VOUCHER",
  CPF: "CPF",
  IXC: "IXC",
  COMPRA: "COMPRA",
} as const;

export type LoginType = (typeof LoginType)[keyof typeof LoginType];

export const AccessStatus = {
  LIBERADO: "LIBERADO",
  EXPIRADO: "EXPIRADO",
  REVOGADO: "REVOGADO",
} as const;

export type AccessStatus = (typeof AccessStatus)[keyof typeof AccessStatus];

export type AccessType = LoginType;
