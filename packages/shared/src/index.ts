export type EntityId = string;

export type AdminId = EntityId;
export type HotspotId = EntityId;
export type MikrotikId = EntityId;
export type VoucherId = EntityId;
export type CpfLoginId = EntityId;
export type AccessId = EntityId;

export const PortalLoginType = {
  VOUCHER: "voucher",
  CPF: "cpf",
} as const;

export type PortalLoginType = (typeof PortalLoginType)[keyof typeof PortalLoginType];

export const AccessType = {
  VOUCHER: "VOUCHER",
  CPF: "CPF",
} as const;

export type AccessType = (typeof AccessType)[keyof typeof AccessType];

export const AccessStatus = {
  LIBERADO: "LIBERADO",
  EXPIRADO: "EXPIRADO",
  REVOGADO: "REVOGADO",
} as const;

export type AccessStatus = (typeof AccessStatus)[keyof typeof AccessStatus];

export type AdminTokenPayload = {
  id: AdminId;
  usuario: string;
};

export type AdminSession = {
  token: string;
  admin: {
    id: AdminId;
    usuario: string;
    criadoEm: string | Date;
    atualizadoEm: string | Date;
  };
};

export type PortalLoginRequest = {
  loginType: PortalLoginType;
  hotspotSlug: string;
  codigo?: string;
  voucher?: string;
  cpf?: string;
  mac?: string | null;
  ip?: string | null;
  linkLogin?: string | null;
  linkLoginOnly?: string | null;
  linkOrig?: string | null;
  chapId?: string | null;
  chapChallenge?: string | null;
  chapIdB64?: string | null;
  chapChallengeB64?: string | null;
};

export type AccessRecord = {
  id: AccessId;
  tipo: AccessType;
  codigo: string;
  mac?: string | null;
  ip?: string | null;
  loginEm: string | Date;
  expiraEm: string | Date;
  status: AccessStatus;
  hotspotId: HotspotId;
  mikrotikId?: MikrotikId | null;
  voucherId?: VoucherId | null;
  cpfLoginId?: CpfLoginId | null;
};
