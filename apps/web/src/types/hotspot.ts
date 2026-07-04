export type EntityBase = {
  id: string;
  criadoEm?: string;
  atualizadoEm?: string;
};

export type Local = EntityBase & {
  nome: string;
  descricao: string | null;
  ativo: boolean;
};

export type Mikrotik = EntityBase & {
  nome: string;
  host: string;
  usuarioApi: string;
  senhaApi: string;
  portaApi: number;
  timeoutApi: number;
  profilePadrao: string;
  ativo: boolean;
};

export type CadastroTela = EntityBase & {
  nome: string;
  descricao: string | null;
  coletarNome: boolean;
  coletarEmail: boolean;
  coletarEndereco: boolean;
  coletarCidade: boolean;
  coletarCep: boolean;
  coletarTelefone: boolean;
  coletarWhatsapp: boolean;
  coletarCpf: boolean;
  bonusTempoMinutos: number;
  ativo: boolean;
};

export type Integracao = EntityBase & {
  nome: string;
  tipo: "IXC" | "MERCADO_PAGO";
  baseUrl: string | null;
  usuario: string | null;
  senha: string | null;
  token: string | null;
  chaveWebhook: string | null;
  ativo: boolean;
};

export type Hotspot = EntityBase & {
  nome: string;
  slug: string;
  portalUrl: string;
  urlPosLogin: string | null;
  loginVoucher: boolean;
  loginCpf: boolean;
  loginIntegracao: boolean;
  integracaoTempoMinutos: number;
  compraOnline: boolean;
  compraPersonalizada: boolean;
  valorMinutoCentavos: number | null;
  tempoPersonalizadoMinimo: number;
  tempoPersonalizadoMaximo: number;
  tempoPersonalizadoPasso: number;
  conexoesPersonalizado: number;
  ativo: boolean;
  localId: string;
  mikrotikId: string;
  integracaoId: string | null;
  pagamentoIntegracaoId: string | null;
  cadastroTelaId: string | null;
  local?: Local;
  mikrotik?: Mikrotik;
  integracao?: Integracao | null;
  pagamentoIntegracao?: Integracao | null;
  cadastroTela?: CadastroTela | null;
};

export type PlanoBilheteria = EntityBase & {
  nome: string;
  tempoMinutos: number;
  conexoesSimultaneas: number;
  valorCentavos: number;
  ativo: boolean;
  coletarNome: boolean;
  coletarTelefone: boolean;
  coletarEmail: boolean;
  coletarCpf: boolean;
  coletarEndereco: boolean;
  hotspotId: string;
  hotspot?: Hotspot;
};

export type CompraAcesso = EntityBase & {
  origem?: string;
  status: string;
  valorCentavos: number;
  tempoMinutos: number | null;
  mercadoPagoPaymentId: string | null;
  mercadoPagoStatus: string | null;
  loginUsuario: string | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  endereco: string | null;
  cidade?: string | null;
  cep?: string | null;
  whatsapp?: string | null;
  hotspotId: string;
  planoId: string | null;
  hotspot?: Hotspot;
  plano?: PlanoBilheteria | null;
};

export type Voucher = EntityBase & {
  codigo: string;
  tempoMinutos: number;
  usado: boolean;
  vendido: boolean;
  vendidoEm: string | null;
  segmentacao: string | null;
  mac: string | null;
  ip: string | null;
  usadoEm: string | null;
  hotspotId: string;
  hotspot?: Hotspot;
};

export type CpfLogin = EntityBase & {
  nome: string;
  cpf: string;
  telefone: string | null;
  tempoMinutos: number;
  ativo: boolean;
  usadoEm: string | null;
  hotspotId: string;
  hotspot?: Hotspot;
};

export type LoginType = "VOUCHER" | "CPF" | "IXC" | "COMPRA" | "CONTRATACAO";

export type Acesso = EntityBase & {
  tipo: LoginType;
  codigo: string;
  mac: string | null;
  ip: string | null;
  loginEm: string;
  expiraEm: string;
  status: string;
  hotspotId: string;
  mikrotikId: string | null;
  voucherId: string | null;
  cpfLoginId: string | null;
  hotspot?: Hotspot;
  voucher?: Voucher | null;
  cpfLogin?: CpfLogin | null;
};

export type DashboardData = {
  filters: {
    from: string;
    to: string;
    localId: string;
    hotspotId: string;
    locais: Local[];
    hotspots: Array<Pick<Hotspot, "id" | "nome" | "localId">>;
  };
  totals: {
    vouchersTotal: number;
    vouchersUsados: number;
    vouchersDisponiveis: number;
    hotspots: number;
    mikrotiks: number;
    acessos: number;
    clientesAtivos: number;
  };
  accessByDay: Array<{ date: string; total: number }>;
  accessByType: Array<{ tipo: LoginType; total: number }>;
  accessByLocal: Array<{ id: string; nome: string; total: number }>;
  accessByHotspot: Array<{ id: string; nome: string; total: number }>;
  recentAccesses: Acesso[];
  activeClients: Array<{
    id: string;
    username: string;
    ip: string;
    mac: string;
    uptime: string;
    loginBy: string;
    server: string;
    mikrotikId: string;
    mikrotikNome: string;
    hotspotNome: string;
    localNome: string;
    error: string | null;
  }>;
};

export type PortalInfo = {
  hotspot: Pick<
    Hotspot,
    | "id"
    | "nome"
    | "slug"
    | "portalUrl"
    | "loginVoucher"
    | "loginCpf"
    | "loginIntegracao"
    | "compraOnline"
    | "compraPersonalizada"
    | "valorMinutoCentavos"
    | "tempoPersonalizadoMinimo"
    | "tempoPersonalizadoMaximo"
    | "tempoPersonalizadoPasso"
    | "conexoesPersonalizado"
    | "ativo"
  > & {
    local?: Pick<Local, "id" | "nome"> | null;
    integracao?: Pick<Integracao, "id" | "nome" | "tipo" | "ativo"> | null;
    pagamentoIntegracao?: Pick<Integracao, "id" | "nome" | "tipo" | "ativo"> | null;
    cadastroTela?: CadastroTela | null;
    planos: Array<
      Pick<
        PlanoBilheteria,
        | "id"
        | "nome"
        | "tempoMinutos"
        | "conexoesSimultaneas"
        | "valorCentavos"
        | "coletarNome"
        | "coletarTelefone"
        | "coletarEmail"
        | "coletarCpf"
        | "coletarEndereco"
      >
    >;
  };
  loginTypes: {
    voucher: boolean;
    cpf: boolean;
    ixc: boolean;
    compra: boolean;
  };
};
