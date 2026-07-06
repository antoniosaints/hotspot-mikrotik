import { createHmac, timingSafeEqual } from "node:crypto";

export type MercadoPagoConfig = {
  accessToken: string;
  webhookSecret?: string | null;
};

export type CreatePixPaymentInput = {
  amountCentavos: number;
  description: string;
  payerEmail?: string | null;
  externalReference: string;
  notificationUrl: string;
};

export type PixPaymentResult = {
  id: string;
  status: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
};

export type MercadoPagoPayment = {
  id: string;
  status: string;
  externalReference: string | null;
};

const MERCADO_PAGO_API = "https://api.mercadopago.com";
const DEFAULT_PAYER_EMAIL = "comprador@hotspot.local";

function centsToAmount(cents: number) {
  return Number((cents / 100).toFixed(2));
}

async function parseMercadoPagoResponse(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) as Record<string, unknown> : {};

  if (!response.ok) {
    const message = typeof data.message === "string" ? data.message : `Mercado Pago retornou HTTP ${response.status}.`;
    throw new Error(message);
  }

  return data;
}

export async function createPixPayment(config: MercadoPagoConfig, input: CreatePixPaymentInput): Promise<PixPaymentResult> {
  const response = await fetch(`${MERCADO_PAGO_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.externalReference,
    },
    body: JSON.stringify({
      transaction_amount: centsToAmount(input.amountCentavos),
      description: input.description,
      payment_method_id: "pix",
      payer: {
        email: input.payerEmail || DEFAULT_PAYER_EMAIL,
      },
      external_reference: input.externalReference,
      notification_url: input.notificationUrl,
    }),
  });

  const data = await parseMercadoPagoResponse(response);
  const point = data.point_of_interaction as { transaction_data?: { qr_code?: string; qr_code_base64?: string } } | undefined;

  return {
    id: String(data.id),
    status: String(data.status ?? "pending"),
    qrCode: point?.transaction_data?.qr_code ?? null,
    qrCodeBase64: point?.transaction_data?.qr_code_base64 ?? null,
  };
}

export async function getPayment(config: MercadoPagoConfig, paymentId: string): Promise<MercadoPagoPayment> {
  const response = await fetch(`${MERCADO_PAGO_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  const data = await parseMercadoPagoResponse(response);

  return {
    id: String(data.id),
    status: String(data.status ?? ""),
    externalReference: typeof data.external_reference === "string" ? data.external_reference : null,
  };
}

export function isApprovedPayment(payment: MercadoPagoPayment) {
  return payment.status === "approved";
}

export type WebhookSignatureInput = {
  secret: string;
  xSignature: string | null | undefined;
  xRequestId: string | null | undefined;
  dataId: string;
};

// Validacao da assinatura de webhooks do Mercado Pago.
// Header x-signature: "ts=<timestamp>,v1=<hmac>"; o HMAC-SHA256 e calculado
// sobre o manifest "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
// (partes omitidas quando o valor nao existe), usando a chave secreta do
// webhook configurada na integracao.
export function verifyMercadoPagoSignature(input: WebhookSignatureInput): boolean {
  if (!input.xSignature) {
    return false;
  }

  const parts = new Map<string, string>();
  for (const piece of input.xSignature.split(",")) {
    const [key, ...rest] = piece.split("=");
    if (key && rest.length > 0) {
      parts.set(key.trim(), rest.join("=").trim());
    }
  }

  const ts = parts.get("ts");
  const hash = parts.get("v1");
  if (!ts || !hash) {
    return false;
  }

  const manifestParts: string[] = [];
  if (input.dataId) {
    manifestParts.push(`id:${input.dataId.toLowerCase()};`);
  }
  if (input.xRequestId) {
    manifestParts.push(`request-id:${input.xRequestId};`);
  }
  manifestParts.push(`ts:${ts};`);

  const expected = createHmac("sha256", input.secret).update(manifestParts.join("")).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(hash, "utf8");

  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
