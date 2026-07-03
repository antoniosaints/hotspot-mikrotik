import http from "node:http";
import https from "node:https";

export type IxcConfig = {
  baseUrl: string;
  usuario: string;
  senha: string;
};

type IxcListResponse<T> = {
  page?: string;
  total?: string;
  registros?: T[];
};

type IxcCliente = {
  id?: string;
};

type IxcContrato = {
  id?: string;
  status?: string;
  status_internet?: string;
};

export type IxcValidationResult =
  | { allowed: true; clienteId: string; contratoId: string }
  | { allowed: false; code: "CLIENTE_NAO_ENCONTRADO"; reason: string }
  | { allowed: false; code: "CLIENTE_COM_DEBITOS"; clienteId: string; reason: string };

export type IxcOpenInvoice = {
  id: string;
  valor: string;
};

export type IxcInvoicePix = {
  pixCopiaECola: string;
  qrCode: string;
  imagemQrcode: string;
  imageSrc: string;
};

function formatCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }

  return value.trim();
}

async function ixcGetWithBody<TResponse>(config: IxcConfig, path: string, body: Record<string, string>): Promise<TResponse> {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const url = new URL(`${baseUrl}${path}`);
  const payload = JSON.stringify(body);
  const transport = url.protocol === "https:" ? https : http;
  const auth = Buffer.from(`${config.usuario}:${config.senha}`).toString("base64");

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ixcsoft: "listar",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");

          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`IXC retornou HTTP ${response.statusCode ?? "desconhecido"}: ${text}`));
            return;
          }

          try {
            resolve(text ? (JSON.parse(text) as TResponse) : ({} as TResponse));
          } catch {
            reject(new Error("IXC retornou uma resposta invalida."));
          }
        });
      },
    );

    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

export async function validateIxcLogin(config: IxcConfig, cpfCnpj: string): Promise<IxcValidationResult> {
  const formattedDocument = formatCpfCnpj(cpfCnpj);
  const clientes = await ixcGetWithBody<IxcListResponse<IxcCliente>>(config, "/cliente", {
    qtype: "cliente.cnpj_cpf",
    query: formattedDocument,
    oper: "=",
  });

  const cliente = clientes.registros?.find((registro) => registro.id);
  if (!cliente?.id) {
    return { allowed: false, code: "CLIENTE_NAO_ENCONTRADO", reason: "CPF nao encontrado na base." };
  }

  const contratos = await ixcGetWithBody<IxcListResponse<IxcContrato>>(config, "/cliente_contrato", {
    qtype: "cliente_contrato.id_cliente",
    query: cliente.id,
    oper: "=",
    page: "1",
    rp: "20",
    sortname: "cliente_contrato.id_cliente",
    sortorder: "desc",
  });

  const contratoValido = contratos.registros?.find(
    (contrato) => contrato.id && contrato.status === "A" && contrato.status_internet === "A",
  );

  if (!contratoValido?.id) {
    return { allowed: false, code: "CLIENTE_COM_DEBITOS", clienteId: cliente.id, reason: "Login nao permitido: cliente contem debitos." };
  }

  return { allowed: true, clienteId: cliente.id, contratoId: contratoValido.id };
}

function formatBrDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function currentMonthRange(now = new Date()) {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: formatBrDate(first), to: formatBrDate(last) };
}

export async function listCurrentMonthOpenInvoices(
  config: IxcConfig,
  clienteId: string,
  now = new Date(),
): Promise<IxcOpenInvoice[]> {
  const range = currentMonthRange(now);
  const response = await ixcGetWithBody<IxcListResponse<IxcOpenInvoice>>(config, "/fn_areceber", {
    qtype: "fn_areceber.id_cliente",
    query: clienteId,
    oper: "=",
    page: "1",
    rp: "200000",
    sortname: "fn_areceber.data_vencimento",
    sortorder: "asc",
    grid_param: JSON.stringify([
      { TB: "fn_areceber.liberado", OP: "=", P: "S" },
      { TB: "fn_areceber.status", OP: "!=", P: "R", P2: "C" },
      { TB: "fn_areceber.data_vencimento", OP: "BE", P: range.from, P2: range.to },
    ]),
  });

  return (response.registros ?? []).filter((invoice) => invoice.id);
}

export async function getIxcInvoicePix(config: IxcConfig, invoiceId: string): Promise<IxcInvoicePix> {
  const response = await ixcGetWithBody<{
    pix?: {
      dadosPix?: { pixCopiaECola?: string };
      qrCode?: { qrCode?: string; imagemQrcode?: string; imageSrc?: string };
    };
  }>(config, "/get_pix", {
    id_areceber: invoiceId,
  });

  const pixCopiaECola = response.pix?.dadosPix?.pixCopiaECola ?? response.pix?.qrCode?.qrCode ?? "";
  return {
    pixCopiaECola,
    qrCode: response.pix?.qrCode?.qrCode ?? pixCopiaECola,
    imagemQrcode: response.pix?.qrCode?.imagemQrcode ?? "",
    imageSrc: response.pix?.qrCode?.imageSrc ?? "",
  };
}
